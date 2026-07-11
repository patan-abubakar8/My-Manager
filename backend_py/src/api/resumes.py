import json
import logging
import zipfile
import xml.etree.ElementTree as ET
from typing import Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Response
from sqlalchemy.orm import Session
import pypdf

from backend_py.src.infrastructure.database import get_db
from backend_py.src.domain.models import (
    MasterProfile, TailoredResume, JobApplication, Project, ResumeHistory,
    MasterProfileSchema, TailoredResumeSchema,
    ParseResumeRequest, ATSCheckRequest, ATSCheckResponse
)
from backend_py.src.application.ai_helper import generate_structured_json, chat_with_nvidia_nim
from backend_py.src.api.settings import get_active_model_name

logger = logging.getLogger(__name__)

def _extract_text_from_docx(file_obj) -> str:
    try:
        with zipfile.ZipFile(file_obj) as docx:
            xml_content = docx.read('word/document.xml')
            root = ET.fromstring(xml_content)
            
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            text_runs = []
            
            for p in root.findall('.//w:p', ns):
                p_text = []
                for t in p.findall('.//w:t', ns):
                    if t.text:
                        p_text.append(t.text)
                if p_text:
                    text_runs.append("".join(p_text))
            
            return "\n".join(text_runs)
    except Exception as e:
        raise ValueError(f"Failed to read DOCX file: {str(e)}")

router = APIRouter(prefix="/api/v1/resumes", tags=["resumes"])


def _safe_json_strip(raw: str) -> str:
    """Robustly extract the JSON object from LLM output, ignoring preambles and code fences."""
    raw = raw.strip()
    
    # 1. Look for markdown code block fences and extract content inside
    if "```" in raw:
        try:
            parts = raw.split("```")
            if len(parts) >= 3:
                content = parts[1]
                # Strip language specifiers (e.g. 'json') from the first line
                first_line_end = content.find("\n")
                if first_line_end != -1:
                    first_line = content[:first_line_end].strip().lower()
                    if first_line in ["json", "javascript", "js", "text"]:
                        content = content[first_line_end:].strip()
                return content.strip()
        except Exception:
            pass

    # 2. If no matching code block found, extract everything from the first '{' to the last '}'
    first_brace = raw.find("{")
    last_brace = raw.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        return raw[first_brace:last_brace + 1].strip()

    return raw


# ─── Master Profile ───────────────────────────────────────────────────────────

@router.get("/master", response_model=MasterProfileSchema)
def get_master_profile(db: Session = Depends(get_db)):
    profile = db.query(MasterProfile).first()
    if not profile:
        return MasterProfile(
            full_name="Your Name", email="your.email@example.com", phone="+1234567890",
            summary="A passionate engineer",
            experience_json="[]", education_json="[]", skills_json="[]", projects_json="[]"
        )
    return profile


@router.post("/master", response_model=MasterProfileSchema)
def save_master_profile(profile_data: MasterProfileSchema, db: Session = Depends(get_db)):
    profile = db.query(MasterProfile).first()
    if profile:
        profile.full_name = profile_data.full_name
        profile.email = profile_data.email
        profile.phone = profile_data.phone
        profile.summary = profile_data.summary
        profile.experience_json = profile_data.experience_json
        profile.education_json = profile_data.education_json
        profile.skills_json = profile_data.skills_json
        profile.projects_json = profile_data.projects_json
        if profile_data.raw_text is not None:
            profile.raw_text = profile_data.raw_text
    else:
        profile = MasterProfile(**profile_data.model_dump(exclude={"id"}))
        db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


# ─── AI Resume Parser (Import) ────────────────────────────────────────────────

def _ai_parse_text_to_profile(raw_text: str, db: Session, filename: Optional[str] = None) -> MasterProfileSchema:
    """Helper to parse raw resume text into a structured MasterProfileSchema using LLM."""
    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="extracted text cannot be empty")

    json_schema = json.dumps({
        "full_name": "string",
        "email": "string",
        "phone": "string",
        "summary": "string (2-3 sentence professional summary)",
        "experience_json": "[{\"company\":\"string\",\"role\":\"string\",\"duration\":\"string\",\"bullets\":\"string (newline separated)\"}]",
        "education_json": "[{\"school\":\"string\",\"degree\":\"string\",\"duration\":\"string\"}]",
        "skills_json": "[\"skill1\",\"skill2\"]",
        "projects_json": "[{\"name\":\"string\",\"description\":\"string\"}]"
    })

    prompt = f"""Extract structured information from this resume text. Output ONLY a valid JSON object.

Resume Text:
{raw_text[:6000]}

Return a JSON object exactly matching this schema:
{json_schema}

Rules:
- experience bullets should be newline-separated achievement statements
- If a field is not found, use an empty string or empty array
- skills_json must be a flat array of skill strings
- Do NOT include markdown fences"""

    active_model = get_active_model_name(db)
    try:
        json_result = generate_structured_json(prompt, json_schema, model=active_model)
        json_result = _safe_json_strip(json_result)
        data = json.loads(json_result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI parsing failed: {str(e)}")

    exp_str = json.dumps(data.get("experience_json", [])) if isinstance(data.get("experience_json"), list) else data.get("experience_json", "[]")
    edu_str = json.dumps(data.get("education_json", [])) if isinstance(data.get("education_json"), list) else data.get("education_json", "[]")
    skills_str = json.dumps(data.get("skills_json", [])) if isinstance(data.get("skills_json"), list) else data.get("skills_json", "[]")
    proj_str = json.dumps(data.get("projects_json", [])) if isinstance(data.get("projects_json"), list) else data.get("projects_json", "[]")

    try:
        hist_entry = ResumeHistory(
            filename=filename,
            full_name=data.get("full_name", ""),
            email=data.get("email", ""),
            phone=data.get("phone", ""),
            summary=data.get("summary", ""),
            experience_json=exp_str,
            education_json=edu_str,
            skills_json=skills_str,
            projects_json=proj_str,
            raw_text=raw_text
        )
        db.add(hist_entry)
        db.commit()
    except Exception as he:
        logger.error(f"Failed to save parse to history: {he}")
        db.rollback()

    return MasterProfileSchema(
        full_name=data.get("full_name", ""),
        email=data.get("email", ""),
        phone=data.get("phone", ""),
        summary=data.get("summary", ""),
        experience_json=exp_str,
        education_json=edu_str,
        skills_json=skills_str,
        projects_json=proj_str,
        raw_text=raw_text
    )


@router.post("/parse-text", response_model=MasterProfileSchema)
def parse_resume_text(body: ParseResumeRequest, db: Session = Depends(get_db)):
    """Parse raw resume text with AI and return a structured MasterProfileSchema."""
    return _ai_parse_text_to_profile(body.raw_text, db)


@router.post("/upload-pdf")
@router.post("/upload-file")
def upload_resume_file(file: UploadFile = File(...)):
    """Upload a PDF or DOCX file and extract its raw text content."""
    filename_lower = file.filename.lower()
    if not (filename_lower.endswith(".pdf") or filename_lower.endswith(".docx")):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")
    
    try:
        if filename_lower.endswith(".pdf"):
            pdf_reader = pypdf.PdfReader(file.file)
            text_parts = []
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            extracted_text = "\n".join(text_parts)
        else:
            extracted_text = _extract_text_from_docx(file.file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")
    
    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="No text could be extracted from the file")
        
    return {
        "filename": file.filename,
        "extracted_text": extracted_text
    }


@router.post("/parse-file", response_model=MasterProfileSchema)
def parse_resume_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Extract text from an uploaded PDF or DOCX file and parse it with AI."""
    filename_lower = file.filename.lower()
    if not (filename_lower.endswith(".pdf") or filename_lower.endswith(".docx")):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")
    
    try:
        if filename_lower.endswith(".pdf"):
            pdf_reader = pypdf.PdfReader(file.file)
            text_parts = []
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            extracted_text = "\n".join(text_parts)
        else:
            extracted_text = _extract_text_from_docx(file.file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")
    
    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="No text could be extracted from the file")
        
    return _ai_parse_text_to_profile(extracted_text, db, filename=file.filename)


# ─── Tailored Resume + ATS Scoring ───────────────────────────────────────────

@router.get("/tailored/{jobId}", response_model=TailoredResumeSchema)
def get_tailored_resume(jobId: int, db: Session = Depends(get_db)):
    resume = db.query(TailoredResume).filter(TailoredResume.job_application_id == jobId).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Tailored resume not found")
    return resume


@router.post("/tailored/{jobId}", response_model=TailoredResumeSchema)
def tailor_resume_for_job(jobId: int, db: Session = Depends(get_db)):
    job = db.query(JobApplication).filter(JobApplication.id == jobId).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job application not found")
    master = db.query(MasterProfile).first()
    if not master:
        raise HTTPException(status_code=400, detail="Please complete your Master Profile first.")

    active_model = get_active_model_name(db)

    # Step 1: Tailor resume content
    tailor_schema = json.dumps({
        "tailoredSummary": "string",
        "tailoredExperience": [
            {
                "company": "string",
                "role": "string",
                "duration": "string",
                "bullets": "string (newline-separated achievements)"
            }
        ],
        "coverLetter": "string (max 400 words)"
    })
    tailor_prompt = f"""Tailor the user's master resume for this specific job application.
 
Target Role: {job.role}
Company: {job.company}
Job Description: {job.job_description or 'Not provided'}
 
Master Profile Summary: {master.summary}
Master Experience JSON: {master.experience_json}
Master Skills JSON: {master.skills_json}
 
Instructions:
1. Rewrite the summary to align with the JD keywords and role requirements
2. Rewrite experience bullet points using strong action verbs and quantified achievements where possible
3. Write a compelling, personalized cover letter (max 400 words)
 
Return ONLY a JSON object matching the schema. No markdown fences."""
 
    try:
        json_result = generate_structured_json(tailor_prompt, tailor_schema, model=active_model)
        json_result = _safe_json_strip(json_result)
        tailor_data = json.loads(json_result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Resume Tailoring failed: {str(e)}")
 
    tailored_summary = tailor_data.get("tailoredSummary", "")
    exp_list = tailor_data.get("tailoredExperience", [])
    tailored_exp = json.dumps(exp_list) if isinstance(exp_list, list) else "[]"
    cover_letter = tailor_data.get("coverLetter", "")

    # Step 2: ATS Scoring
    ats_score, ats_feedback_json, ats_keywords_json = _compute_ats_score(
        resume_summary=tailored_summary,
        resume_exp=tailored_exp,
        skills_json=master.skills_json or "[]",
        jd_text=job.job_description or f"{job.role} at {job.company}",
        model=active_model
    )

    # Persist
    resume = db.query(TailoredResume).filter(TailoredResume.job_application_id == jobId).first()
    if resume:
        resume.tailored_summary = tailored_summary
        resume.tailored_experience_json = tailored_exp
        resume.cover_letter = cover_letter
        resume.ats_score = ats_score
        resume.ats_feedback = ats_feedback_json
        resume.ats_keywords = ats_keywords_json
    else:
        resume = TailoredResume(
            job_application_id=jobId,
            tailored_summary=tailored_summary,
            tailored_experience_json=tailored_exp,
            cover_letter=cover_letter,
            ats_score=ats_score,
            ats_feedback=ats_feedback_json,
            ats_keywords=ats_keywords_json
        )
        db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


@router.post("/project-match/{jobId}")
def match_projects_for_job(jobId: int, db: Session = Depends(get_db)):
    """Map existing evidence to a JD and propose honest learnable projects for material gaps."""
    job = db.query(JobApplication).filter(JobApplication.id == jobId).first()
    master = db.query(MasterProfile).first()
    if not job or not master:
        raise HTTPException(status_code=400, detail="A job application and master profile are required")

    portfolio = db.query(Project).all()
    portfolio_context = json.dumps([{
        "id": project.id, "name": project.name, "description": project.description,
        "tech_stack": project.tech_stack, "project_kind": project.project_kind
    } for project in portfolio])
    schema = json.dumps({
        "matched_projects": [{"project_id": "integer", "reason": "string", "relevance": "high|medium"}],
        "required_projects": [{"name": "string", "description": "string", "tech_stack": "comma-separated string", "why_required": "string", "starter_tasks": ["string"]}]
    })
    prompt = f"""You are a strict resume ATS project strategist. Compare the candidate's resume and real project portfolio against the job description. Only mark an existing project as matched when its stated evidence is genuinely relevant. For important gaps, recommend at most 3 small, buildable learnable projects. Never fabricate completed work.

Job: {job.role} at {job.company}
Job description: {job.job_description or ''}
Resume skills: {master.skills_json or '[]'}
Resume projects: {master.projects_json or '[]'}
Existing portfolio: {portfolio_context}

Return ONLY JSON matching: {schema}"""
    try:
        raw = generate_structured_json(prompt, schema, model=get_active_model_name(db))
        return json.loads(_safe_json_strip(raw))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Project matching failed: {str(exc)}")


def _compute_ats_score(resume_summary: str, resume_exp: str, skills_json: str,
                        jd_text: str, model: str) -> tuple[int, str, str]:
    """Call NIM to compute ATS score and keyword analysis. Returns (score, feedback_json, keywords_json)."""
    ats_schema = json.dumps({
        "score": "integer 0-100",
        "matched_keywords": ["keyword1", "keyword2"],
        "missing_keywords": ["keyword1", "keyword2"],
        "feedback": ["actionable suggestion 1", "actionable suggestion 2", "actionable suggestion 3"]
    })

    ats_prompt = f"""You are an expert ATS (Applicant Tracking System) evaluator.

Job Description:
{jd_text[:2000]}

Resume Content:
Summary: {resume_summary}
Experience: {resume_exp[:2000]}
Skills: {skills_json}

Evaluate this resume against the JD and return a JSON object with:
- score: integer 0-100 (how well this resume would pass ATS screening)
- matched_keywords: array of important JD keywords found in resume
- missing_keywords: array of important JD keywords NOT found in resume
- feedback: 3-5 specific, actionable improvement suggestions

Score rubric: 90-100=Excellent, 75-89=Good, 60-74=Fair, <60=Needs Work
Return ONLY the JSON object. No markdown fences."""

    try:
        json_result = generate_structured_json(ats_prompt, ats_schema, model=model)
        json_result = _safe_json_strip(json_result)
        data = json.loads(json_result)
        score = max(0, min(100, int(data.get("score", 70))))
        feedback = json.dumps(data.get("feedback", []))
        keywords = json.dumps({
            "matched": data.get("matched_keywords", []),
            "missing": data.get("missing_keywords", [])
        })
        return score, feedback, keywords
    except Exception as e:
        logger.error(f"ATS scoring failed: {e}")
        return 70, json.dumps(["Review resume against job requirements"]), json.dumps({"matched": [], "missing": []})


# ─── Standalone ATS Check ─────────────────────────────────────────────────────

@router.post("/ats-check", response_model=ATSCheckResponse)
def ats_check(body: ATSCheckRequest, db: Session = Depends(get_db)):
    """Standalone ATS check: paste any resume text + JD, get instant score."""
    if not body.resume_text.strip() or not body.jd_text.strip():
        raise HTTPException(status_code=400, detail="Both resume_text and jd_text are required")

    active_model = get_active_model_name(db)
    score, feedback_json, keywords_json = _compute_ats_score(
        resume_summary=body.resume_text[:1000],
        resume_exp=body.resume_text[1000:3000],
        skills_json="[]",
        jd_text=body.jd_text,
        model=active_model
    )

    try:
        feedback = json.loads(feedback_json)
        kw = json.loads(keywords_json)
    except Exception:
        feedback = []
        kw = {"matched": [], "missing": []}

    return ATSCheckResponse(
        score=score,
        matched_keywords=kw.get("matched", []),
        missing_keywords=kw.get("missing", []),
        feedback=feedback
    )


# ─── Interview Prep ───────────────────────────────────────────────────────────

@router.get("/prep/{jobId}")
def generate_interview_prep(jobId: int, db: Session = Depends(get_db)):
    job = db.query(JobApplication).filter(JobApplication.id == jobId).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job application not found")

    tailored = db.query(TailoredResume).filter(TailoredResume.job_application_id == jobId).first()
    resume_details = (
        f"Summary: {tailored.tailored_summary}\nExperience: {tailored.tailored_experience_json}"
        if tailored else "Master Profile used as no tailored resume exists."
    )

    prompt = f"""You are an expert technical interviewer. Generate 5 mock interview questions tailored to:
Company: {job.company}, Role: {job.role}
Job Description: {job.job_description}
Candidate Resume: {resume_details}

For each question provide a detailed sample answer and tips. Format in clean markdown."""

    try:
        active_model = get_active_model_name(db)
        messages = [
            {"role": "system", "content": "You are My Manager, a premium intelligent executive assistant. Be concise, structured, professional. Use markdown."},
            {"role": "user", "content": prompt}
        ]
        prep_content = chat_with_nvidia_nim(messages, model=active_model)
        return {"prep": prep_content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interview prep generation failed: {str(e)}")


# ─── New Resume Studio Overhaul Routes ────────────────────────────────────────

@router.post("/scrape-jd")
def scrape_job_description(body: Dict):
    url = body.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    try:
        import requests
        import re
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()
        
        html = res.text
        html = re.sub(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', '', html, flags=re.I)
        html = re.sub(r'<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>', '', html, flags=re.I)
        text = re.sub(r'<[^>]+>', ' ', html)
        text = re.sub(r'\s+', ' ', text).strip()
        
        return {"text": text[:5000]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to scrape webpage: {str(e)}")


@router.get("/history")
def get_parse_history(db: Session = Depends(get_db)):
    """Get previously parsed resume profile histories."""
    return db.query(ResumeHistory).order_by(ResumeHistory.created_at.desc()).all()


@router.post("/history/{id}/load", response_model=MasterProfileSchema)
def load_history_to_master(id: int, db: Session = Depends(get_db)):
    """Restore a previously parsed resume history item as the active MasterProfile."""
    hist = db.query(ResumeHistory).filter(ResumeHistory.id == id).first()
    if not hist:
        raise HTTPException(status_code=404, detail="History record not found")
    
    profile = db.query(MasterProfile).first()
    if not profile:
        profile = MasterProfile(
            full_name=hist.full_name or "Your Name",
            email=hist.email,
            phone=hist.phone,
            summary=hist.summary,
            experience_json=hist.experience_json or "[]",
            education_json=hist.education_json or "[]",
            skills_json=hist.skills_json or "[]",
            projects_json=hist.projects_json or "[]",
            raw_text=hist.raw_text
        )
        db.add(profile)
    else:
        profile.full_name = hist.full_name or "Your Name"
        profile.email = hist.email
        profile.phone = hist.phone
        profile.summary = hist.summary
        profile.experience_json = hist.experience_json or "[]"
        profile.education_json = hist.education_json or "[]"
        profile.skills_json = hist.skills_json or "[]"
        profile.projects_json = hist.projects_json or "[]"
        profile.raw_text = hist.raw_text
    
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/export-docx")
def export_resume_docx(body: Dict):
    """Generate a Microsoft Word compatible resume document formatted in clean A4 tables."""
    full_name = body.get("fullName", "Your Name")
    email = body.get("email", "")
    phone = body.get("phone", "")
    summary = body.get("summary", "")
    experience = body.get("experience", [])
    education = body.get("education", [])
    skills = body.get("skills", [])
    projects = body.get("projects", [])
    
    html_content = f"""
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
        <title>{full_name} Resume</title>
        <!--[if gte mso 9]>
        <xml>
            <w:WordDocument>
                <w:View>Print</w:View>
                <w:Zoom>100</w:Zoom>
                <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
            @page {{
                size: 8.5in 11in;
                margin: 1.0in 1.0in 1.0in 1.0in;
                mso-header-margin: .5in;
                mso-footer-margin: .5in;
                mso-paper-source: 0;
            }}
            body {{
                font-family: "Calibri", "Arial", sans-serif;
                font-size: 11.5pt;
                line-height: 1.3;
                color: #222222;
            }}
            .header {{
                text-align: center;
                margin-bottom: 25px;
                border-bottom: 2px solid #1f3864;
                padding-bottom: 10px;
            }}
            .name {{
                font-size: 22pt;
                font-weight: bold;
                color: #111111;
                margin: 0;
                text-transform: uppercase;
                letter-spacing: 1px;
            }}
            .contact {{
                font-size: 10pt;
                color: #555555;
                margin-top: 5px;
            }}
            .section-title {{
                font-size: 13pt;
                font-weight: bold;
                color: #1f3864;
                border-bottom: 1px solid #c0c0c0;
                margin-top: 22px;
                margin-bottom: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }}
            .summary {{
                margin-bottom: 15px;
                text-align: justify;
                font-size: 11pt;
            }}
            .item-header {{
                margin-top: 12px;
                margin-bottom: 4px;
                font-weight: bold;
            }}
            .item-title {{
                font-size: 11.5pt;
                color: #111111;
            }}
            .item-company {{
                font-weight: normal;
                color: #333333;
            }}
            .item-subtitle {{
                font-weight: normal;
                font-style: italic;
                color: #666666;
                float: right;
            }}
            .bullets {{
                margin-top: 5px;
                margin-bottom: 12px;
                padding-left: 20px;
            }}
            .bullet-item {{
                margin-bottom: 4px;
                text-align: justify;
                font-size: 11pt;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="name">{full_name}</div>
            <div class="contact">{email} | {phone}</div>
        </div>
        
        <div class="section-title">Professional Summary</div>
        <div class="summary">{summary}</div>
    """
    
    if skills:
        skills_str = ", ".join(skills)
        html_content += f"""
        <div class="section-title">Technical Skills</div>
        <div style="margin-bottom: 15px; font-size: 11pt;">{skills_str}</div>
        """
        
    if experience:
        html_content += '<div class="section-title">Professional Experience</div>'
        for exp in experience:
            company = exp.get("company", "")
            role = exp.get("role", "")
            duration = exp.get("duration", "")
            bullets = exp.get("bullets", "")
            
            html_content += f"""
            <div class="item-header">
                <span class="item-title">{role}</span>, <span class="item-company">{company}</span>
                <span class="item-subtitle">{duration}</span>
            </div>
            """
            if bullets:
                html_content += '<ul class="bullets">'
                for b in bullets.split("\n"):
                    b = b.strip().lstrip("-*•").strip()
                    if b:
                        html_content += f'<li class="bullet-item">{b}</li>'
                html_content += '</ul>'
                
    if projects:
        html_content += '<div class="section-title">Key Projects</div>'
        for proj in projects:
            name = proj.get("name", "")
            desc = proj.get("description", "")
            
            html_content += f"""
            <div class="item-header">
                <span class="item-title">{name}</span>
            </div>
            <div style="margin-bottom: 12px; font-size: 11pt; text-align: justify;">{desc}</div>
            """
            
    if education:
        html_content += '<div class="section-title">Education</div>'
        for edu in education:
            school = edu.get("school", "")
            degree = edu.get("degree", "")
            duration = edu.get("duration", "")
            html_content += f"""
            <div class="item-header">
                <span class="item-title">{degree}</span>, <span class="item-company">{school}</span>
                <span class="item-subtitle">{duration}</span>
            </div>
            """
            
    html_content += """
    </body>
    </html>
    """
    
    return Response(
        content=html_content.encode("utf-8"),
        media_type="application/msword",
        headers={"Content-Disposition": f"attachment; filename=resume.doc"}
    )


@router.post("/interview-coach/{jobId}")
def generate_interview_coach(jobId: int, db: Session = Depends(get_db)):
    """Generate a strengths/weaknesses and multi-category mock interview preparation report using AI."""
    job = db.query(JobApplication).filter(JobApplication.id == jobId).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job application not found")
    
    tailored = db.query(TailoredResume).filter(TailoredResume.job_application_id == jobId).first()
    master = db.query(MasterProfile).first()
    
    summary_text = tailored.tailored_summary if tailored else (master.summary if master else "")
    exp_text = tailored.tailored_experience_json if tailored else (master.experience_json if master else "[]")
    skills_text = master.skills_json if master else "[]"
    
    prompt = f"""You are a veteran technical hiring manager and senior recruiter with 10+ years of interview experience. Provide a thorough candidate assessment and comprehensive prep questions. 

Target Role: {job.role} at {job.company}
Job Description: {job.job_description or 'Not provided'}

Candidate Details:
Summary: {summary_text}
Experience: {exp_text}
Skills: {skills_text}

Rules:
1. Identify 3-4 highly specific candidate strengths and 3-4 actual candidate weaknesses (e.g. missing technologies, gaps in architecture experience, metrics missing).
2. Write overall readiness expectations Sonu will face from the interviewers.
3. Formulate realistic, challenging sample questions across five domains: Aptitude, Coding, SQL, System Design, and Behavioral.
4. For each question, provide a high-scoring expected answer and preparation guidelines.
5. Return ONLY a valid JSON object matching the schema. Do NOT wrap in markdown fences or include additional text."""

    schema = json.dumps({
        "strengths": ["string"],
        "weaknesses": ["string"],
        "overall_readiness_expectations": "string",
        "interview_topics": [
            {
                "category": "Aptitude | Coding | SQL | System Design | Behavioral",
                "key_focus_areas": ["string"],
                "sample_questions": [
                    {
                        "question": "string",
                        "expected_answer": "string",
                        "ideal_response_tips": "string"
                    }
                ]
            }
        ]
    })
    
    try:
        active_model = get_active_model_name(db)
        json_result = generate_structured_json(prompt, schema, model=active_model)
        json_result = _safe_json_strip(json_result)
        return json.loads(json_result)
    except Exception as e:
        logger.error(f"Interview coach generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Interview coach generation failed: {str(e)}")

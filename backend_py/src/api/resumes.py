import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
import pypdf

from backend_py.src.infrastructure.database import get_db
from backend_py.src.domain.models import (
    MasterProfile, TailoredResume, JobApplication,
    MasterProfileSchema, TailoredResumeSchema,
    ParseResumeRequest, ATSCheckRequest, ATSCheckResponse
)
from backend_py.src.application.ai_helper import generate_structured_json, chat_with_nvidia_nim
from backend_py.src.api.settings import get_active_model_name

logger = logging.getLogger(__name__)

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

def _ai_parse_text_to_profile(raw_text: str, db: Session) -> MasterProfileSchema:
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

    return MasterProfileSchema(
        full_name=data.get("full_name", ""),
        email=data.get("email", ""),
        phone=data.get("phone", ""),
        summary=data.get("summary", ""),
        experience_json=json.dumps(data.get("experience_json", [])) if isinstance(data.get("experience_json"), list) else data.get("experience_json", "[]"),
        education_json=json.dumps(data.get("education_json", [])) if isinstance(data.get("education_json"), list) else data.get("education_json", "[]"),
        skills_json=json.dumps(data.get("skills_json", [])) if isinstance(data.get("skills_json"), list) else data.get("skills_json", "[]"),
        projects_json=json.dumps(data.get("projects_json", [])) if isinstance(data.get("projects_json"), list) else data.get("projects_json", "[]"),
        raw_text=raw_text
    )


@router.post("/parse-text", response_model=MasterProfileSchema)
def parse_resume_text(body: ParseResumeRequest, db: Session = Depends(get_db)):
    """Parse raw resume text with AI and return a structured MasterProfileSchema."""
    return _ai_parse_text_to_profile(body.raw_text, db)


@router.post("/upload-pdf")
def upload_pdf_file(file: UploadFile = File(...)):
    """Upload a PDF file and extract its raw text content (no AI parsing yet)."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        pdf_reader = pypdf.PdfReader(file.file)
        text_parts = []
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        extracted_text = "\n".join(text_parts)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF file: {str(e)}")
    
    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="No text could be extracted from the PDF file")
        
    return {
        "filename": file.filename,
        "extracted_text": extracted_text
    }


@router.post("/parse-file", response_model=MasterProfileSchema)
def parse_resume_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Extract text from an uploaded PDF file and parse it with AI."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        pdf_reader = pypdf.PdfReader(file.file)
        text_parts = []
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        extracted_text = "\n".join(text_parts)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF file: {str(e)}")
    
    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="No text could be extracted from the PDF file")
        
    return _ai_parse_text_to_profile(extracted_text, db)


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
    tailor_schema = '{"tailoredSummary":"string","tailoredExperienceJson":"string (JSON array of experience objects)","coverLetter":"string (max 400 words)"}'
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
    tailored_exp = tailor_data.get("tailoredExperienceJson", "[]")
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

import json
import requests
import urllib.parse
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from backend_py.src.infrastructure.database import get_db
from backend_py.src.domain.models import JobApplication, JobApplicationSchema
from backend_py.src.config.config import NVIDIA_NIM_API_KEY
from backend_py.src.api.settings import get_active_model_name

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])

def parse_rss_title(title_str: str):
    source = "Web"
    cleaned = title_str
    
    # Extract source board if matching
    if " - Naukri.com" in cleaned:
        source = "Naukri"
        cleaned = cleaned.replace(" - Naukri.com", "")
    elif " - foundit" in cleaned:
        source = "Foundit"
        cleaned = cleaned.replace(" - foundit", "")
    elif " - Wellfound" in cleaned:
        source = "Wellfound"
        cleaned = cleaned.replace(" - Wellfound", "")
    elif " | " in cleaned:
        parts = cleaned.split(" | ")
        if len(parts) > 1 and parts[-1].strip().lower() in ["naukri", "naukri.com", "foundit", "wellfound", "linkedin"]:
            source = parts[-1].strip()
            cleaned = " - ".join(parts[:-1])
            
    # Try to extract Role and Company Name
    company = "Various"
    role = cleaned
    if " at " in cleaned:
        parts = cleaned.split(" at ")
        role = parts[0].strip()
        company = parts[1].strip()
        if " in " in company:
            company = company.split(" in ")[0].strip()
        if " - " in company:
            company = company.split(" - ")[0].strip()
    elif " - " in cleaned:
        parts = cleaned.split(" - ")
        if len(parts) >= 2:
            role = parts[0].strip()
            company = parts[1].strip()
            
    return role, company, source

@router.get("/search")
def search_online_jobs(q: str = "", category: str = "software-development", days: int = 7, source: str = "global"):
    """Fetch tech/business jobs from either global boards (Naukri/Wellfound/Foundit) or Remote (Remotive)."""
    if source == "remote":
        url = "https://remotive.com/api/remote-jobs?"
        params = []
        if q.strip():
            params.append(f"search={q.strip()}")
        if category and category != "all":
            params.append(f"category={category}")
            
        url += "&".join(params)
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            jobs = response.json().get("jobs", [])
            
            cutoff = datetime.now() - timedelta(days=days)
            filtered_jobs = []
            for job in jobs:
                pub_date_str = job.get("publication_date")
                if pub_date_str:
                    try:
                        pub_date = datetime.fromisoformat(pub_date_str)
                        if pub_date >= cutoff:
                            filtered_jobs.append(job)
                    except Exception:
                        filtered_jobs.append(job)
                else:
                    filtered_jobs.append(job)
                    
            res_list = []
            for j in filtered_jobs[:50]:
                res_list.append({
                    "id": j.get("id"),
                    "title": j.get("title"),
                    "company_name": j.get("company_name"),
                    "category": j.get("category"),
                    "url": j.get("url"),
                    "candidate_required_location": j.get("candidate_required_location") or "Remote",
                    "salary": j.get("salary") or "N/A",
                    "description": j.get("description") or "",
                    "publication_date": j.get("publication_date"),
                    "source": "Remotive"
                })
            return res_list
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch remote jobs: {str(e)}")
            
    else: # global source (Naukri, Wellfound, Foundit)
        base_query = 'site:wellfound.com/jobs OR site:naukri.com OR site:foundit.in'
        keyword = q.strip()
        if not keyword:
            if category == "design":
                keyword = "UI UX Designer"
            elif category == "product":
                keyword = "Product Manager"
            elif category == "marketing":
                keyword = "Marketing Specialist"
            elif category == "data":
                keyword = "Data Analyst"
            elif category == "writing":
                keyword = "Content Writer"
            elif category == "sales":
                keyword = "Sales Executive"
            elif category == "hr":
                keyword = "HR Generalist"
            else:
                keyword = "Software Developer"
                
        search_query = f'{base_query} "{keyword}" when:{days}d'
        feed_url = f"https://news.google.com/rss/search?q={urllib.parse.quote(search_query)}&hl=en-US&gl=US&ceid=US:en"
        
        try:
            import xml.etree.ElementTree as ET
            res = requests.get(feed_url, timeout=10)
            res.raise_for_status()
            
            root = ET.fromstring(res.content)
            items = root.findall('.//item')
            
            res_list = []
            for idx, item in enumerate(items):
                title_text = item.find("title").text if item.find("title") is not None else "N/A"
                link_url = item.find("link").text if item.find("link") is not None else ""
                pub_date_str = item.find("pubDate").text if item.find("pubDate") is not None else ""
                desc_text = item.find("description").text if item.find("description") is not None else ""
                
                role, company, board = parse_rss_title(title_text)
                
                res_list.append({
                    "id": f"rss_{idx}",
                    "title": role,
                    "company_name": company,
                    "category": category.replace("-", " ").title() if category else "Tech",
                    "url": link_url,
                    "candidate_required_location": "India / Remote" if board in ["Naukri", "Foundit"] else "Worldwide",
                    "salary": "N/A",
                    "description": desc_text,
                    "publication_date": pub_date_str,
                    "source": board
                })
            return res_list
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch global jobs: {str(e)}")

@router.post("/auto-track")
def auto_track_job(request: Dict, db: Session = Depends(get_db)):
    """Fetch raw JD from URL or use copy-pasted text, extract details via AI Llama 3.1 8B, and save."""
    job_url = request.get("job_url", "").strip()
    raw_text = request.get("raw_text", "").strip()
    company_name = request.get("company", "").strip()
    role_title = request.get("role", "").strip()
    salary_range = request.get("salary_range", "").strip()
    
    # If URL is provided and text is empty, try scraping the page
    if job_url and not raw_text:
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            res = requests.get(job_url, headers=headers, timeout=10)
            if res.status_code in [401, 403]:
                return {
                    "status": "require_text",
                    "detail": "This job board is protected against automated scraping. Please copy and paste the job description text directly."
                }
            res.raise_for_status()
            
            soup = BeautifulSoup(res.text, "html.parser")
            for tag in soup(["script", "style", "meta", "link", "noscript", "header", "footer", "nav"]):
                tag.decompose()
                
            text_content = soup.get_text(separator="\n")
            lines = (line.strip() for line in text_content.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            raw_text = "\n".join(chunk for chunk in chunks if chunk)
            
            if len(raw_text.strip()) < 100:
                raise Exception("Cleaned text content is too short")
        except Exception as e:
            return {
                "status": "require_text",
                "detail": f"Failed to auto-fetch details from URL: {str(e)}. Please copy-paste the job description text below."
            }
            
    if not raw_text:
        raise HTTPException(status_code=400, detail="Job description text or a valid URL is required")
        
    # Extract details using AI
    from backend_py.src.api.settings import get_active_ai_credentials
    creds = get_active_ai_credentials(db)
    active_model = creds["model"]
    api_key = creds["api_key"]
    base_url = creds["base_url"]
    
    prompt = f"""You are an elite ATS parsing assistant. Analyze the following Job Description (JD) text and extract the required details.
If some details are not found in the text, return null or empty array.

Details to extract:
1. HR Email / Contact Email (look for email patterns in the text, e.g. careers@company.com, jobs@company.com, contact@company.com, or specific personal HR email)
2. Required Skills (list of key technical or domain skills required for the role)
3. Experience Required (summary of years of experience required or required level, e.g. "3+ years of React", "Junior level", etc.)
4. Concise Role Summary (1-2 sentences summarizing what this role does)
5. Company Name (if not clear, try to infer or leave null)
6. Role Title (if not clear, try to infer or leave null)

Job Description Text:
\"\"\"{raw_text[:4000]}\"\"\"

Response MUST be in strict JSON format:
{{
  "hr_email": "string or null",
  "skills": ["skill1", "skill2", ...],
  "experience": "string or null",
  "summary": "string or null",
  "company": "string or null",
  "role": "string or null"
}}
"""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    payload = {
        "model": active_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 1000
    }
    
    parsed_info = {
        "hr_email": None,
        "skills": [],
        "experience": None,
        "summary": None,
        "company": None,
        "role": None
    }
    
    try:
        nim_res = requests.post(f"{base_url}/chat/completions", headers=headers, json=payload, timeout=25)
        nim_res.raise_for_status()
        res_data = nim_res.json()
        content = res_data["choices"][0]["message"]["content"].strip()
        
        if "{" in content and "}" in content:
            content = content[content.find("{"):content.rfind("}")+1]
            
        parsed_info = json.loads(content)
    except Exception as e:
        print("AI extraction failed, fallback used:", e)
        
    final_company = parsed_info.get("company") or company_name or "Unknown Company"
    final_role = parsed_info.get("role") or role_title or "Unknown Role"
    final_salary = salary_range or "N/A"
    
    hr_email = parsed_info.get("hr_email") or "Not found"
    experience = parsed_info.get("experience") or "Not specified"
    skills = parsed_info.get("skills") or []
    summary = parsed_info.get("summary") or "No summary available."
    
    notes_markdown = f"""### 🤖 AI Job Insights
- **HR Contact Email:** {hr_email}
- **Experience Required:** {experience}
- **Key Skills:** {", ".join(skills) if skills else "None specified"}
- **Role Summary:** {summary}

---
#### Original Job Description
{raw_text[:2000]}...
"""
    
    job = JobApplication(
        company=final_company,
        role=final_role,
        status="APPLIED",
        salary_range=final_salary,
        job_description=raw_text,
        job_url=job_url or "",
        applied_date=datetime.now().strftime("%Y-%m-%d"),
        notes=notes_markdown
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    return {"status": "success", "job": job}

@router.get("", response_model=List[JobApplicationSchema])
def get_all_applications(db: Session = Depends(get_db)):
    return db.query(JobApplication).all()

@router.get("/{id}", response_model=JobApplicationSchema)
def get_application_by_id(id: int, db: Session = Depends(get_db)):
    job = db.query(JobApplication).filter(JobApplication.id == id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job application not found")
    return job

@router.post("", response_model=JobApplicationSchema, status_code=status.HTTP_201_CREATED)
def create_application(job_data: JobApplicationSchema, db: Session = Depends(get_db)):
    job = JobApplication(
        company=job_data.company,
        role=job_data.role,
        status=job_data.status,
        salary_range=job_data.salary_range,
        job_description=job_data.job_description,
        job_url=job_data.job_url,
        applied_date=job_data.applied_date,
        notes=job_data.notes
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

@router.put("/{id}", response_model=JobApplicationSchema)
def update_application(id: int, job_data: JobApplicationSchema, db: Session = Depends(get_db)):
    job = db.query(JobApplication).filter(JobApplication.id == id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job application not found")
    job.company = job_data.company
    job.role = job_data.role
    job.status = job_data.status
    job.salary_range = job_data.salary_range
    job.job_description = job_data.job_description
    job.job_url = job_data.job_url
    job.applied_date = job_data.applied_date
    job.notes = job_data.notes
    db.commit()
    db.refresh(job)
    return job

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(id: int, db: Session = Depends(get_db)):
    job = db.query(JobApplication).filter(JobApplication.id == id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job application not found")
    db.delete(job)
    db.commit()
    return None

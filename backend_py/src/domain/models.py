from datetime import datetime, date
from sqlalchemy import Column, BigInteger, String, Text, Date, DateTime, Integer, Boolean
from sqlalchemy.orm import declarative_base
from pydantic import BaseModel
from typing import Optional, List

Base = declarative_base()

class BaseAuditEntity:
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)

# SQLAlchemy Entities
class UserMemory(Base, BaseAuditEntity):
    __tablename__ = "user_memories"
    
    id = Column(BigInteger, primary_key=True, index=True)
    fact = Column(Text, nullable=False)
    category = Column(String, nullable=True)

class JobApplication(Base, BaseAuditEntity):
    __tablename__ = "job_applications"
    
    id = Column(BigInteger, primary_key=True, index=True)
    company = Column(String, nullable=False)
    role = Column(String, nullable=False)
    status = Column(String, nullable=False)
    salary_range = Column(String, nullable=True)
    job_description = Column(Text, nullable=True)
    job_url = Column(String, nullable=True)
    applied_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)

class Project(Base, BaseAuditEntity):
    __tablename__ = "projects"
    
    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    tech_stack = Column(Text, nullable=True)
    github_url = Column(String, nullable=True)
    github_summary = Column(Text, nullable=True)
    features_json = Column(Text, nullable=True, default="[]")
    is_own_project = Column(Boolean, default=True, nullable=False)
    recreate_steps = Column(Text, nullable=True)

class Task(Base, BaseAuditEntity):
    __tablename__ = "tasks"
    
    id = Column(BigInteger, primary_key=True, index=True)
    project_id = Column(BigInteger, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="TODO")
    priority = Column(String, nullable=True, default="MEDIUM")
    due_date = Column(Date, nullable=True)

class MasterProfile(Base, BaseAuditEntity):
    __tablename__ = "master_profiles"
    
    id = Column(BigInteger, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    experience_json = Column(Text, nullable=True)
    education_json = Column(Text, nullable=True)
    skills_json = Column(Text, nullable=True)
    projects_json = Column(Text, nullable=True)
    raw_text = Column(Text, nullable=True)

class TailoredResume(Base, BaseAuditEntity):
    __tablename__ = "tailored_resumes"
    
    id = Column(BigInteger, primary_key=True, index=True)
    job_application_id = Column(BigInteger, nullable=False)
    tailored_summary = Column(Text, nullable=True)
    tailored_experience_json = Column(Text, nullable=True)
    cover_letter = Column(Text, nullable=True)
    ats_score = Column(Integer, nullable=True)
    ats_feedback = Column(Text, nullable=True)
    ats_keywords = Column(Text, nullable=True)

class SystemSetting(Base, BaseAuditEntity):
    __tablename__ = "system_settings"
    
    setting_key = Column(String, primary_key=True, index=True)
    setting_value = Column(Text, nullable=True)

class Idea(Base, BaseAuditEntity):
    __tablename__ = "ideas"
    
    id = Column(BigInteger, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True, default="Tech")  # Tech / Business / Life
    status = Column(String, nullable=True, default="Idea")    # Idea / Exploring / Parked / Building

# Pydantic Schemas
class UserMemorySchema(BaseModel):
    id: Optional[int] = None
    fact: str
    category: Optional[str] = None
    
    class Config:
        from_attributes = True

class JobApplicationSchema(BaseModel):
    id: Optional[int] = None
    company: str
    role: str
    status: str
    salary_range: Optional[str] = None
    job_description: Optional[str] = None
    job_url: Optional[str] = None
    applied_date: Optional[date] = None
    notes: Optional[str] = None
    
    class Config:
        from_attributes = True

class ProjectSchema(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    tech_stack: Optional[str] = None
    github_url: Optional[str] = None
    github_summary: Optional[str] = None
    features_json: Optional[str] = "[]"
    is_own_project: Optional[bool] = True
    recreate_steps: Optional[str] = None
    
    class Config:
        from_attributes = True

class TaskSchema(BaseModel):
    id: Optional[int] = None
    project_id: int
    title: str
    description: Optional[str] = None
    status: str = "TODO"
    priority: Optional[str] = "MEDIUM"
    due_date: Optional[date] = None
    
    class Config:
        from_attributes = True

class MasterProfileSchema(BaseModel):
    id: Optional[int] = None
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    summary: Optional[str] = None
    experience_json: Optional[str] = None
    education_json: Optional[str] = None
    skills_json: Optional[str] = None
    projects_json: Optional[str] = None
    raw_text: Optional[str] = None
    
    class Config:
        from_attributes = True

class TailoredResumeSchema(BaseModel):
    id: Optional[int] = None
    job_application_id: int
    tailored_summary: Optional[str] = None
    tailored_experience_json: Optional[str] = None
    cover_letter: Optional[str] = None
    ats_score: Optional[int] = None
    ats_feedback: Optional[str] = None
    ats_keywords: Optional[str] = None
    
    class Config:
        from_attributes = True

class SystemSettingSchema(BaseModel):
    setting_key: str
    setting_value: Optional[str] = None
    
    class Config:
        from_attributes = True

class IdeaSchema(BaseModel):
    id: Optional[int] = None
    title: str
    description: Optional[str] = None
    category: Optional[str] = "Tech"
    status: Optional[str] = "Idea"
    
    class Config:
        from_attributes = True

# Request/Response helpers
class ParseResumeRequest(BaseModel):
    raw_text: str

class ATSCheckRequest(BaseModel):
    resume_text: str
    jd_text: str

class ATSCheckResponse(BaseModel):
    score: int
    matched_keywords: List[str]
    missing_keywords: List[str]
    feedback: List[str]

class FeatureRequest(BaseModel):
    feature: str

class GithubScrapeResponse(BaseModel):
    summary: str
    repo_name: Optional[str] = None
    stars: Optional[int] = None
    language: Optional[str] = None
    topics: Optional[List[str]] = None

class GithubImportRequest(BaseModel):
    github_url: str
    is_own_project: bool = True


import logging
import json
import requests as http_requests
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta

from backend_py.src.infrastructure.database import get_db
from backend_py.src.domain.models import Project, Task, ProjectSchema, FeatureRequest, GithubScrapeResponse, GithubImportRequest
from backend_py.src.application.ai_helper import generate_structured_json, chat_with_nvidia_nim
from backend_py.src.api.settings import get_active_model_name

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


# ─── CRUD ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[ProjectSchema])
def get_all_projects(db: Session = Depends(get_db)):
    return db.query(Project).all()


@router.get("/{id}", response_model=ProjectSchema)
def get_project_by_id(id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("", response_model=ProjectSchema, status_code=status.HTTP_201_CREATED)
def create_project(project_data: ProjectSchema, db: Session = Depends(get_db)):
    project = Project(
        name=project_data.name,
        description=project_data.description,
        tech_stack=project_data.tech_stack,
        github_url=project_data.github_url,
        github_summary=project_data.github_summary,
        features_json=project_data.features_json or "[]",
        is_own_project=project_data.is_own_project if project_data.is_own_project is not None else True,
        recreate_steps=project_data.recreate_steps,
        project_kind=project_data.project_kind or ("OWN" if project_data.is_own_project else "LEARNING")
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.put("/{id}", response_model=ProjectSchema)
def update_project(id: int, project_data: ProjectSchema, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.name = project_data.name
    project.description = project_data.description
    project.tech_stack = project_data.tech_stack
    project.github_url = project_data.github_url
    if project_data.github_summary is not None:
        project.github_summary = project_data.github_summary
    if project_data.features_json is not None:
        project.features_json = project_data.features_json
    if project_data.is_own_project is not None:
        project.is_own_project = project_data.is_own_project
    if project_data.recreate_steps is not None:
        project.recreate_steps = project_data.recreate_steps
    if project_data.project_kind is not None:
        project.project_kind = project_data.project_kind
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.query(Task).filter(Task.project_id == id).delete()
    db.delete(project)
    db.commit()
    return None


# ─── GitHub Scraping ──────────────────────────────────────────────────────────

def _parse_github_url(url: str):
    """Extract owner and repo from a GitHub URL."""
    url = url.rstrip("/").replace("https://github.com/", "").replace("http://github.com/", "")
    parts = url.split("/")
    if len(parts) < 2:
        return None, None
    return parts[0], parts[1]


@router.post("/import-github", response_model=ProjectSchema, status_code=status.HTTP_201_CREATED)
def import_project_from_github(body: GithubImportRequest, db: Session = Depends(get_db)):
    url = body.github_url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="GitHub URL is required")

    owner, repo = _parse_github_url(url)
    if not owner or not repo:
        raise HTTPException(status_code=400, detail="Could not parse GitHub URL. Expected: https://github.com/owner/repo")

    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "MyManager/2.0"}

    # Fetch repo metadata
    try:
        repo_res = http_requests.get(f"https://api.github.com/repos/{owner}/{repo}", headers=headers, timeout=10)
        if repo_res.status_code == 404:
            raise HTTPException(status_code=404, detail="GitHub repo not found. Make sure it's public.")
        repo_res.raise_for_status()
        repo_data = repo_res.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {str(e)}")

    # Fetch README
    readme_text = ""
    try:
        readme_res = http_requests.get(
            f"https://api.github.com/repos/{owner}/{repo}/readme",
            headers={**headers, "Accept": "application/vnd.github.v3.raw"},
            timeout=10
        )
        if readme_res.status_code == 200:
            readme_text = readme_res.text[:4000]  # Cap at 4k chars
    except Exception:
        pass  # README is optional

    active_model = get_active_model_name(db)

    if body.is_own_project:
        # Prompt for resume-ready summary
        prompt = f"""Analyze this GitHub repository and write a concise project summary for use in a software engineer's resume.
Also detect the tech stack components.

Repo: {repo_data.get('full_name', '')}
Description: {repo_data.get('description', 'N/A')}
Stars: {repo_data.get('stargazers_count', 0)}
Language: {repo_data.get('language', 'N/A')}
Topics: {', '.join(repo_data.get('topics', []))}
README (excerpt):
{readme_text}

Generate:
- name: A user-friendly project name.
- description: A clear 1-2 sentence description of the project.
- tech_stack: A comma-separated list of technologies, frameworks, and languages used (e.g. "React, FastAPI, PostgreSQL").
- github_summary: A 3-5 sentence professional summary covering: what the project does, key technical achievements, tech stack used, and any notable metrics. Keep it resume-ready."""

        json_schema = '{ "name": "string", "description": "string", "tech_stack": "string", "github_summary": "string" }'

        try:
            json_result = generate_structured_json(prompt, json_schema, model=active_model).strip()
            if json_result.startswith("```"):
                lines = json_result.split("\n")[1:]
                if lines[-1].startswith("```"):
                    lines = lines[:-1]
                json_result = "\n".join(lines).strip()
            ai_data = json.loads(json_result)

            name = ai_data.get("name") or repo_data.get("name") or repo
            description = ai_data.get("description") or repo_data.get("description") or ""
            tech_stack = ai_data.get("tech_stack") or repo_data.get("language") or ""
            github_summary = ai_data.get("github_summary") or repo_data.get("description") or ""
        except Exception as e:
            logger.error(f"Failed to use AI for parsing own repo: {e}")
            name = repo_data.get("name") or repo
            description = repo_data.get("description") or ""
            tech_stack = repo_data.get("language") or ""
            github_summary = repo_data.get("description") or ""

        recreate_steps = ""
    else:
        # Prompt for step-by-step developer tutorial (Others Project)
        prompt = f"""Analyze this GitHub repository metadata and README. Extract details and generate a highly detailed step-by-step developer tutorial on how to recreate this project from scratch.

Repo: {repo_data.get('full_name', '')}
Description: {repo_data.get('description', 'N/A')}
Language: {repo_data.get('language', 'N/A')}
Topics: {', '.join(repo_data.get('topics', []))}
README (excerpt):
{readme_text}

Generate:
- name: A user-friendly project name.
- description: A clear 2-3 sentence overview of what this project does and why it is a great reference for learning.
- tech_stack: A comma-separated list of technologies, frameworks, and languages used (e.g. "React, FastAPI, PostgreSQL").
- recreate_steps: A detailed step-by-step markdown tutorial containing:
  1. System & environment requirements.
  2. Step 1: Initializing the workspace (e.g. folder structure, package/virtual environment setup).
  3. Step 2: Key configurations (e.g. config files, constants).
  4. Step 3: Core database/domain models.
  5. Step 4: Implementing backend logic / API endpoints (with code structure or snippets).
  6. Step 5: Implementing frontend components / client interface.
  7. Step 6: Testing and local verification.
  Be extremely detailed and technical so that a developer can follow this guide to build a similar project from scratch."""

        json_schema = '{ "name": "string", "description": "string", "tech_stack": "string", "recreate_steps": "string" }'

        try:
            json_result = generate_structured_json(prompt, json_schema, model=active_model).strip()
            if json_result.startswith("```"):
                lines = json_result.split("\n")[1:]
                if lines[-1].startswith("```"):
                    lines = lines[:-1]
                json_result = "\n".join(lines).strip()
            ai_data = json.loads(json_result)

            name = ai_data.get("name") or repo_data.get("name") or repo
            description = ai_data.get("description") or repo_data.get("description") or ""
            tech_stack = ai_data.get("tech_stack") or repo_data.get("language") or ""
            recreate_steps = ai_data.get("recreate_steps") or "Failed to generate detailed steps. Please explore repository code."
        except Exception as e:
            logger.error(f"Failed to use AI for parsing others repo: {e}")
            name = repo_data.get("name") or repo
            description = repo_data.get("description") or ""
            tech_stack = repo_data.get("language") or ""
            recreate_steps = f"Repository name: {name}\nDescription: {description}\n\nCould not generate recreate steps due to AI error: {str(e)}"

        github_summary = ""

    # Create the project
    project = Project(
        name=name,
        description=description,
        tech_stack=tech_stack,
        github_url=url,
        github_summary=github_summary,
        recreate_steps=recreate_steps,
        is_own_project=body.is_own_project,
        features_json="[]",
        project_kind="OWN" if body.is_own_project else "LEARNING"
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.post("/{id}/scrape-github", response_model=GithubScrapeResponse)
def scrape_github(id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.github_url:
        raise HTTPException(status_code=400, detail="No GitHub URL set for this project")

    owner, repo = _parse_github_url(project.github_url)
    if not owner or not repo:
        raise HTTPException(status_code=400, detail="Could not parse GitHub URL. Expected: https://github.com/owner/repo")

    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "MyManager/2.0"}

    # Fetch repo metadata
    try:
        repo_res = http_requests.get(f"https://api.github.com/repos/{owner}/{repo}", headers=headers, timeout=10)
        if repo_res.status_code == 404:
            raise HTTPException(status_code=404, detail="GitHub repo not found. Make sure it's public.")
        repo_res.raise_for_status()
        repo_data = repo_res.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {str(e)}")

    # Fetch README
    readme_text = ""
    try:
        readme_res = http_requests.get(
            f"https://api.github.com/repos/{owner}/{repo}/readme",
            headers={**headers, "Accept": "application/vnd.github.v3.raw"},
            timeout=10
        )
        if readme_res.status_code == 200:
            readme_text = readme_res.text[:4000]  # Cap at 4k chars
    except Exception:
        pass  # README is optional

    # Ask NIM to summarize for resume use
    prompt = f"""Analyze this GitHub repository and write a concise project summary for use in a software engineer's resume.

Repo: {repo_data.get('full_name', '')}
Description: {repo_data.get('description', 'N/A')}
Stars: {repo_data.get('stargazers_count', 0)}
Language: {repo_data.get('language', 'N/A')}
Topics: {', '.join(repo_data.get('topics', []))}
README (excerpt):
{readme_text}

Write a 3-5 sentence professional summary covering: what the project does, key technical achievements, tech stack used, and any notable metrics (stars, scale, performance). Keep it resume-ready."""

    active_model = get_active_model_name(db)
    try:
        messages = [
            {"role": "system", "content": "You are a technical resume writer. Be concise, professional, and use strong action verbs."},
            {"role": "user", "content": prompt}
        ]
        summary = chat_with_nvidia_nim(messages, model=active_model, max_tokens=512)
    except Exception as e:
        summary = repo_data.get("description", "No description available.")

    # Persist summary back to project
    project.github_summary = summary
    db.commit()

    return GithubScrapeResponse(
        summary=summary,
        repo_name=repo_data.get("full_name"),
        stars=repo_data.get("stargazers_count"),
        language=repo_data.get("language"),
        topics=repo_data.get("topics", [])
    )


# ─── Wishlist Features ────────────────────────────────────────────────────────

@router.post("/{id}/features", response_model=ProjectSchema)
def add_feature(id: int, body: FeatureRequest, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        features: list = json.loads(project.features_json or "[]")
    except Exception:
        features = []
    if body.feature.strip() and body.feature.strip() not in features:
        features.append(body.feature.strip())
    project.features_json = json.dumps(features)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{id}/features/{feature_index}", response_model=ProjectSchema)
def remove_feature(id: int, feature_index: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        features: list = json.loads(project.features_json or "[]")
    except Exception:
        features = []
    if 0 <= feature_index < len(features):
        features.pop(feature_index)
    project.features_json = json.dumps(features)
    db.commit()
    db.refresh(project)
    return project


# ─── AI Task Generation ───────────────────────────────────────────────────────

@router.post("/{id}/generate-tasks")
def generate_project_tasks(id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    features_list = ""
    try:
        feats = json.loads(project.features_json or "[]")
        if feats:
            features_list = "Wishlist Features: " + ", ".join(feats)
    except Exception:
        pass

    prompt = (
        f"Decompose this software project into concrete development tasks.\n"
        f"Project Name: {project.name}\n"
        f"Description: {project.description}\n"
        f"Tech Stack: {project.tech_stack}\n"
        f"{features_list}\n"
        f"GitHub Summary: {project.github_summary or 'N/A'}\n\n"
        f"Generate 5-8 actionable tasks. Each task should be specific, testable, and scoped to 1-5 days."
    )
    json_schema = '[{"title":"string","description":"string","priority":"LOW/MEDIUM/HIGH","daysToComplete":integer}]'

    try:
        active_model = get_active_model_name(db)
        json_result = generate_structured_json(prompt, json_schema, model=active_model).strip()
        if json_result.startswith("```"):
            lines = json_result.split("\n")[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            json_result = "\n".join(lines).strip()

        gen_tasks = json.loads(json_result)
        for item in gen_tasks:
            days = item.get("daysToComplete", 3)
            if not isinstance(days, int) or days <= 0:
                days = 3
            task = Task(
                project_id=id,
                title=item.get("title", "Untitled Task"),
                description=item.get("description", ""),
                status="TODO",
                priority=item.get("priority", "MEDIUM"),
                due_date=(datetime.now() + timedelta(days=days)).date()
            )
            db.add(task)
        db.commit()
        return {"status": "success", "count": len(gen_tasks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Task Generation failed: {str(e)}")

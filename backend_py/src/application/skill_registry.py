"""Brain-backed skill catalogue used to keep Copilot roles and actions context-aware."""
import json
from pathlib import Path
from typing import Any, Optional

ROOT = Path(__file__).resolve().parents[3]
SKILLS_DIR = ROOT / "Brain" / "skills"

def load_registry() -> list[dict[str, Any]]:
    try:
        return json.loads((SKILLS_DIR / "registry.json").read_text(encoding="utf-8")).get("skills", [])
    except (OSError, json.JSONDecodeError):
        return []

def allowed_skills(page: str, mode: str = "text") -> list[dict[str, Any]]:
    normalized_page = "project_detail" if page.startswith("project") and page != "projects" else page
    return [skill for skill in load_registry()
            if normalized_page in skill.get("allowed_pages", []) and mode in skill.get("allowed_modes", ["text"])]

def resolve_skill(page: str, mode: str, requested_skill: Optional[str]) -> tuple[Optional[dict[str, Any]], list[dict[str, Any]]]:
    available = allowed_skills(page, mode)
    if requested_skill and requested_skill != "auto":
        return next((skill for skill in available if skill["id"] == requested_skill), None), available
    return None, available

def load_skill_instructions(skill: Optional[dict[str, Any]]) -> str:
    if not skill:
        return ""
    try:
        return (SKILLS_DIR / f"{skill['id']}.md").read_text(encoding="utf-8")
    except OSError:
        return ""

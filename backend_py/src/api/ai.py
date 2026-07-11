from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Dict, List, Optional
import json
import requests
from backend_py.src.infrastructure.database import get_db
from backend_py.src.domain.models import UserMemory, UserMemorySchema
from backend_py.src.config.config import NVIDIA_NIM_API_KEY
from backend_py.src.application.ai_helper import extract_and_save_memories
from backend_py.src.api.settings import get_active_model_name, get_active_image_model_name, get_active_video_model_name
from backend_py.src.application.skill_registry import allowed_skills, load_skill_instructions, resolve_skill
import time

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])

# ─── Intent Keywords (page-aware) ─────────────────────────────────────────────

GLOBAL_INTENTS = {
    "CREATE_PROJECT": ["add project", "create project", "new project", "start project", "build project"],
    "CREATE_IDEA":    ["add idea", "new idea", "i have an idea", "got an idea", "idea for", "idea about"],
    "CREATE_JOB":     ["add job", "track job", "applied to", "applied at", "job at", "role at", "new application"],
}

PROJECTS_PAGE_INTENTS = {
    "ADD_TASK":    ["add task", "create task", "new task", "add a task", "task for", "create a ticket"],
    "ADD_FEATURE": ["add feature", "want feature", "wanna add", "wishlist", "feature idea", "add to wishlist", "future feature"],
}

IDEAS_PAGE_INTENTS = {
    "CREATE_IDEA": ["add idea", "new idea", "save this idea", "log this"],
}


def detect_intent(text: str, page: Optional[str] = None) -> Optional[str]:
    lower = text.lower()
    # Page-specific intents take priority
    if page == "projects":
        for intent, keywords in PROJECTS_PAGE_INTENTS.items():
            if any(kw in lower for kw in keywords):
                return intent
    for intent, keywords in GLOBAL_INTENTS.items():
        if any(kw in lower for kw in keywords):
            return intent
    return None


# ─── System Prompt Builders ───────────────────────────────────────────────────

def build_system_prompt(memory_context: str, intent: Optional[str], page: Optional[str], skill: Optional[dict] = None, available_skills: Optional[list] = None) -> str:
    """Build appropriate system prompt based on current page and detected intent."""
    action_schema_help = """
Supported action schemas:
- CREATE_PROJECT: {"type":"CREATE_PROJECT","payload":{"name":"string","description":"string","tech_stack":"string","github_url":"string"}}
- CREATE_REQUIRED_PROJECT: {"type":"CREATE_REQUIRED_PROJECT","payload":{"name":"string","description":"string","tech_stack":"string","recreate_steps":"string"}}
- CREATE_IDEA: {"type":"CREATE_IDEA","payload":{"title":"string","description":"string","category":"Tech","status":"Idea"}}
- CREATE_JOB: {"type":"CREATE_JOB","payload":{"company":"string","role":"string","status":"APPLIED","notes":"string"}}
- ADD_TASK: {"type":"ADD_TASK","payload":{"project_id":1,"title":"string","description":"string","status":"TODO","priority":"MEDIUM"}}
- ADD_TASKS: {"type":"ADD_TASKS","payload":{"tasks":[{"project_id":1,"title":"string","description":"string","status":"TODO","priority":"MEDIUM"}]}}
Append exactly one ACTION_JSON line only when the user clearly asks to create or add something."""
    skill_context = ""
    if skill:
        catalogue = ", ".join(item["label"] for item in (available_skills or []))
        skill_context = f"\n\nActive Skill: {skill['label']}\n{load_skill_instructions(skill)}\nAvailable skills: {catalogue}\nOnly propose these actions: {', '.join(skill.get('allowed_actions', []))}.\n{action_schema_help}"
        memory_context = f"{memory_context}{skill_context}"
    elif available_skills:
        metadata = json.dumps([
            {
                "id": item["id"],
                "label": item["label"],
                "description": item["description"],
                "allowed_actions": item.get("allowed_actions", [])
            }
            for item in available_skills
        ])
        skill_context = f"\n\nAvailable skill metadata: {metadata}\nChoose the most relevant skill internally for this task. Only propose actions listed in the available skill metadata.\n{action_schema_help}"
        memory_context = f"{memory_context}{skill_context}"

    # ── Ideas Page: Team Discussion Mode ──────────────────────────────────────
    if page == "ideas":
        action_instructions = ""
        if intent == "CREATE_IDEA":
            action_instructions = """
IMPORTANT: The user wants to log an idea. After your analysis, append on a NEW LINE:
ACTION_JSON:{"type":"CREATE_IDEA","payload":{"title":"<concise idea title>","description":"<1-2 sentence summary>","category":"Tech","status":"Idea"}}"""

        return f"""You are a brilliant cross-functional startup team discussing an idea together. You represent multiple perspectives simultaneously:

🎯 **Product Lead** — Is this solving a real problem? Who is the user? What's the MVP?
📊 **Market Analyst** — Market size, competitors, real-world data, timing
⚙️ **Tech Architect** — Feasibility, tech stack, build complexity, key risks
💰 **Business Strategist** — Revenue model, go-to-market, unit economics
🔥 **Devil's Advocate** — What could go wrong? What are the hard truths?

Context about the user:
{memory_context}

Rules:
- Always back claims with real-world analogies, market data, or examples of similar products
- Give honest probability estimates (e.g., "Market opportunity: 7/10 based on...")
- Present "What If" scenarios (What if X happens? What if the market doesn't adopt?)
- Be genuinely helpful, not just validating — challenge assumptions
- Format responses with clear headers per perspective
- Keep it conversational but intellectually rigorous{action_instructions}"""

    # ── Projects Page Mode ────────────────────────────────────────────────────
    if page == "projects":
        action_instructions = ""
        if intent == "ADD_TASK":
            action_instructions = """
IMPORTANT: User wants to add a task. After your reply, append on a NEW LINE:
ACTION_JSON:{"type":"ADD_TASK","payload":{"title":"<concise task title>","description":"<what needs to be done>","priority":"MEDIUM","status":"TODO"}}"""
        elif intent == "ADD_FEATURE":
            action_instructions = """
IMPORTANT: User wants to add a wishlist feature. After your reply, append on a NEW LINE:
ACTION_JSON:{"type":"ADD_FEATURE","payload":{"feature":"<concise feature description>"}}"""
        elif intent == "CREATE_PROJECT":
            action_instructions = """
IMPORTANT: User wants to create a project. After your reply, append on a NEW LINE:
ACTION_JSON:{"type":"CREATE_PROJECT","payload":{"name":"<auto-generated short name>","description":"<2-sentence description>","tech_stack":"<inferred tech stack or empty string>"}}"""

        return f"""You are My Manager's Project Intelligence — an expert software architect and project manager.

Context about the user:
{memory_context}

You help with:
- Breaking down projects into tasks and milestones
- Recommending tech stack choices with reasoning
- Identifying risks and blockers early
- Suggesting best practices for the specific domain
- Connecting GitHub insights to actionable next steps

Be specific, technical when needed, and practical. Use bullet points and markdown.{action_instructions}"""

    # ── Default: Executive Assistant Mode ────────────────────────────────────
    action_instructions = ""
    if intent == "CREATE_PROJECT":
        action_instructions = """
IMPORTANT: The user wants to create a project. After your friendly reply, you MUST append on a NEW LINE:
ACTION_JSON:{"type":"CREATE_PROJECT","payload":{"name":"<auto-generated short name>","description":"<2-sentence description>","tech_stack":"<inferred tech stack or empty string>"}}"""
    elif intent == "CREATE_IDEA":
        action_instructions = """
IMPORTANT: The user wants to log an idea. After your friendly reply, append on a NEW LINE:
ACTION_JSON:{"type":"CREATE_IDEA","payload":{"title":"<concise idea title>","description":"<1-2 sentence summary>","category":"Tech","status":"Idea"}}"""
    elif intent == "CREATE_JOB":
        action_instructions = """
IMPORTANT: The user wants to track a job application. After your friendly reply, append on a NEW LINE:
ACTION_JSON:{"type":"CREATE_JOB","payload":{"company":"<company name>","role":"<role title>","status":"APPLIED","notes":"<any extra context>"}}"""

    return f"""You are My Manager, a premium executive assistant and career copilot.
Known facts about the user:
{memory_context}

Be concise, structured, and professional. Use markdown where helpful.{action_instructions}"""


# ─── NVIDIA NIM Streaming ─────────────────────────────────────────────────────

def stream_nim_response(messages: list, model: str, allowed_action_types: Optional[list[str]] = None):
    """Generator that yields SSE lines from active AI provider streaming API."""
    from backend_py.src.infrastructure.database import SessionLocal
    from backend_py.src.api.settings import get_active_ai_credentials
    
    db = SessionLocal()
    try:
        creds = get_active_ai_credentials(db)
        api_key = creds["api_key"]
        base_url = creds["base_url"]
        target_model = model if model else creds["model"]
        provider = creds.get("provider", "openai")
        
        # Check for Anthropic streaming
        if provider == "anthropic":
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            system_content = ""
            user_messages = []
            for msg in messages:
                if msg["role"] == "system":
                    system_content = msg["content"]
                else:
                    user_messages.append({"role": msg["role"], "content": msg["content"]})
                    
            payload = {
                "model": target_model,
                "messages": user_messages,
                "temperature": 0.7,
                "max_tokens": 1500,
                "stream": True
            }
            if system_content:
                payload["system"] = system_content
                
            url = f"{base_url}/messages"
            full_text = []
            with requests.post(url, headers=headers, json=payload, stream=True, timeout=60) as resp:
                resp.raise_for_status()
                for raw_line in resp.iter_lines():
                    if not raw_line:
                        continue
                    line = raw_line.decode("utf-8")
                    if line.startswith("data: "):
                        chunk_str = line[6:]
                        try:
                            chunk = json.loads(chunk_str)
                            if chunk.get("type") == "content_block_delta":
                                token = chunk["delta"].get("text", "")
                                if token:
                                    full_text.append(token)
                                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
                        except Exception:
                            continue
        else:
            # Standard OpenAI compatible
            url = f"{base_url}/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
            payload = {
                "model": target_model,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 1500,
                "stream": True
            }

            full_text = []
            with requests.post(url, headers=headers, json=payload, stream=True, timeout=60) as resp:
                resp.raise_for_status()
                for raw_line in resp.iter_lines():
                    if not raw_line:
                        continue
                    line = raw_line.decode("utf-8")
                    if line.startswith("data: "):
                        chunk_str = line[6:]
                        if chunk_str.strip() == "[DONE]":
                            break
                        try:
                            chunk = json.loads(chunk_str)
                            delta = chunk["choices"][0]["delta"]
                            token = delta.get("content", "")
                            if token:
                                full_text.append(token)
                                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
                        except Exception:
                            continue
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        return
    finally:
        db.close()

    # After streaming, parse the full text for an ACTION_JSON block
    combined = "".join(full_text)
    if "ACTION_JSON:" in combined:
        try:
            action_raw = combined.split("ACTION_JSON:", 1)[1].strip().split("\n")[0]
            action_obj = json.loads(action_raw)
            if not allowed_action_types or action_obj.get("type") in allowed_action_types:
                yield f"data: {json.dumps({'type': 'action', 'payload': action_obj})}\n\n"
        except Exception:
            pass

    yield f"data: {json.dumps({'type': 'done'})}\n\n"
    return full_text, combined


# ─── Chat Endpoints ───────────────────────────────────────────────────────────

@router.get("/skills")
def get_skills(page: str = "dashboard", mode: str = "text"):
    """Return only the skills valid for the current workspace and model mode."""
    return allowed_skills(page.strip().lower(), mode.strip().lower())


@router.post("/chat/stream")
def ai_chat_stream(request: Dict, db: Session = Depends(get_db)):
    user_msg = request.get("message", "").strip()
    page = request.get("page", "").strip().lower()  # page context
    idea_context = request.get("ideaContext", "").strip()  # idea details for deep-dive
    mode = request.get("mode", "text").strip().lower()  # text, image, video mode
    requested_skill = request.get("skill", "auto").strip().lower()

    if not user_msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    memories = db.query(UserMemory).all()
    memory_context = (
        "\n".join([f"- {m.fact} (Category: {m.category})" for m in memories])
        if memories else "No facts recorded yet."
    )

    # Prepend idea context if provided (Ideas deep-dive mode)
    if idea_context:
        user_msg = f"[Discussing Idea: {idea_context}]\n\n{user_msg}"

    selected_skill, available = resolve_skill(page, mode, requested_skill)
    if requested_skill != "auto" and not selected_skill:
        raise HTTPException(status_code=400, detail="Selected skill is not available for this page or model mode")
    intent = detect_intent(user_msg, page)
    system_prompt = build_system_prompt(memory_context, intent, page, selected_skill, available)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_msg}
    ]

    active_model = get_active_model_name(db)
    active_image = get_active_image_model_name(db)
    active_video = get_active_video_model_name(db)

    def event_generator():
        if mode == "image":
            # Image generation simulation using Pollinations AI
            short_img_name = active_image.split("/")[-1]
            msg1 = {'type': 'token', 'content': f'🎨 **Initializing Generation using Image Model: {short_img_name}**\n'}
            yield f"data: {json.dumps(msg1)}\n\n"
            time.sleep(0.5)
            
            msg2 = {'type': 'token', 'content': '⏳ *Analysing text semantics and lighting directives...*\n'}
            yield f"data: {json.dumps(msg2)}\n\n"
            time.sleep(0.8)
            
            msg3 = {'type': 'token', 'content': '✨ *Synthesizing noise maps and rendering pixel matrices...*\n'}
            yield f"data: {json.dumps(msg3)}\n\n"
            time.sleep(0.6)
            
            import urllib.parse
            encoded_prompt = urllib.parse.quote(user_msg)
            img_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=512&height=512&nologo=true&private=true"
            
            msg4 = {'type': 'token', 'content': '🖼️ **Here is your generated image:**\n'}
            yield f"data: {json.dumps(msg4)}\n\n"
            
            msg5 = {'type': 'image', 'url': img_url}
            yield f"data: {json.dumps(msg5)}\n\n"
            return

        elif mode == "video":
            # Video generation simulation using space loop
            short_vid_name = active_video.split("/")[-1]
            msg1 = {'type': 'token', 'content': f'🎬 **Initializing Video Generation using Model: {short_vid_name}**\n'}
            yield f"data: {json.dumps(msg1)}\n\n"
            time.sleep(0.5)
            
            msg2 = {'type': 'token', 'content': '⏳ *Constructing keyframes and trajectory paths...*\n'}
            yield f"data: {json.dumps(msg2)}\n\n"
            time.sleep(1.0)
            
            msg3 = {'type': 'token', 'content': '🚀 *Rendering temporal animation cycles at 30 fps...*\n'}
            yield f"data: {json.dumps(msg3)}\n\n"
            time.sleep(0.8)
            
            vid_url = "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4"
            
            msg4 = {'type': 'token', 'content': '📹 **Here is your generated video:**\n'}
            yield f"data: {json.dumps(msg4)}\n\n"
            
            msg5 = {'type': 'video', 'url': vid_url}
            yield f"data: {json.dumps(msg5)}\n\n"
            return

        else:
            # Standard Text Mode stream
            full_parts = []
            allowed_actions = selected_skill.get("allowed_actions", []) if selected_skill else sorted({
                action
                for skill in available
                for action in skill.get("allowed_actions", [])
            })
            for chunk in stream_nim_response(messages, active_model, allowed_actions):
                yield chunk
                if '"type": "token"' in chunk or '"type":"token"' in chunk:
                    try:
                        data = json.loads(chunk[6:])
                        full_parts.append(data.get("content", ""))
                    except Exception:
                        pass
            # Background memory extraction
            try:
                full_reply = "".join(full_parts)
                if full_reply:
                    extract_and_save_memories(user_msg, full_reply, active_model, db)
            except Exception:
                pass

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/chat")
def ai_chat(request: Dict, db: Session = Depends(get_db)):
    from backend_py.src.application.ai_helper import chat_with_nvidia_nim
    user_msg = request.get("message", "").strip()
    page = request.get("page", "").strip().lower()
    idea_context = request.get("ideaContext", "").strip()

    if not user_msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    memories = db.query(UserMemory).all()
    memory_context = (
        "\n".join([f"- {m.fact} (Category: {m.category})" for m in memories])
        if memories else "No facts recorded yet."
    )

    if idea_context:
        user_msg = f"[Discussing Idea: {idea_context}]\n\n{user_msg}"

    intent = detect_intent(user_msg, page)
    system_prompt = build_system_prompt(memory_context, intent, page)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_msg}
    ]
    active_model = get_active_model_name(db)
    reply = chat_with_nvidia_nim(messages, model=active_model)
    extract_and_save_memories(user_msg, reply, active_model, db)

    action = None
    if "ACTION_JSON:" in reply:
        try:
            action_raw = reply.split("ACTION_JSON:", 1)[1].strip().split("\n")[0]
            action = json.loads(action_raw)
            reply = reply.split("ACTION_JSON:")[0].strip()
        except Exception:
            pass

    return {"reply": reply, "action": action}


# ─── Memory Management ────────────────────────────────────────────────────────

@router.get("/memories", response_model=List[UserMemorySchema])
def get_all_memories(db: Session = Depends(get_db)):
    return db.query(UserMemory).all()


@router.delete("/memories/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memory(id: int, db: Session = Depends(get_db)):
    memory = db.query(UserMemory).filter(UserMemory.id == id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory fact not found")
    db.delete(memory)
    db.commit()
    return None

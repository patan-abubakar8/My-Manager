import logging
import json
import requests
from sqlalchemy.orm import Session
from backend_py.src.config.config import NVIDIA_NIM_API_KEY, DEFAULT_MODEL
from backend_py.src.domain.models import UserMemory

logger = logging.getLogger(__name__)

def chat_with_nvidia_nim(messages: list, model: str = None, temperature: float = 0.7, max_tokens: int = 2048) -> str:
    from backend_py.src.infrastructure.database import SessionLocal
    from backend_py.src.api.settings import get_active_ai_credentials
    
    db = SessionLocal()
    try:
        creds = get_active_ai_credentials(db)
        provider = creds["provider"]
        api_key = creds["api_key"]
        base_url = creds["base_url"]
        target_model = model if model else creds["model"]
        
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
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            if system_content:
                payload["system"] = system_content
                
            response = requests.post(f"{base_url}/messages", headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"]
        else:
            url = f"{base_url}/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
            payload = {
                "model": target_model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"Error calling AI completions API: {e}")
        raise RuntimeError(f"AI API call failed: {e}")
    finally:
        db.close()

def generate_structured_json(prompt_text: str, json_schema: str, model: str = DEFAULT_MODEL) -> str:
    system_instruction = (
        "You are a structured data generator. You must output ONLY a valid JSON string matching this schema: "
        f"{json_schema}. Do not include markdown code block formatting (like ```json), introduction, or summary. Just pure JSON."
    )
    
    messages = [
        {"role": "system", "content": system_instruction},
        {"role": "user", "content": prompt_text}
    ]
    
    return chat_with_nvidia_nim(messages, model=model, temperature=0.1, max_tokens=2048)

def extract_and_save_memories(user_msg: str, assistant_reply: str, model: str, db: Session):
    try:
        extraction_prompt = f"""Analyze the following conversation segment. Extract any new, concrete facts about the user's technology stack, career goals, personal settings, or project details.
        
        User: {user_msg}
        Assistant: {assistant_reply}
        
        If a new fact is discovered, summarize it as a single concise sentence (e.g. "User is learning Golang" or "User is looking for remote backend developer roles").
        If multiple facts exist, separate them with newlines.
        If NO new fact, preference, or goal is found, reply with exactly 'NONE'.
        Do not add any other explanations.
        """
        
        messages = [{"role": "user", "content": extraction_prompt}]
        result = chat_with_nvidia_nim(messages, model=model, temperature=0.1, max_tokens=1024).strip()
        
        if result.upper() != "NONE" and result:
            lines = result.split("\n")
            for line in lines:
                clean_fact = line.replace("-", "").strip()
                if clean_fact and len(clean_fact) > 5:
                    memory = UserMemory(fact=clean_fact, category="extracted")
                    db.add(memory)
            db.commit()
            logger.info("Successfully extracted and saved memories")
    except Exception as e:
        logger.error(f"Failed to extract memory from conversation: {e}")

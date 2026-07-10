from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict
import requests
from backend_py.src.infrastructure.database import get_db
from backend_py.src.domain.models import SystemSetting
from backend_py.src.config.config import NVIDIA_NIM_API_KEY

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

ACTIVE_MODEL_KEY = "active_model"
DEFAULT_MODEL = "meta/llama-3.1-8b-instruct"

ACTIVE_IMAGE_MODEL_KEY = "active_image_model"
DEFAULT_IMAGE_MODEL = "nvidia/vila"

ACTIVE_VIDEO_MODEL_KEY = "active_video_model"
DEFAULT_VIDEO_MODEL = "adept/fuyu-8b"

def get_active_model_name(db: Session) -> str:
    setting = db.query(SystemSetting).filter(SystemSetting.setting_key == ACTIVE_MODEL_KEY).first()
    return setting.setting_value if setting else DEFAULT_MODEL

def get_active_image_model_name(db: Session) -> str:
    setting = db.query(SystemSetting).filter(SystemSetting.setting_key == ACTIVE_IMAGE_MODEL_KEY).first()
    return setting.setting_value if setting else DEFAULT_IMAGE_MODEL

def get_active_video_model_name(db: Session) -> str:
    setting = db.query(SystemSetting).filter(SystemSetting.setting_key == ACTIVE_VIDEO_MODEL_KEY).first()
    return setting.setting_value if setting else DEFAULT_VIDEO_MODEL

@router.get("")
def get_all_settings(db: Session = Depends(get_db)):
    return db.query(SystemSetting).all()

@router.post("")
def save_setting(request: Dict[str, str], db: Session = Depends(get_db)):
    key = request.get("key")
    value = request.get("value")
    if not key or value is None:
        raise HTTPException(status_code=400, detail="Key and Value are required")
    
    setting = db.query(SystemSetting).filter(SystemSetting.setting_key == key).first()
    if setting:
        setting.setting_value = value
    else:
        setting = SystemSetting(setting_key=key, setting_value=value)
        db.add(setting)
    db.commit()
    return {"status": "success"}

def get_ai_provider(db: Session) -> str:
    setting = db.query(SystemSetting).filter(SystemSetting.setting_key == "ai_provider").first()
    return setting.setting_value if setting else "nvidia"
    
def get_ai_api_key(db: Session, provider: str = None) -> str:
    if not provider:
        provider = get_ai_provider(db)
    setting = db.query(SystemSetting).filter(SystemSetting.setting_key == f"ai_api_key_{provider}").first()
    if setting and setting.setting_value:
        return setting.setting_value
    # Fallback to generic key
    setting = db.query(SystemSetting).filter(SystemSetting.setting_key == "ai_api_key").first()
    return setting.setting_value if setting else ""
    
def get_ai_base_url(db: Session, provider: str = None) -> str:
    if not provider:
        provider = get_ai_provider(db)
    setting = db.query(SystemSetting).filter(SystemSetting.setting_key == f"ai_base_url_{provider}").first()
    if setting and setting.setting_value:
        return setting.setting_value
    # Fallback to generic URL
    setting = db.query(SystemSetting).filter(SystemSetting.setting_key == "ai_base_url").first()
    return setting.setting_value if setting else ""

def get_active_ai_credentials(db: Session) -> Dict[str, str]:
    """Resolve active AI provider, API key, base URL, and active text model name."""
    provider = get_ai_provider(db)
    api_key = get_ai_api_key(db, provider)
    base_url = get_ai_base_url(db, provider)
    model = get_active_model_name(db)
    
    # Resolve default base URLs if empty
    if not base_url:
        if provider == "openai":
            base_url = "https://api.openai.com/v1"
        elif provider == "gemini":
            base_url = "https://generativelanguage.googleapis.com/v1beta/openai"
        elif provider == "xai" or provider == "grok":
            base_url = "https://api.x.ai/v1"
        elif provider == "anthropic":
            base_url = "https://api.anthropic.com/v1"
        elif provider == "ollama":
            base_url = "http://localhost:11434/v1"
        elif provider == "zai":
            base_url = "https://api.zai.ai/v1"
        else: # nvidia
            base_url = "https://integrate.api.nvidia.com/v1"
            
    # Resolve fallback keys from env if settings are empty
    if not api_key:
        import os
        if provider == "nvidia":
            api_key = os.environ.get("NVIDIA_NIM_API_KEY", "")
        elif provider == "openai":
            api_key = os.environ.get("OPENAI_API_KEY", "")
        elif provider == "gemini":
            api_key = os.environ.get("GEMINI_API_KEY", "")
        elif provider == "xai" or provider == "grok":
            api_key = os.environ.get("XAI_API_KEY", "")
        elif provider == "anthropic":
            api_key = os.environ.get("ANTHROPIC_API_KEY", "")
            
    return {
        "provider": provider,
        "api_key": api_key,
        "base_url": base_url,
        "model": model
    }

@router.get("/model")
def get_active_models(db: Session = Depends(get_db)):
    providers = ["nvidia", "openai", "gemini", "xai", "grok", "anthropic", "ollama", "zai", "custom"]
    provider_keys = {}
    provider_urls = {}
    for p in providers:
        key_setting = db.query(SystemSetting).filter(SystemSetting.setting_key == f"ai_api_key_{p}").first()
        url_setting = db.query(SystemSetting).filter(SystemSetting.setting_key == f"ai_base_url_{p}").first()
        provider_keys[p] = key_setting.setting_value if key_setting else ""
        provider_urls[p] = url_setting.setting_value if url_setting else ""

    return {
        "text_model": get_active_model_name(db),
        "image_model": get_active_image_model_name(db),
        "video_model": get_active_video_model_name(db),
        "ai_provider": get_ai_provider(db),
        "ai_api_key": get_ai_api_key(db),
        "ai_base_url": get_ai_base_url(db),
        "provider_keys": provider_keys,
        "provider_urls": provider_urls
    }

@router.post("/model")
def update_active_models(request: Dict, db: Session = Depends(get_db)):
    text_model = request.get("text_model")
    image_model = request.get("image_model")
    video_model = request.get("video_model")
    ai_provider = request.get("ai_provider")
    ai_api_key = request.get("ai_api_key")
    ai_base_url = request.get("ai_base_url")
    provider_keys = request.get("provider_keys", {})
    provider_urls = request.get("provider_urls", {})
    
    if text_model:
        setting = db.query(SystemSetting).filter(SystemSetting.setting_key == ACTIVE_MODEL_KEY).first()
        if setting:
            setting.setting_value = text_model
        else:
            db.add(SystemSetting(setting_key=ACTIVE_MODEL_KEY, setting_value=text_model))
            
    if image_model:
        setting = db.query(SystemSetting).filter(SystemSetting.setting_key == ACTIVE_IMAGE_MODEL_KEY).first()
        if setting:
            setting.setting_value = image_model
        else:
            db.add(SystemSetting(setting_key=ACTIVE_IMAGE_MODEL_KEY, setting_value=image_model))
            
    if video_model:
        setting = db.query(SystemSetting).filter(SystemSetting.setting_key == ACTIVE_VIDEO_MODEL_KEY).first()
        if setting:
            setting.setting_value = video_model
        else:
            db.add(SystemSetting(setting_key=ACTIVE_VIDEO_MODEL_KEY, setting_value=video_model))
            
    if ai_provider is not None:
        setting = db.query(SystemSetting).filter(SystemSetting.setting_key == "ai_provider").first()
        if setting:
            setting.setting_value = ai_provider
        else:
            db.add(SystemSetting(setting_key="ai_provider", setting_value=ai_provider))
            
    if ai_api_key is not None:
        setting = db.query(SystemSetting).filter(SystemSetting.setting_key == "ai_api_key").first()
        if setting:
            setting.setting_value = ai_api_key
        else:
            db.add(SystemSetting(setting_key="ai_api_key", setting_value=ai_api_key))
            
        provider = ai_provider or get_ai_provider(db)
        spec_setting = db.query(SystemSetting).filter(SystemSetting.setting_key == f"ai_api_key_{provider}").first()
        if spec_setting:
            spec_setting.setting_value = ai_api_key
        else:
            db.add(SystemSetting(setting_key=f"ai_api_key_{provider}", setting_value=ai_api_key))
            
    if ai_base_url is not None:
        setting = db.query(SystemSetting).filter(SystemSetting.setting_key == "ai_base_url").first()
        if setting:
            setting.setting_value = ai_base_url
        else:
            db.add(SystemSetting(setting_key="ai_base_url", setting_value=ai_base_url))
            
        provider = ai_provider or get_ai_provider(db)
        spec_setting = db.query(SystemSetting).filter(SystemSetting.setting_key == f"ai_base_url_{provider}").first()
        if spec_setting:
            spec_setting.setting_value = ai_base_url
        else:
            db.add(SystemSetting(setting_key=f"ai_base_url_{provider}", setting_value=ai_base_url))

    for p, val in provider_keys.items():
        spec_setting = db.query(SystemSetting).filter(SystemSetting.setting_key == f"ai_api_key_{p}").first()
        if spec_setting:
            spec_setting.setting_value = val
        else:
            db.add(SystemSetting(setting_key=f"ai_api_key_{p}", setting_value=val))
            
    for p, val in provider_urls.items():
        spec_setting = db.query(SystemSetting).filter(SystemSetting.setting_key == f"ai_base_url_{p}").first()
        if spec_setting:
            spec_setting.setting_value = val
        else:
            db.add(SystemSetting(setting_key=f"ai_base_url_{p}", setting_value=val))
            
    db.commit()
    return get_active_models(db)

@router.get("/nim-models")
def get_nim_models(db: Session = Depends(get_db)):
    """Fetch available models based on active provider, using prefilled catalogs or API calls."""
    provider = get_ai_provider(db)
    api_key = get_ai_api_key(db, provider)
    base_url = get_ai_base_url(db, provider)
    
    if not base_url:
        if provider == "openai":
            base_url = "https://api.openai.com/v1"
        elif provider == "gemini":
            base_url = "https://generativelanguage.googleapis.com/v1beta/openai"
        elif provider == "xai" or provider == "grok":
            base_url = "https://api.x.ai/v1"
        elif provider == "anthropic":
            base_url = "https://api.anthropic.com/v1"
        elif provider == "ollama":
            base_url = "http://localhost:11434/v1"
        elif provider == "zai":
            base_url = "https://api.zai.ai/v1"
        else: # nvidia
            base_url = "https://integrate.api.nvidia.com/v1"
            
    if not api_key:
        import os
        if provider == "nvidia":
            api_key = os.environ.get("NVIDIA_NIM_API_KEY", "")
        elif provider == "openai":
            api_key = os.environ.get("OPENAI_API_KEY", "")
        elif provider == "gemini":
            api_key = os.environ.get("GEMINI_API_KEY", "")
        elif provider == "xai" or provider == "grok":
            api_key = os.environ.get("XAI_API_KEY", "")
        elif provider == "anthropic":
            api_key = os.environ.get("ANTHROPIC_API_KEY", "")
            
    # Quick defaults for well-known providers to avoid rate limits / network wait
    if provider == "openai":
        return {
            "text_models": ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo", "o1-mini", "o1-preview"],
            "image_models": ["dall-e-3", "dall-e-2"],
            "video_models": ["sora-1.0-preview", "none"]
        }
    elif provider == "gemini":
        return {
            "text_models": ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"],
            "image_models": ["imagen-3.0-generate-002"],
            "video_models": ["none"]
        }
    elif provider == "xai" or provider == "grok":
        return {
            "text_models": ["grok-beta", "grok-vision-beta", "grok-2"],
            "image_models": ["grok-vision-beta"],
            "video_models": ["none"]
        }
    elif provider == "anthropic":
        return {
            "text_models": ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
            "image_models": ["none"],
            "video_models": ["none"]
        }
    elif provider == "ollama":
        return {
            "text_models": ["llama3", "mistral", "qwen2.5-coder", "phi3"],
            "image_models": ["none"],
            "video_models": ["none"]
        }
    elif provider == "zai":
        return {
            "text_models": ["zai-general", "zai-coder"],
            "image_models": ["none"],
            "video_models": ["none"]
        }
    elif provider == "custom":
        if api_key and base_url:
            try:
                headers = {"Authorization": f"Bearer {api_key}"}
                response = requests.get(f"{base_url}/models", headers=headers, timeout=5)
                if response.ok:
                    data = response.json()
                    models = [m["id"] for m in data.get("data", []) if "id" in m]
                    if models:
                        return {
                            "text_models": models,
                            "image_models": ["custom-image-model"],
                            "video_models": ["custom-video-model"]
                        }
            except Exception:
                pass
        return {
            "text_models": ["custom-text-model"],
            "image_models": ["custom-image-model"],
            "video_models": ["custom-video-model"]
        }
        
    # NVIDIA NIM Dynamic Fetching
    url = f"{base_url}/models"
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    else:
        headers["Authorization"] = f"Bearer {NVIDIA_NIM_API_KEY}"
        
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        all_models = [m["id"] for m in data.get("data", []) if "id" in m]
        
        text_exclude = [
            "embed", "rerank", "vlm", "clip", "translation", "tts", "stt", "whisper", 
            "sdxl", "stable-diffusion", "neva", "kosmos", "fuyu", "vila", "deberta", 
            "mimic", "docking", "molmim", "esmfold", "diffdock", "audio", "voice", "image", "classify"
        ]
        text_include = ["instruct", "chat", "large", "it", "preview", "playground", "command", "yi-"]
        text_filtered = []
        for m in all_models:
            id_lower = m.lower()
            if any(k in id_lower for k in text_exclude):
                continue
            if any(k in id_lower for k in text_include):
                text_filtered.append(m)
        priority_text = [
            "meta/llama-3.1-8b-instruct",
            "meta/llama-3.1-70b-instruct",
            "nvidia/llama-3.1-nemotron-70b-instruct"
        ]
        text_rem = sorted([m for m in text_filtered if m not in priority_text])
        text_list = priority_text + text_rem
        
        image_include = ["diffusion", "sdxl", "stable-diffusion", "image", "playground", "neva", "vila", "fuyu", "kosmos", "align", "paligemma"]
        image_filtered = []
        for m in all_models:
            id_lower = m.lower()
            if any(k in id_lower for k in image_include) and not any(k in id_lower for k in ["rerank", "embed"]):
                image_filtered.append(m)
        image_list = sorted(image_filtered)
        if not image_list:
            image_list = ["nvidia/vila", "nvidia/neva-22b", "microsoft/kosmos-2", "adept/fuyu-8b"]
            
        video_include = ["video", "fuyu", "sora", "cogvideo", "luma", "runway", "gen2"]
        video_filtered = []
        for m in all_models:
            id_lower = m.lower()
            if any(k in id_lower for k in video_include) and not any(k in id_lower for k in ["rerank", "embed"]):
                video_filtered.append(m)
        video_list = sorted(video_filtered)
        if not video_list:
            video_list = ["adept/fuyu-8b", "nvidia/ai-synthetic-video-detector"]
            
        return {
            "text_models": text_list,
            "image_models": image_list,
            "video_models": video_list
        }
    except Exception as e:
        return {
            "error": str(e),
            "text_models": [
                "meta/llama-3.1-8b-instruct",
                "meta/llama-3.1-70b-instruct",
                "nvidia/llama-3.1-nemotron-70b-instruct"
            ],
            "image_models": ["nvidia/vila", "nvidia/neva-22b", "microsoft/kosmos-2", "adept/fuyu-8b"],
            "video_models": ["adept/fuyu-8b", "nvidia/ai-synthetic-video-detector"]
        }

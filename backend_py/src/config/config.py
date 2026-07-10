import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL", 
    "postgresql://postgres:Abu%40king8@localhost:5432/mymanager"
)
if DATABASE_URL:
    DATABASE_URL = DATABASE_URL.strip()

NVIDIA_NIM_API_KEY = os.environ.get(
    "NVIDIA_NIM_API_KEY",
    "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"
)
if NVIDIA_NIM_API_KEY:
    NVIDIA_NIM_API_KEY = NVIDIA_NIM_API_KEY.strip()

DEFAULT_MODEL = "meta/llama-3.1-8b-instruct"
PORT = 8080

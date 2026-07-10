import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Use absolute imports since we run from workspace root
from backend_py.src.api import settings, projects, tasks, jobs, resumes, ai, ideas

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create any missing DB tables on startup (idempotent)
    from backend_py.src.infrastructure.database import create_tables
    create_tables()
    yield

app = FastAPI(
    title="My Manager API",
    version="2.0.0",
    description="Python FastAPI backend for the My Manager application.",
    lifespan=lifespan
)

# CORS matching the original Spring Boot wildcard config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Mount all routers
app.include_router(settings.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(jobs.router)
app.include_router(resumes.router)
app.include_router(ai.router)
app.include_router(ideas.router)

@app.get("/")
def root():
    return {"message": "My Manager Python FastAPI Backend is active!", "version": "2.0.0"}

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("backend_py.server:app", host="0.0.0.0", port=8080, reload=True)

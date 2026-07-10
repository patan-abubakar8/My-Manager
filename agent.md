# 🤖 AI Agent Developer Onboarding Guide

Welcome! If you are an AI assistant working on the **MyManager** workspace, read this guide to understand the architecture, code conventions, core rules, and implementation context.

---

## 🛑 MANDATORY FIRST STEP: Read the Progress Log
Before making any changes, writing any code, or introducing new files, you **MUST** read [progress.log](file:///c:/Users/patan/Downloads/My%20Projects/MyManager/progress.log) at the project root. This log lists every feature addition, structural refactoring, and database schema change made since project creation.

---

## 🏗️ Folder Architecture

We follow a strict, highly scalable architecture for both components:

### Backend: Clean Architecture (`backend_py/src/`)
- **`api/`** (Controllers): FastAPI endpoints and routers (projects, tasks, resumes, settings, jobs, ideas, ai).
- **`application/`** (Use Cases): Business rules and orchestrators (e.g. `ai_helper.py` prompt generators and parsers).
- **`domain/`** (Entities): Core database model classes and validation Pydantic schemas (`models.py`).
- **`infrastructure/`** (External interfaces): SQLAlchemy engine setup, database session provider (`database.py`), and schema migrations.
- **`config/`** (Settings): Environmental variables and static configurations (`config.py`).
- **`tests/`**: Automated integration script runner (`test_import.py`).
- **`shared/`**: Helper methods and utility tools.
- **`server.py`**: Mounts router modules and initializes the lifespan hook.

*Always import modules using absolute paths from the root package (e.g., `from backend_py.src.infrastructure.database import get_db`).*

### Frontend: Modular Layout (`frontend/src/`)
- **`assets/`**: Logos, images, and static graphics.
- **`components/`**: Decoupled, reusable interface elements (e.g., `ToastNotification.tsx`).
- **`layouts/`**: View wrapping components (e.g., `NavigationLayout.tsx` which contains the sidebar menu and the Copilot chat drawer).
- **`pages/`**: Primary app views (Dashboard, Projects, Applications, ResumeCreator, Ideas, Social, Settings).
- **`styles/`**: Custom stylesheets (`index.css` global design rules, `App.css` layout constraints).
- **`App.tsx`**: Route coordinator registering pages.
- **`main.tsx`**: React DOM mounting entry.

---

## ⚡ Core Engineering & UI Constraints

1. **NO Alert Boxes**: Do not use native window `alert(...)` calls anywhere. Instead, use the global custom toast framework. Call:
   ```typescript
   (window as any).showToast("Your message text here", "success" | "error" | "info");
   ```
2. **Database Schema**:
   - PostgreSQL runs on port `5432`.
   - SQLite/SQLAlchemy handles automated connection setup.
   - All models inherit `BaseAuditEntity` containing `created_at` and `updated_at` timestamps.
3. **AI Copilot Integration**:
   - The assistant stream uses Server-Sent Events (SSE) via the `/api/v1/ai/chat/stream` path.
   - Features intent detection: returns `action` JSON schemas matching `CREATE_PROJECT`, `CREATE_JOB`, `CREATE_IDEA`, or `ADD_TASK` to render confirmation cards. Sonu must confirm before DB insertion is called.
   - Background compiling compiles facts from chats and commits them to `user_memories`.
4. **FastAPI & React Ports**:
   - Backend API: `http://localhost:8080` (Swagger docs at `/docs`).
   - Frontend Vite: `http://localhost:5173`.
   - Run both concurrently on Windows using [run_app.bat](file:///c:/Users/patan/Downloads/My%20Projects/MyManager/run_app.bat).

# 🧠 MyManager — AI-Powered Personal Life & Career Command Center

> Your personal executive assistant that manages projects, tracks job applications, generates tailored resumes, captures ideas, and has an AI copilot — all in one place.

![Version](https://img.shields.io/badge/version-2.0.0-blueviolet)
![Backend](https://img.shields.io/badge/backend-FastAPI%20%7C%20Python-009688)
![Frontend](https://img.shields.io/badge/frontend-React%2019%20%7C%20TypeScript-61DAFB)
![AI](https://img.shields.io/badge/AI-NVIDIA%20NIM%20%7C%20Llama%203.1%2070B-76B900)
![DB](https://img.shields.io/badge/database-PostgreSQL-336791)

---

## 📖 Overview

**MyManager** is a full-stack personal productivity application built for developers, engineers, and job seekers who want an intelligent, unified workspace. It combines classic task & project management with AI-driven career tools — all powered by a local PostgreSQL database and NVIDIA NIM's LLM API.

### What it does at a glance

| Feature | Description |
|---|---|
| 📊 **Dashboard** | At-a-glance stats: projects, tasks, job applications, ideas |
| 📁 **Projects & Tasks** | Kanban-style task management within projects |
| 💼 **Job Applications** | Track company, role, status, salary, and notes |
| 📄 **Resume Creator** | AI-tailored resumes and cover letters per job |
| 💡 **Ideas Board** | Capture and categorize ideas (Tech / Business / Life) |
| 🤖 **AI Copilot** | Streaming chat assistant with memory and intent detection |
| ⚙️ **Settings** | Switch AI model, manage memories, and configure preferences |

---

## 🏗️ Architecture

\\\
MyManager/
├── backend_py/              # Python FastAPI backend
│   ├── src/                 # Clean Architecture source directory
│   │   ├── api/             # Controllers / Routers (entry points)
│   │   │   ├── ai.py
│   │   │   ├── ideas.py
│   │   │   ├── jobs.py
│   │   │   ├── projects.py
│   │   │   ├── resumes.py
│   │   │   ├── settings.py
│   │   │   └── tasks.py
│   │   ├── application/     # Business logic / AI services (use cases)
│   │   │   └── ai_helper.py
│   │   ├── domain/          # Core entities, models, and schemas
│   │   │   └── models.py
│   │   ├── infrastructure/  # DB handling, migrations, external APIs
│   │   │   ├── database.py
│   │   │   └── migrate_columns.py
│   │   ├── config/          # Environment configurations & variables
│   │   │   └── config.py
│   │   ├── tests/           # Integration & unit tests
│   │   │   └── test_import.py
│   │   ├── shared/          # Utility scripts, helpers
│   │   └── server.py        # App initialization & router mounting
│   ├── requirements.txt     # Python dependencies
│   └── .venv/               # Python virtual environment
│
├── frontend/                # React + TypeScript frontend (Vite)
│   ├── src/
│   │   ├── assets/          # Static assets (images, icons)
│   │   ├── components/      # Common reusable UI components (ToastNotification.tsx)
│   │   ├── layouts/         # Screen containers (NavigationLayout.tsx)
│   │   ├── pages/           # Page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Projects.tsx
│   │   │   ├── Applications.tsx
│   │   │   ├── ResumeCreator.tsx
│   │   │   ├── Ideas.tsx
│   │   │   ├── Social.tsx
│   │   │   └── Settings.tsx
│   │   ├── styles/          # Styling files (index.css, App.css)
│   │   ├── App.tsx          # Route coordinator & App entry
│   │   └── main.tsx         # React DOM entry
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── pgsql/                   # Bundled portable PostgreSQL binaries
├── run_app.bat              # One-click launcher for both services (Windows)
├── progress.log             # Ledgers of all development changes
└── README.md
\\\

## 🧩 Tech Stack

### Backend
| Technology | Role |
|---|---|
| **Python 3.11+** | Runtime |
| **FastAPI** | REST API framework |
| **Uvicorn** | ASGI server |
| **SQLAlchemy** | ORM for PostgreSQL |
| **psycopg2-binary** | PostgreSQL driver |
| **Pydantic v2** | Request/Response validation |
| **NVIDIA NIM API** | LLM inference (Llama 3.1 70B) |

### Frontend
| Technology | Role |
|---|---|
| **React 19** | UI framework |
| **TypeScript** | Type-safe JavaScript |
| **Vite 8** | Build tool & dev server |
| **React Router v7** | Client-side routing |
| **Lucide React** | Icon library |
| **Vanilla CSS** | Styling (dark theme, CSS variables) |

### Infrastructure
| Technology | Role |
|---|---|
| **PostgreSQL** | Primary database (portable binaries included) |
| **NVIDIA NIM** | AI inference endpoint (cloud) |

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+** with pip
- **Node.js 18+** with npm
- **PostgreSQL** running on localhost:5432 (or use the bundled pgsql/ binaries)
- **NVIDIA NIM API key** — get one free at https://build.nvidia.com

### 1. Clone & Enter

\\\ash
git clone <your-repo-url>
cd MyManager
\\\

### 2. Set Up the Backend

\\\ash
cd backend_py
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
\\\

### 3. Set Up the Frontend

\\\ash
cd frontend
npm install
\\\

### 4. Configure Environment

Set the following environment variables (or update backend_py/config.py):

\\\env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mymanager
NVIDIA_NIM_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxx
\\\

### 5. Start the App — Windows One-Click

\\\at
run_app.bat
\\\

This launches:
- FastAPI backend  → http://localhost:8080
- React frontend   → http://localhost:5173
- API Docs (Swagger) → http://localhost:8080/docs

### 5. Start Manually (Any OS)

\\\ash
# Backend (from project root)
python -m uvicorn backend_py.server:app --host 0.0.0.0 --port 8080 --reload

# Frontend
cd frontend && npm run dev
\\\

---

## 📡 API Reference

All API routes are prefixed with /api/v1/. Interactive docs at http://localhost:8080/docs.

### Projects
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/v1/projects | List all projects |
| POST | /api/v1/projects | Create a project |
| PUT | /api/v1/projects/{id} | Update a project |
| DELETE | /api/v1/projects/{id} | Delete a project |

### Tasks
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/v1/tasks | List all tasks |
| POST | /api/v1/tasks | Create a task |
| PUT | /api/v1/tasks/{id} | Update a task |
| DELETE | /api/v1/tasks/{id} | Delete a task |

### Job Applications
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/v1/jobs | List all applications |
| POST | /api/v1/jobs | Track a new application |
| PUT | /api/v1/jobs/{id} | Update application |
| DELETE | /api/v1/jobs/{id} | Remove an application |

### Resumes
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/v1/resumes/master-profile | Get master profile |
| POST | /api/v1/resumes/master-profile | Save master profile |
| POST | /api/v1/resumes/tailor | Generate AI-tailored resume |
| GET | /api/v1/resumes/tailored/{job_id} | Get tailored resume for a job |

### Ideas
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/v1/ideas | List all ideas |
| POST | /api/v1/ideas | Create an idea |
| PUT | /api/v1/ideas/{id} | Update idea |
| DELETE | /api/v1/ideas/{id} | Delete an idea |

### AI Copilot
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/v1/ai/chat/stream | Streaming chat (SSE) |
| POST | /api/v1/ai/chat | Non-streaming chat |
| GET | /api/v1/ai/memories | View all AI memories |
| DELETE | /api/v1/ai/memories/{id} | Delete a memory fact |

### Settings
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/v1/settings | Get all settings |
| POST | /api/v1/settings | Save a setting |
| GET | /api/v1/settings/models | List available AI models |

---

## 🤖 AI Copilot — How It Works

The AI Copilot is powered by NVIDIA NIM inference API using Meta Llama 3.1 70B Instruct by default.

### Streaming Responses (SSE)

The chat uses Server-Sent Events for real-time token streaming. Each chunk is a JSON envelope:

\\\json
{ type: token,  content: Hello... }
{ type: action, payload: { type: CREATE_PROJECT, payload: {...} } }
{ type: done }
\\\

### Persistent Memory

After each conversation, the AI automatically extracts facts about you — career goals, tech stack preferences — and stores them as UserMemory records. These are injected as context into every future chat session.

Example memories:
\\\
- User is looking for remote backend developer roles (Category: extracted)
- User is learning Golang (Category: extracted)
- User prefers microservices architecture (Category: extracted)
\\\

### Intent Detection

The copilot detects intent from natural language and can automatically create records with a confirmation card:

| Intent | Example Phrases |
|---|---|
| CREATE_PROJECT | add project..., new project..., start building... |
| CREATE_IDEA | I have an idea..., new idea..., got an idea for... |
| CREATE_JOB | applied to..., track job at..., new application for... |

When an intent is detected, the AI appends an ACTION_JSON block to its response. The frontend renders a confirmation card — you approve or cancel before any record is created.

### Model Switching

Switch the active AI model from the Settings page. The chosen model is persisted in the system_settings table and used for all subsequent AI interactions.

---

## 🗄️ Database Schema

Tables are auto-created on first boot via SQLAlchemy create_all().

\\\
user_memories       → AI-extracted facts about the user
job_applications    → Job tracking (company, role, status, salary, notes)
projects            → Personal/professional projects
tasks               → Tasks linked to a project (status, priority, due_date)
master_profiles     → Full resume data (JSON fields for exp/edu/skills/projects)
tailored_resumes    → AI-generated tailored resume per job application
system_settings     → Key-value config (active AI model, etc.)
ideas               → Ideas with category (Tech/Business/Life) and status
\\\

All tables include created_at and updated_at audit timestamps.

---

## 🎨 UI Features

- Dark theme with a premium purple/violet accent palette
- Collapsible sidebar with icon-only compact mode
- Sliding AI chat panel accessible from any page
- Streaming message bubbles with live token rendering
- Confirmation cards for AI-triggered record creation (approve / cancel)
- Lucide icons throughout for a consistent, clean aesthetic

---

## 📁 Pages

### Dashboard
Live statistics tiles: total projects, pending tasks, active job applications, and ideas. Quick-access links to all modules.

### Projects & Tasks
Create and manage projects. Expand any project to view its Kanban-style task board with TODO → IN_PROGRESS → DONE columns. Add tasks with priority and due date.

### Job Applications
Full CRUD for job applications. Track status (Applied, Interview, Offer, Rejected), salary range, job URL, and personal notes.

### Resume Creator
1. Build your Master Profile (experience, education, skills, projects).
2. Select a job application.
3. Click Generate Tailored Resume — AI rewrites your summary and experience to match the job description, plus writes a personalized cover letter.

### Ideas
Capture raw ideas with a title, description, category (Tech, Business, Life), and status (Idea, Exploring, Building, Parked). Never lose an inspiration again.

### Settings
- Switch the active AI model from the NVIDIA NIM catalog
- View and delete AI memory facts
- Manage general application preferences

---

## 🔧 Configuration

| Variable | Default | Description |
|---|---|---|
| DATABASE_URL | postgresql://postgres:postgres@localhost:5432/mymanager | PostgreSQL connection string |
| NVIDIA_NIM_API_KEY | (your key) | API key for NVIDIA NIM |
| DEFAULT_MODEL | meta/llama-3.1-70b-instruct | Default LLM model |
| PORT | 8080 | Backend server port |

---

## 🛠️ Development Commands

### Backend
\\\ash
# Dev server with auto-reload
python -m uvicorn backend_py.server:app --reload --port 8080
\\\

### Frontend
\\\ash
cd frontend

npm run dev       # Dev server with HMR
npm run build     # Type-check + production build
npm run lint      # Lint with oxlint
npm run preview   # Preview the production build
\\\

---

## 📦 Dependencies Summary

### Backend (requirements.txt)
- fastapi — REST API framework
- uvicorn[standard] — ASGI server
- sqlalchemy — ORM
- psycopg2-binary — PostgreSQL driver
- requests — HTTP client for NVIDIA NIM
- openai — OpenAI-compatible client (optional)
- pydantic — Validation

### Frontend (package.json)
- react 19, react-dom — UI framework
- react-router-dom 7 — Routing
- lucide-react — Icon library

---

## ⚠️ Security Notes

Before deploying or sharing this project:
- Move all secrets (API keys, DB passwords) to environment variables or a .env file
- Never commit API keys to version control
- Restrict CORS origins from wildcard (*) to your actual frontend domain in production

---

## 🗺️ Roadmap

- [ ] .env file support with python-dotenv
- [ ] Multi-user authentication (JWT / OAuth)
- [ ] Export resume as PDF
- [ ] Calendar integration for interview scheduling
- [ ] Email notifications for application status changes
- [ ] Docker Compose for one-command full-stack launch
- [ ] Dark / Light theme toggle

---

## 📄 License

This project is for personal use. All rights reserved.

---

Built with heart using FastAPI, React 19, and NVIDIA NIM

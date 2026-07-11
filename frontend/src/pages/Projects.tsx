import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Project {
  id: number;
  name: string;
  description: string;
  tech_stack: string;
  github_url: string;
  github_summary: string;
  features_json: string;
  is_own_project?: boolean;
  recreate_steps?: string;
  project_kind?: "OWN" | "LEARNING" | "REQUIRED";
  updated_at?: string;
}

interface TaskCounts {
  todo: number;
  in_progress: number;
  done: number;
  total: number;
}

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<number, TaskCounts>>({});
  const [loading, setLoading] = useState(true);

  const [showProjModal, setShowProjModal] = useState(false);
  const [projName, setProjName] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [projTech, setProjTech] = useState("");
  const [projGithub, setProjGithub] = useState("");

  const [showImportModal, setShowImportModal] = useState(false);
  const [importGithubUrl, setImportGithubUrl] = useState("");
  const [importIsOwnProject, setImportIsOwnProject] = useState(true);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/projects");
      const data: Project[] = await res.json();
      const normalized = data.map((p) => ({
        ...p,
        project_kind: p.project_kind || (p.is_own_project === false ? "LEARNING" : "OWN"),
      }));
      setProjects(normalized);
      fetchAllTaskCounts(normalized);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAllTaskCounts(projectList: Project[]) {
    const counts: Record<number, TaskCounts> = {};
    await Promise.all(
      projectList.map(async (p) => {
        try {
          const res = await fetch(`/api/v1/tasks/project/${p.id}`);
          if (res.ok) {
            const tasks = await res.json();
            counts[p.id] = {
              todo: tasks.filter((t: any) => t.status === "TODO").length,
              in_progress: tasks.filter((t: any) => t.status === "IN_PROGRESS").length,
              done: tasks.filter((t: any) => t.status === "DONE").length,
              total: tasks.length,
            };
          } else {
            counts[p.id] = { todo: 0, in_progress: 0, done: 0, total: 0 };
          }
        } catch {
          counts[p.id] = { todo: 0, in_progress: 0, done: 0, total: 0 };
        }
      })
    );
    setTaskCounts(counts);
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projName.trim()) return;
    try {
      const res = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projName,
          description: projDesc,
          tech_stack: projTech,
          github_url: projGithub,
          github_summary: "",
          features_json: "[]",
          is_own_project: true,
          project_kind: "OWN",
          recreate_steps: "",
        }),
      });
      if (res.ok) {
        const newProj = await res.json();
        setShowProjModal(false);
        setProjName(""); setProjDesc(""); setProjTech(""); setProjGithub("");
        (window as any).showToast("Project created!", "success");
        navigate(`/projects/${newProj.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function openImportModal(isOwn: boolean) {
    setImportIsOwnProject(isOwn);
    setImportGithubUrl("");
    setShowImportModal(true);
  }

  async function handleImportProject(e: React.FormEvent) {
    e.preventDefault();
    if (!importGithubUrl.trim()) return;
    try {
      setImporting(true);
      const res = await fetch("/api/v1/projects/import-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_url: importGithubUrl, is_own_project: importIsOwnProject }),
      });
      if (res.ok) {
        const newProj = await res.json();
        setShowImportModal(false);
        setImportGithubUrl("");
        (window as any).showToast("Project imported from GitHub!", "success");
        navigate(`/projects/${newProj.id}`);
      } else {
        const errData = await res.json();
        (window as any).showToast(`Failed to import: ${errData.detail || "Unknown error"}`, "error");
      }
    } catch {
      (window as any).showToast("Failed to import project from GitHub.", "error");
    } finally {
      setImporting(false);
    }
  }

  async function handleDeleteProject(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    const confirmed = await (window as any).showConfirm(
      "Delete Project",
      "Are you sure you want to delete this project and all its tasks? This cannot be undone.",
      "Delete",
      "Cancel"
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        setTaskCounts((prev) => { const c = { ...prev }; delete c[id]; return c; });
        (window as any).showToast("Project deleted.", "info");
      }
    } catch (err) {
      console.error(err);
    }
  }

  function getProgressPercent(counts: TaskCounts): number {
    if (!counts || counts.total === 0) return 0;
    return Math.round((counts.done / counts.total) * 100);
  }

  function formatUpdatedAt(dateStr?: string): string {
    if (!dateStr) return "No activity yet";
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Updated today";
    if (diffDays === 1) return "Updated yesterday";
    if (diffDays < 7) return `Updated ${diffDays}d ago`;
    return `Updated ${d.toLocaleDateString()}`;
  }

  const ownProjects = projects.filter((p) => (p.project_kind || "OWN") === "OWN");
  const learningProjects = projects.filter((p) => (p.project_kind || "OWN") === "LEARNING");
  const requiredProjects = projects.filter((p) => (p.project_kind || "OWN") === "REQUIRED");
  const orderedProjects = [...requiredProjects, ...ownProjects, ...learningProjects];

  function getProjectKindLabel(project: Project): string {
    if (project.project_kind === "REQUIRED") return "Required";
    if (project.project_kind === "LEARNING" || project.is_own_project === false) return "Learning";
    return "Portfolio";
  }

  function isFirstInSection(project: Project, index: number): boolean {
    const kind = project.project_kind || "OWN";
    return orderedProjects.findIndex((p) => (p.project_kind || "OWN") === kind) === index;
  }

  function getSectionMeta(kind: string) {
    if (kind === "REQUIRED") return { title: "Required / Learnable Projects", subtitle: "Skill-gap builds suggested from JD matching and resume ATS checks." };
    if (kind === "LEARNING") return { title: "Learning References", subtitle: "Imported projects you are recreating or studying." };
    return { title: "Portfolio Projects", subtitle: "Completed or active projects that can support your resume and work history." };
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">
            {loading ? "Loading..." : `${projects.length} project${projects.length !== 1 ? "s" : ""} in your workspace`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => openImportModal(true)}>
            <span className="material-symbols-outlined">person</span>
            Import My Project
          </button>
          <button className="btn btn-secondary" onClick={() => openImportModal(false)}>
            <span className="material-symbols-outlined">menu_book</span>
            Import Others Project
          </button>
          <button className="btn btn-primary" onClick={() => setShowProjModal(true)}>
            <span className="material-symbols-outlined">add</span>
            New Project
          </button>
        </div>
      </div>

      {!loading && projects.length > 0 && (
        <div className="project-hub-summary">
          <div>
            <span className="material-symbols-outlined">assignment_turned_in</span>
            <small>Total</small>
            <strong>{projects.length}</strong>
          </div>
          <div>
            <span className="material-symbols-outlined">workspace_premium</span>
            <small>Portfolio</small>
            <strong>{ownProjects.length}</strong>
          </div>
          <div>
            <span className="material-symbols-outlined">school</span>
            <small>Required</small>
            <strong>{requiredProjects.length}</strong>
          </div>
          <div>
            <span className="material-symbols-outlined">menu_book</span>
            <small>Learning</small>
            <strong>{learningProjects.length}</strong>
          </div>
        </div>
      )}

      {loading ? (
        <div className="project-card-grid">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="project-card"
              style={{ minHeight: "240px", opacity: 0.3, pointerEvents: "none" }}
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 40px" }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "56px", color: "var(--accent-color)", opacity: 0.45, display: "block", marginBottom: "20px" }}
          >
            folder_open
          </span>
          <h3 style={{ color: "var(--text-primary)", marginBottom: "8px", fontSize: "1.15rem" }}>No projects yet</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "28px", lineHeight: "1.6" }}>
            Create your first project or import from GitHub to start tracking tasks.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={() => openImportModal(true)}>
              <span className="material-symbols-outlined">cloud_download</span>
              Import from GitHub
            </button>
            <button className="btn btn-primary" onClick={() => setShowProjModal(true)}>
              <span className="material-symbols-outlined">add</span>
              Create First Project
            </button>
          </div>
        </div>
      ) : (
        <div className="project-card-grid">
          {orderedProjects.map((p, index) => {
            const counts = taskCounts[p.id] || { todo: 0, in_progress: 0, done: 0, total: 0 };
            const progress = getProgressPercent(counts);
            const techList = p.tech_stack ? p.tech_stack.split(",").map((t) => t.trim()).filter(Boolean) : [];
            const visibleTech = techList.slice(0, 3);
            const extraTech = techList.length - 3;
            const kind = p.project_kind || "OWN";
            const section = getSectionMeta(kind);

            return (
              <React.Fragment key={p.id}>
              {isFirstInSection(p, index) && (
                <div className={`project-section-divider project-section-${kind.toLowerCase()}`}>
                  <div>
                    <h2>{section.title}</h2>
                    <p>{section.subtitle}</p>
                  </div>
                  <span>{orderedProjects.filter((item) => (item.project_kind || "OWN") === kind).length}</span>
                </div>
              )}
              <div className={`project-card project-card-${kind.toLowerCase()}`} onClick={() => navigate(`/projects/${p.id}`)}>
                <button
                  className="btn-delete-icon project-card-delete"
                  onClick={(e) => handleDeleteProject(e, p.id)}
                  title="Delete project"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span>
                </button>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", paddingRight: "30px" }}>
                    <span className="project-card-name">{p.name}</span>
                    <span className={`project-kind-badge project-kind-${getProjectKindLabel(p).toLowerCase()}`}>
                      {getProjectKindLabel(p)}
                    </span>
                  </div>
                  {p.description && <p className="project-card-desc">{p.description}</p>}
                </div>

                {techList.length > 0 && (
                  <div className="project-card-tech">
                    {visibleTech.map((t, idx) => (
                      <span key={idx} className="tech-chip">{t}</span>
                    ))}
                    {extraTech > 0 && <span className="tech-chip-more">+{extraTech} more</span>}
                  </div>
                )}

                <div className="project-card-stats">
                  <div>
                    <div className="stat-pill-label">To Do</div>
                    <div className="stat-pill-value">{counts.todo}</div>
                  </div>
                  <div>
                    <div className="stat-pill-label">In Progress</div>
                    <div className="stat-pill-value" style={{ color: counts.in_progress > 0 ? "var(--warning-color)" : undefined }}>
                      {counts.in_progress}
                    </div>
                  </div>
                  <div>
                    <div className="stat-pill-label">Done</div>
                    <div className="stat-pill-value" style={{ color: counts.done > 0 ? "var(--success-color)" : undefined }}>
                      {counts.done}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontSize: "0.71rem", color: "var(--text-muted)", fontWeight: 500 }}>Progress</span>
                    <span style={{ fontSize: "0.71rem", color: "var(--text-secondary)", fontWeight: 700 }}>{progress}%</span>
                  </div>
                  <div className="project-card-progress-bar">
                    <div className="project-card-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="project-card-footer">
                  <div className="github-status">
                    <div className={`github-dot ${p.github_url ? "connected" : ""}`} />
                    <span>{p.github_url ? "GitHub Connected" : "No Repository"}</span>
                  </div>
                  <span style={{ fontSize: "0.71rem", color: "var(--text-muted)" }}>
                    {formatUpdatedAt(p.updated_at)}
                  </span>
                </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {showProjModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Create New Project</h3>
              <button className="modal-close-btn" onClick={() => setShowProjModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="modal-content" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label htmlFor="p_name">Project Name *</label>
                  <input type="text" id="p_name" style={{ width: "100%" }} value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="e.g. MyPortfolio" required />
                </div>
                <div>
                  <label htmlFor="p_desc">Description</label>
                  <textarea id="p_desc" style={{ width: "100%", height: "80px" }} value={projDesc} onChange={(e) => setProjDesc(e.target.value)} placeholder="What does this project do?" />
                </div>
                <div>
                  <label htmlFor="p_tech">Tech Stack</label>
                  <input type="text" id="p_tech" style={{ width: "100%" }} placeholder="e.g. React, FastAPI, PostgreSQL" value={projTech} onChange={(e) => setProjTech(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="p_git">GitHub URL</label>
                  <input type="text" id="p_git" style={{ width: "100%" }} placeholder="https://github.com/user/repo" value={projGithub} onChange={(e) => setProjGithub(e.target.value)} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProjModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>{importIsOwnProject ? "Import My Project" : "Import for Learning"}</h3>
              <button className="modal-close-btn" onClick={() => setShowImportModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleImportProject}>
              <div className="modal-content" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ background: "var(--sub-card-bg)", padding: "12px 16px", borderRadius: "12px", fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                  {importIsOwnProject
                    ? "Analyzes your GitHub repository to extract the tech stack and create a resume-ready project summary."
                    : "Analyzes the repository architecture and generates a step-by-step guide to rebuild it from scratch."}
                </div>
                <div>
                  <label htmlFor="import_git_url">GitHub Repository URL *</label>
                  <input type="text" id="import_git_url" style={{ width: "100%" }} placeholder="https://github.com/owner/repo" value={importGithubUrl} onChange={(e) => setImportGithubUrl(e.target.value)} required disabled={importing} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)} disabled={importing}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={importing || !importGithubUrl.trim()}>
                  {importing ? "Importing & Analyzing..." : "Import"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

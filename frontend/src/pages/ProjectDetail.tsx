import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

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
}

interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = parseInt(id || "0", 10);

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState("MEDIUM");
  const [taskDueDate, setTaskDueDate] = useState("");

  const [newFeature, setNewFeature] = useState("");
  const [githubScraping, setGithubScraping] = useState(false);
  const [generatingTasks, setGeneratingTasks] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchProject();
      fetchTasks();
    }
  }, [projectId]);

  async function fetchProject() {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/projects/${projectId}`);
      if (res.ok) {
        setProject(await res.json());
      } else {
        navigate("/projects");
      }
    } catch {
      navigate("/projects");
    } finally {
      setLoading(false);
    }
  }

  async function fetchTasks() {
    try {
      const res = await fetch(`/api/v1/tasks/project/${projectId}`);
      if (res.ok) setTasks(await res.json());
    } catch (err) {
      console.error(err);
    }
  }

  async function handleScrapeGithub() {
    if (!project?.github_url) return;
    try {
      setGithubScraping(true);
      const res = await fetch(`/api/v1/projects/${projectId}/scrape-github`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setProject((prev) => (prev ? { ...prev, github_summary: data.summary } : prev));
        (window as any).showToast("GitHub repository synced!", "success");
      } else {
        const errData = await res.json();
        (window as any).showToast(`Failed: ${errData.detail || "Unknown error"}`, "error");
      }
    } catch {
      (window as any).showToast("Failed to sync repository.", "error");
    } finally {
      setGithubScraping(false);
    }
  }

  async function handleGenerateTasks() {
    try {
      setGeneratingTasks(true);
      const res = await fetch(`/api/v1/projects/${projectId}/generate-tasks`, { method: "POST" });
      if (res.ok) {
        await fetchTasks();
        (window as any).showToast("AI tasks generated!", "success");
      } else {
        (window as any).showToast("Failed to generate tasks.", "error");
      }
    } catch {
      (window as any).showToast("Failed to generate tasks.", "error");
    } finally {
      setGeneratingTasks(false);
    }
  }

  async function handleSaveTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    const payload = {
      project_id: projectId,
      title: taskTitle,
      description: taskDesc,
      status: editingTask ? editingTask.status : "TODO",
      priority: taskPriority,
      due_date: taskDueDate || null,
    };
    try {
      if (editingTask) {
        const res = await fetch(`/api/v1/tasks/${editingTask.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? updated : t)));
          setShowTaskModal(false);
        }
      } else {
        const res = await fetch("/api/v1/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          setTasks((prev) => [...prev, created]);
          setShowTaskModal(false);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleMoveTask(task: Task, newStatus: string) {
    try {
      const res = await fetch(`/api/v1/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...task, status: newStatus }),
      });
      if (res.ok) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteTask(taskId: number) {
    const confirmed = await (window as any).showConfirm("Delete Task", "Are you sure you want to delete this task?", "Delete", "Cancel");
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}`, { method: "DELETE" });
      if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddFeature(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !newFeature.trim()) return;
    try {
      const res = await fetch(`/api/v1/projects/${project.id}/features`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: newFeature }),
      });
      if (res.ok) {
        setProject(await res.json());
        setNewFeature("");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRemoveFeature(index: number) {
    if (!project) return;
    try {
      const res = await fetch(`/api/v1/projects/${project.id}/features/${index}`, { method: "DELETE" });
      if (res.ok) setProject(await res.json());
    } catch (err) {
      console.error(err);
    }
  }

  function openCreateTaskModal() {
    setEditingTask(null);
    setTaskTitle(""); setTaskDesc(""); setTaskPriority("MEDIUM"); setTaskDueDate("");
    setShowTaskModal(true);
  }

  function openEditTaskModal(task: Task) {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDesc(task.description || "");
    setTaskPriority(task.priority || "MEDIUM");
    setTaskDueDate(task.due_date || "");
    setShowTaskModal(true);
  }

  const featuresList: string[] = project ? JSON.parse(project.features_json || "[]") : [];
  const techList = project?.tech_stack ? project.tech_stack.split(",").map((t) => t.trim()).filter(Boolean) : [];

  function renderKanbanCard(task: Task, column: "TODO" | "IN_PROGRESS" | "DONE") {
    const isDone = column === "DONE";
    return (
      <div key={task.id} className="kanban-card" style={{ opacity: isDone ? 0.78 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
          <span className={`priority-badge ${task.priority.toLowerCase()}`}>{task.priority}</span>
          <div style={{ display: "flex", gap: "2px" }}>
            {!isDone && (
              <button className="btn-action-icon" onClick={() => openEditTaskModal(task)}>
                <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>edit</span>
              </button>
            )}
            <button className="btn-delete-icon" onClick={() => handleDeleteTask(task.id)}>
              <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>delete</span>
            </button>
          </div>
        </div>

        <div style={{
          fontSize: "0.92rem",
          color: isDone ? "var(--text-secondary)" : "var(--text-primary)",
          fontWeight: 500,
          textDecoration: isDone ? "line-through" : "none",
          lineHeight: "1.4",
          marginBottom: task.description ? "6px" : "0",
        }}>
          {task.title}
        </div>

        {task.description && (
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: "1.45" }}>
            {task.description}
          </div>
        )}

        {task.due_date && (
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>schedule</span>
            {task.due_date}
          </div>
        )}

        <div style={{ display: "flex", gap: "6px", marginTop: "12px", flexWrap: "wrap" }}>
          {column === "TODO" && (
            <button className="kanban-move-btn" onClick={() => handleMoveTask(task, "IN_PROGRESS")}>
              Start →
            </button>
          )}
          {column === "IN_PROGRESS" && (
            <>
              <button className="kanban-move-btn" onClick={() => handleMoveTask(task, "TODO")}>← Back</button>
              <button className="kanban-move-btn" onClick={() => handleMoveTask(task, "DONE")}>Done ✓</button>
            </>
          )}
          {column === "DONE" && (
            <button className="kanban-move-btn" onClick={() => handleMoveTask(task, "IN_PROGRESS")}>← Redo</button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px", color: "var(--text-secondary)" }}>
        <span className="material-symbols-outlined" style={{ fontSize: "24px", marginRight: "10px" }}>hourglass_empty</span>
        Loading workspace...
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ textAlign: "center", padding: "60px" }}>
        <p style={{ color: "var(--text-secondary)" }}>Project not found.</p>
        <button className="btn btn-secondary" style={{ marginTop: "16px" }} onClick={() => navigate("/projects")}>
          ← Back to Projects
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ── Compact Top Bar ── */}
      <div className="detail-top-bar">
        <button className="detail-back-btn" onClick={() => navigate("/projects")}>
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>arrow_back</span>
          Projects
        </button>
        <div style={{ width: "1px", height: "32px", background: "var(--border-color)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span className="detail-project-name">{project.name}</span>
            {project.is_own_project === false && (
              <span style={{ fontSize: "0.68rem", background: "var(--warning-bg)", color: "var(--warning-color)", padding: "2px 8px", borderRadius: "9999px", fontWeight: 700 }}>
                Learning
              </span>
            )}
            {project.github_url && (
              <span style={{ fontSize: "0.68rem", background: "var(--success-bg)", color: "var(--success-color)", padding: "2px 8px", borderRadius: "9999px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>commit</span>
                GitHub
              </span>
            )}
          </div>
          {techList.length > 0 && (
            <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
              {techList.map((t, idx) => (
                <span key={idx} className="tech-chip">{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="detail-actions">
          {project.is_own_project !== false && (
            <button className="btn btn-secondary" onClick={handleScrapeGithub} disabled={githubScraping || !project.github_url}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>sync</span>
              {githubScraping ? "Syncing..." : "Sync GitHub"}
            </button>
          )}
          <button className="btn btn-secondary" onClick={handleGenerateTasks} disabled={generatingTasks}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>auto_awesome</span>
            {generatingTasks ? "Generating..." : "AI Tasks"}
          </button>
          <button className="btn btn-primary" onClick={openCreateTaskModal}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add_task</span>
            Add Task
          </button>
        </div>
      </div>

      {/* ── Collapsible Info Panel ── */}
      <div className="detail-info-panel">
        <button className="detail-info-toggle" onClick={() => setInfoOpen(!infoOpen)}>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>info</span>
            Project Info & Details
            {featuresList.length > 0 && (
              <span className="tab-badge">{featuresList.length} features</span>
            )}
          </span>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "20px", transition: "transform 0.22s", transform: infoOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            expand_more
          </span>
        </button>

        {infoOpen && (
          <div className="detail-info-body">
            {project.description && (
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.65", margin: 0 }}>
                {project.description}
              </p>
            )}

            {project.is_own_project !== false ? (
              <div>
                <label htmlFor="github_url_detail" style={{ marginBottom: "6px", display: "block" }}>GitHub Repository</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="text"
                    id="github_url_detail"
                    style={{ flexGrow: 1 }}
                    placeholder="https://github.com/user/repo"
                    value={project.github_url || ""}
                    onChange={async (e) => {
                      const updated = { ...project, github_url: e.target.value };
                      setProject(updated);
                      await fetch(`/api/v1/projects/${project.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(updated),
                      });
                    }}
                  />
                  <button className="btn btn-secondary" onClick={handleScrapeGithub} disabled={githubScraping || !project.github_url}>
                    <span className="material-symbols-outlined">sync</span>
                    {githubScraping ? "Syncing..." : "Sync & Scrape"}
                  </button>
                </div>
                {project.github_summary && (
                  <div style={{ marginTop: "12px", background: "var(--sub-card-bg)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "4px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>auto_awesome</span>
                      AI Resume Summary
                    </div>
                    <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>
                      {project.github_summary}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              project.recreate_steps ? (
                <div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>school</span>
                    Steps to Recreate
                  </div>
                  <div style={{ background: "var(--sub-card-bg)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px", maxHeight: "200px", overflowY: "auto", fontSize: "0.87rem", color: "var(--text-primary)", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                    {project.recreate_steps}
                  </div>
                </div>
              ) : null
            )}

            <div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "10px" }}>
                Wishlist Features
              </div>
              <form onSubmit={handleAddFeature} style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  style={{ flexGrow: 1 }}
                  placeholder="Add a feature idea..."
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                />
                <button type="submit" className="btn btn-secondary">Add</button>
              </form>
              {featuresList.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
                  {featuresList.map((f: string, i: number) => (
                    <span
                      key={i}
                      style={{ fontSize: "0.82rem", background: "var(--sub-card-bg)", border: "1px solid var(--border-color)", borderRadius: "9999px", padding: "5px 14px", display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)", fontWeight: 500 }}
                    >
                      {f}
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "13px", cursor: "pointer", color: "var(--danger-color)" }}
                        onClick={() => handleRemoveFeature(i)}
                      >
                        close
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Kanban Board (dominant) ── */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h2 style={{ fontSize: "1rem", color: "var(--text-secondary)", fontWeight: 600, margin: 0 }}>Task Board</h2>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} total
          </span>
        </div>

        <div className="kanban-board">
          {/* TODO */}
          <div className="kanban-col kanban-col-todo">
            <div className="kanban-col-header">
              <span>To Do</span>
              <span className="tab-badge">{tasks.filter((t) => t.status === "TODO").length}</span>
            </div>
            {tasks.filter((t) => t.status === "TODO").map((t) => renderKanbanCard(t, "TODO"))}
            {tasks.filter((t) => t.status === "TODO").length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 16px", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                No tasks yet
              </div>
            )}
          </div>

          {/* IN PROGRESS */}
          <div className="kanban-col kanban-col-inprogress">
            <div className="kanban-col-header">
              <span>In Progress</span>
              <span className="tab-badge" style={{ background: "var(--warning-bg)", color: "var(--warning-color)" }}>
                {tasks.filter((t) => t.status === "IN_PROGRESS").length}
              </span>
            </div>
            {tasks.filter((t) => t.status === "IN_PROGRESS").map((t) => renderKanbanCard(t, "IN_PROGRESS"))}
            {tasks.filter((t) => t.status === "IN_PROGRESS").length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 16px", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                Nothing in progress
              </div>
            )}
          </div>

          {/* DONE */}
          <div className="kanban-col kanban-col-done">
            <div className="kanban-col-header">
              <span>Completed</span>
              <span className="tab-badge" style={{ background: "var(--success-bg)", color: "var(--success-color)" }}>
                {tasks.filter((t) => t.status === "DONE").length}
              </span>
            </div>
            {tasks.filter((t) => t.status === "DONE").map((t) => renderKanbanCard(t, "DONE"))}
            {tasks.filter((t) => t.status === "DONE").length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 16px", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                No completed tasks
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Task Modal ── */}
      {showTaskModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>{editingTask ? "Edit Task" : "New Task"}</h3>
              <button className="modal-close-btn" onClick={() => setShowTaskModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveTask}>
              <div className="modal-content" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label htmlFor="t_title">Task Title *</label>
                  <input type="text" id="t_title" style={{ width: "100%" }} value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required placeholder="e.g. Build login page" />
                </div>
                <div>
                  <label htmlFor="t_desc">Description</label>
                  <textarea id="t_desc" style={{ width: "100%", height: "80px" }} value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Optional details..." />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label htmlFor="t_prio">Priority</label>
                    <select id="t_prio" style={{ width: "100%" }} value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="t_due">Due Date</label>
                    <input type="date" id="t_due" style={{ width: "100%" }} value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingTask ? "Save Changes" : "Create Task"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';

interface Project {
  id: number;
  name: string;
  description: string;
  tech_stack: string;
  github_url: string;
  github_summary: string;
  features_json: string; // JSON array
  is_own_project?: boolean;
  recreate_steps?: string;
}

interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string;
  status: string; // TODO, IN_PROGRESS, DONE
  priority: string; // LOW, MEDIUM, HIGH
  due_date: string;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Modals / Form states
  const [showProjModal, setShowProjModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importGithubUrl, setImportGithubUrl] = useState('');
  const [importIsOwnProject, setImportIsOwnProject] = useState(true);
  const [importing, setImporting] = useState(false);
  
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projTech, setProjTech] = useState('');
  const [projGithub, setProjGithub] = useState('');
  
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');
  const [taskDueDate, setTaskDueDate] = useState('');

  // Wishlist item state
  const [newFeature, setNewFeature] = useState('');

  const [loading, setLoading] = useState(true);
  const [githubScraping, setGithubScraping] = useState(false);
  const [generatingTasks, setGeneratingTasks] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchTasks(selectedProject.id);
    } else {
      setTasks([]);
    }
  }, [selectedProject]);

  async function fetchProjects() {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/projects');
      const data = await res.json();
      setProjects(data);
      if (data.length > 0 && !selectedProject) {
        setSelectedProject(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTasks(projectId: number) {
    try {
      const res = await fetch(`/api/v1/tasks/project/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Project CRUD operations
  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projName.trim()) return;
    try {
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projName,
          description: projDesc,
          tech_stack: projTech,
          github_url: projGithub,
          github_summary: '',
          features_json: '[]',
          is_own_project: true,
          recreate_steps: ''
        })
      });
      if (res.ok) {
        const newProj = await res.json();
        setProjects([...projects, newProj]);
        setSelectedProject(newProj);
        setShowProjModal(false);
        setProjName('');
        setProjDesc('');
        setProjTech('');
        setProjGithub('');
      }
    } catch (err) {
      console.error(err);
    }
  }

  function openImportModal(isOwn: boolean) {
    setImportIsOwnProject(isOwn);
    setImportGithubUrl('');
    setShowProjModal(false);
    setShowTaskModal(false);
    setShowImportModal(true);
  }

  async function handleImportProject(e: React.FormEvent) {
    e.preventDefault();
    if (!importGithubUrl.trim()) return;
    try {
      setImporting(true);
      const res = await fetch('/api/v1/projects/import-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          github_url: importGithubUrl,
          is_own_project: importIsOwnProject
        })
      });
      if (res.ok) {
        const newProj = await res.json();
        setProjects([...projects, newProj]);
        setSelectedProject(newProj);
        setShowImportModal(false);
        setImportGithubUrl('');
        (window as any).showToast('Project successfully imported from GitHub!', 'success');
      } else {
        const errData = await res.json();
        (window as any).showToast(`Failed to import: ${errData.detail || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      (window as any).showToast('Failed to import project from GitHub.', 'error');
    } finally {
      setImporting(false);
    }
  }

  async function handleDeleteProject(id: number) {
    const confirmed = await (window as any).showConfirm(
      'Delete Project',
      'Are you sure you want to delete this project and all its tasks?',
      'Delete',
      'Cancel'
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const updated = projects.filter(p => p.id !== id);
        setProjects(updated);
        if (updated.length > 0) {
          setSelectedProject(updated[0]);
        } else {
          setSelectedProject(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  // GitHub Scraping
  async function handleScrapeGithub() {
    if (!selectedProject || !selectedProject.github_url) return;
    try {
      setGithubScraping(true);
      const res = await fetch(`/api/v1/projects/${selectedProject.id}/scrape-github`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const updatedProj = { ...selectedProject, github_summary: data.summary };
        setSelectedProject(updatedProj);
        setProjects(projects.map(p => p.id === selectedProject.id ? updatedProj : p));
        (window as any).showToast('GitHub repository successfully scraped and analyzed!', 'success');
      } else {
        const errData = await res.json();
        (window as any).showToast(`Failed to scrape: ${errData.detail || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      (window as any).showToast('Failed to scrape repository.', 'error');
    } finally {
      setGithubScraping(false);
    }
  }

  // Task CRUD operations
  async function handleSaveTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject || !taskTitle.trim()) return;

    const payload = {
      project_id: selectedProject.id,
      title: taskTitle,
      description: taskDesc,
      status: editingTask ? editingTask.status : 'TODO',
      priority: taskPriority,
      due_date: taskDueDate || null
    };

    try {
      if (editingTask) {
        // Update
        const res = await fetch(`/api/v1/tasks/${editingTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const updated = await res.json();
          setTasks(tasks.map(t => t.id === editingTask.id ? updated : t));
          setShowTaskModal(false);
        }
      } else {
        // Create
        const res = await fetch('/api/v1/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const created = await res.json();
          setTasks([...tasks, created]);
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, status: newStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks(tasks.map(t => t.id === task.id ? updated : t));
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteTask(taskId: number) {
    const confirmed = await (window as any).showConfirm(
      'Delete Task',
      'Are you sure you want to delete this task?',
      'Delete',
      'Cancel'
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks(tasks.filter(t => t.id !== taskId));
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Wishlist Feature Operations
  async function handleAddFeature(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject || !newFeature.trim()) return;
    try {
      const res = await fetch(`/api/v1/projects/${selectedProject.id}/features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: newFeature })
      });
      if (res.ok) {
        const updatedProj = await res.json();
        setSelectedProject(updatedProj);
        setProjects(projects.map(p => p.id === selectedProject.id ? updatedProj : p));
        setNewFeature('');
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRemoveFeature(index: number) {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/v1/projects/${selectedProject.id}/features/${index}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const updatedProj = await res.json();
        setSelectedProject(updatedProj);
        setProjects(projects.map(p => p.id === selectedProject.id ? updatedProj : p));
      }
    } catch (err) {
      console.error(err);
    }
  }

  // AI Task Generation
  async function handleGenerateTasks() {
    if (!selectedProject) return;
    try {
      setGeneratingTasks(true);
      const res = await fetch(`/api/v1/projects/${selectedProject.id}/generate-tasks`, { method: 'POST' });
      if (res.ok) {
        await res.json();
        fetchTasks(selectedProject.id);
        (window as any).showToast('AI successfully generated and populated development tasks!', 'success');
      } else {
        (window as any).showToast('Failed to generate tasks using AI.', 'error');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingTasks(false);
    }
  }

  function openCreateTaskModal() {
    setEditingTask(null);
    setTaskTitle('');
    setTaskDesc('');
    setTaskPriority('MEDIUM');
    setTaskDueDate('');
    setShowTaskModal(true);
  }

  function openEditTaskModal(task: Task) {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDesc(task.description || '');
    setTaskPriority(task.priority || 'MEDIUM');
    setTaskDueDate(task.due_date || '');
    setShowTaskModal(true);
  }

  const featuresList = selectedProject
    ? JSON.parse(selectedProject.features_json || '[]')
    : [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Projects & Task Boards</h1>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => openImportModal(true)}>
            <span className="material-symbols-outlined">person</span> Import My Project
          </button>
          <button className="btn btn-secondary" onClick={() => openImportModal(false)}>
            <span className="material-symbols-outlined">menu_book</span> Import Others Project
          </button>
          <button className="btn btn-primary" onClick={() => setShowProjModal(true)}>
            <span className="material-symbols-outlined">add</span> Create Project
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading project details...</p>
      ) : projects.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--accent-color)', marginBottom: '16px' }}>folder_open</span>
          <p style={{ color: 'var(--text-secondary)' }}>No projects found. Create a project to start managing tasks!</p>
        </div>
      ) : (
        <div className="split-layout">
          {/* Projects Sidebar */}
          <div className="split-sidebar">
            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>All Projects</h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {projects.map(p => (
                <div
                  key={p.id}
                  className={`clickable-list-item ${selectedProject?.id === p.id ? 'selected' : ''}`}
                  onClick={() => setSelectedProject(p)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ overflow: 'hidden', flexGrow: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: p.is_own_project === false ? '60%' : '100%' }}>{p.name}</div>
                      {p.is_own_project === false && (
                        <span style={{ fontSize: '0.7rem', background: 'var(--warning-bg)', color: 'var(--warning-color)', padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                          Learning
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{p.tech_stack || 'No tech stack listed'}</div>
                  </div>
                  <button
                    className="collapse-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(p.id);
                    }}
                    style={{ opacity: selectedProject?.id === p.id ? 1 : 0.4 }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--danger-color)' }}>delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Project Details and Kanban board */}
          {selectedProject && (
            <div className="split-main">
              <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.3rem', color: 'var(--text-primary)' }}>{selectedProject.name}</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '6px' }}>{selectedProject.description}</p>
                    {selectedProject.tech_stack && (
                      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tech Stack:</span>
                        <span style={{ fontSize: '0.8rem', background: 'var(--accent-dim)', color: 'var(--accent-hover)', padding: '2px 8px', borderRadius: '4px' }}>{selectedProject.tech_stack}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={handleGenerateTasks} disabled={generatingTasks}>
                      <span className="material-symbols-outlined">auto_awesome</span> 
                      {generatingTasks ? 'Generating...' : 'AI Generate Tasks'}
                    </button>
                    <button className="btn btn-primary" onClick={openCreateTaskModal}>
                      <span className="material-symbols-outlined">add_task</span> Add Task
                    </button>
                  </div>
                </div>

                {/* GitHub Scraping Panel or Recreation Steps */}
                {selectedProject.is_own_project !== false ? (
                  <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                    <label htmlFor="github_url">GitHub Repository Link</label>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                      <input
                        type="text"
                        id="github_url"
                        style={{ flexGrow: 1 }}
                        placeholder="e.g. https://github.com/user/repo"
                        value={selectedProject.github_url || ''}
                        onChange={async (e) => {
                          const updated = { ...selectedProject, github_url: e.target.value };
                          setSelectedProject(updated);
                          // Save in backend
                          await fetch(`/api/v1/projects/${selectedProject.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updated)
                          });
                        }}
                      />
                      <button className="btn btn-secondary" onClick={handleScrapeGithub} disabled={githubScraping || !selectedProject.github_url}>
                        <span className="material-symbols-outlined">sync</span>
                        {githubScraping ? 'Scraping...' : 'Sync & Scrape Details'}
                      </button>
                    </div>
                    {selectedProject.github_summary && (
                      <div style={{ marginTop: '14px', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--accent-hover)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>info</span> AI GitHub Summary (Resume-Ready)
                        </div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{selectedProject.github_summary}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h4 style={{ fontSize: '0.95rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>school</span> Steps to Recreate Project from Scratch
                      </h4>
                      {selectedProject.github_url && (
                        <a 
                          href={selectedProject.github_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>link</span> View GitHub Repo
                        </a>
                      )}
                    </div>
                    <div 
                      className="glass-panel" 
                      style={{ 
                        maxHeight: '300px', 
                        overflowY: 'auto', 
                        padding: '16px', 
                        background: 'rgba(0, 0, 0, 0.2)', 
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        marginTop: '10px'
                      }}
                    >
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                        {selectedProject.recreate_steps || "No recreation guide generated yet."}
                      </div>
                    </div>
                  </div>
                )}

                {/* Feature Wishlist Panel */}
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>Wishlist Features</h4>
                  <form onSubmit={handleAddFeature} style={{ display: 'flex', gap: '12px' }}>
                    <input
                      type="text"
                      style={{ flexGrow: 1 }}
                      placeholder="Add custom feature / wishlist idea..."
                      value={newFeature}
                      onChange={(e) => setNewFeature(e.target.value)}
                    />
                    <button type="submit" className="btn btn-secondary">Add</button>
                  </form>
                  {featuresList.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                      {featuresList.map((f: string, i: number) => (
                        <span
                          key={i}
                          style={{
                            fontSize: '0.85rem',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '20px',
                            padding: '4px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {f}
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: '14px', cursor: 'pointer', color: 'var(--text-muted)' }}
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

              {/* Kanban Task Board */}
              <div className="kanban-board">
                {/* TODO Column */}
                <div className="kanban-col">
                  <div className="kanban-col-header">
                    <span>To Do</span>
                    <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                      {tasks.filter(t => t.status === 'TODO').length}
                    </span>
                  </div>
                  {tasks.filter(t => t.status === 'TODO').map(t => (
                    <div key={t.id} className="kanban-card">
                      <span className={`priority-badge ${t.priority.toLowerCase()}`}>{t.priority}</span>
                      <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{t.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>{t.description}</div>
                      {t.due_date && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>Due: {t.due_date}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="collapse-btn" onClick={() => openEditTaskModal(t)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                          </button>
                          <button className="collapse-btn" onClick={() => handleDeleteTask(t.id)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--danger-color)' }}>delete</span>
                          </button>
                        </div>
                        <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => handleMoveTask(t, 'IN_PROGRESS')}>
                          Start →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* IN_PROGRESS Column */}
                <div className="kanban-col">
                  <div className="kanban-col-header">
                    <span>In Progress</span>
                    <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                      {tasks.filter(t => t.status === 'IN_PROGRESS').length}
                    </span>
                  </div>
                  {tasks.filter(t => t.status === 'IN_PROGRESS').map(t => (
                    <div key={t.id} className="kanban-card">
                      <span className={`priority-badge ${t.priority.toLowerCase()}`}>{t.priority}</span>
                      <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{t.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>{t.description}</div>
                      {t.due_date && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>Due: {t.due_date}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
                        <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => handleMoveTask(t, 'TODO')}>
                          ← Back
                        </button>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="collapse-btn" onClick={() => openEditTaskModal(t)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                          </button>
                          <button className="collapse-btn" onClick={() => handleDeleteTask(t.id)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--danger-color)' }}>delete</span>
                          </button>
                        </div>
                        <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => handleMoveTask(t, 'DONE')}>
                          Done →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* DONE Column */}
                <div className="kanban-col">
                  <div className="kanban-col-header">
                    <span>Completed</span>
                    <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                      {tasks.filter(t => t.status === 'DONE').length}
                    </span>
                  </div>
                  {tasks.filter(t => t.status === 'DONE').map(t => (
                    <div key={t.id} className="kanban-card" style={{ opacity: 0.8 }}>
                      <span className={`priority-badge ${t.priority.toLowerCase()}`} style={{ opacity: 0.6 }}>{t.priority}</span>
                      <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', textDecoration: 'line-through' }}>{t.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>{t.description}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', alignItems: 'center' }}>
                        <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => handleMoveTask(t, 'IN_PROGRESS')}>
                          ← Redo
                        </button>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="collapse-btn" onClick={() => handleDeleteTask(t.id)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--danger-color)' }}>delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      {showProjModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Create New Project</h3>
              <button className="collapse-btn" onClick={() => setShowProjModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="p_name">Project Name *</label>
                <input type="text" id="p_name" style={{ width: '100%' }} value={projName} onChange={e => setProjName(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="p_desc">Description</label>
                <textarea id="p_desc" style={{ width: '100%', height: '80px' }} value={projDesc} onChange={e => setProjDesc(e.target.value)} />
              </div>
              <div>
                <label htmlFor="p_tech">Tech Stack</label>
                <input type="text" id="p_tech" style={{ width: '100%' }} placeholder="e.g. React, Node.js, PostgreSQL" value={projTech} onChange={e => setProjTech(e.target.value)} />
              </div>
              <div>
                <label htmlFor="p_git">GitHub Link</label>
                <input type="text" id="p_git" style={{ width: '100%' }} placeholder="e.g. https://github.com/user/repo" value={projGithub} onChange={e => setProjGithub(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowProjModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Edit/Create Modal */}
      {showTaskModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>{editingTask ? 'Edit Task' : 'Create New Task'}</h3>
              <button className="collapse-btn" onClick={() => setShowTaskModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="t_title">Task Title *</label>
                <input type="text" id="t_title" style={{ width: '100%' }} value={taskTitle} onChange={e => setTaskTitle(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="t_desc">Description</label>
                <textarea id="t_desc" style={{ width: '100%', height: '80px' }} value={taskDesc} onChange={e => setTaskDesc(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="t_prio">Priority</label>
                  <select id="t_prio" style={{ width: '100%' }} value={taskPriority} onChange={e => setTaskPriority(e.target.value)}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="t_due">Due Date</label>
                  <input type="date" id="t_due" style={{ width: '100%', height: '42px' }} value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingTask ? 'Save Changes' : 'Create Task'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Project Modal */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>
                {importIsOwnProject ? 'Import My Project from GitHub' : 'Import Others Project for Learning'}
              </h3>
              <button className="collapse-btn" onClick={() => setShowImportModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleImportProject} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  {importIsOwnProject 
                    ? 'This will analyze your repository to extract tech stack details and compile a resume-ready summary of your achievements.'
                    : 'This will analyze the repository architecture and compile detailed step-by-step instructions on how to rebuild the project from scratch.'}
                </p>
              </div>
              <div>
                <label htmlFor="import_git_url">GitHub Repository URL *</label>
                <input 
                  type="text" 
                  id="import_git_url" 
                  style={{ width: '100%' }} 
                  placeholder="e.g. https://github.com/owner/repo" 
                  value={importGithubUrl} 
                  onChange={e => setImportGithubUrl(e.target.value)} 
                  required 
                  disabled={importing}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)} disabled={importing}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={importing || !importGithubUrl.trim()}>
                  {importing ? 'Importing & Analyzing...' : 'Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

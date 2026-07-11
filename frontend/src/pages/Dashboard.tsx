import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

interface Project { id: number; name: string; description?: string; tech_stack?: string; }
interface Job { id: number; company: string; role: string; status: string; }
interface Idea { id: number; title: string; category?: string; status?: string; }
interface Task { id: number; project_id: number; title: string; status: string; priority?: string; due_date?: string; }

const statusClass = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes('offer') || normalized.includes('accepted')) return 'is-success';
  if (normalized.includes('reject')) return 'is-danger';
  if (normalized.includes('interview')) return 'is-info';
  return 'is-warning';
};

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [projectsResponse, jobsResponse, ideasResponse] = await Promise.all([
          fetch('/api/v1/projects'), fetch('/api/v1/jobs'), fetch('/api/v1/ideas'),
        ]);
        const [projectData, jobsData, ideasData] = await Promise.all([
          projectsResponse.json(), jobsResponse.json(), ideasResponse.json(),
        ]);
        setProjects(projectData);
        setJobs(jobsData);
        setIdeas(ideasData);
        const taskGroups = await Promise.all(projectData.map(async (project: Project) => {
          const response = await fetch(`/api/v1/tasks/project/${project.id}`);
          return response.ok ? response.json() : [];
        }));
        setTasks(taskGroups.flat());
      } catch (error) {
        console.error('Failed to fetch dashboard data', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const activeTasks = tasks.filter(task => task.status !== 'DONE');
  const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS');
  const taskProjectNames = useMemo(() => new Map(projects.map(project => [project.id, project.name])), [projects]);
  const projectTaskCounts = useMemo(() => tasks.reduce<Record<number, { total: number; done: number }>>((counts, task) => {
    const current = counts[task.project_id] || { total: 0, done: 0 };
    current.total += 1;
    if (task.status === 'DONE') current.done += 1;
    counts[task.project_id] = current;
    return counts;
  }, {}), [tasks]);
  const priorityTasks = [...activeTasks].sort((a, b) => (a.priority === 'HIGH' ? -1 : 0) - (b.priority === 'HIGH' ? -1 : 0)).slice(0, 4);

  if (loading) return <div className="dashboard-loading">Loading your workspace…</div>;

  return (
    <main className="crm-dashboard">
      <header className="dashboard-hero">
        <div>
          <p className="eyebrow">Workspace overview</p>
          <h1>Good to see you.</h1>
          <p className="dashboard-intro">Your projects, career pipeline, and next priorities—organized in one focused view.</p>
        </div>
        <div className="dashboard-actions">
          <Link className="btn btn-secondary" to="/ideas"><span className="material-symbols-outlined">lightbulb</span> Capture idea</Link>
          <Link className="btn btn-primary" to="/projects"><span className="material-symbols-outlined">add</span> New project</Link>
        </div>
      </header>

      <section className="crm-metrics" aria-label="Workspace metrics">
        <Link to="/projects" className="metric-card metric-card-featured">
          <span className="metric-icon"><span className="material-symbols-outlined">folder_open</span></span>
          <span><span className="metric-label">Active projects</span><strong>{projects.length}</strong><small>In your portfolio</small></span>
          <span className="material-symbols-outlined metric-arrow">arrow_outward</span>
        </Link>
        <Link to="/projects" className="metric-card">
          <span className="metric-icon metric-tint-blue"><span className="material-symbols-outlined">task_alt</span></span>
          <span><span className="metric-label">Open tasks</span><strong>{activeTasks.length}</strong><small>{inProgressTasks.length} in progress</small></span>
        </Link>
        <Link to="/applications" className="metric-card">
          <span className="metric-icon metric-tint-amber"><span className="material-symbols-outlined">business_center</span></span>
          <span><span className="metric-label">Career pipeline</span><strong>{jobs.length}</strong><small>{jobs.filter(job => job.status !== 'REJECTED').length} active opportunities</small></span>
        </Link>
        <Link to="/ideas" className="metric-card">
          <span className="metric-icon metric-tint-pink"><span className="material-symbols-outlined">tips_and_updates</span></span>
          <span><span className="metric-label">Ideas to explore</span><strong>{ideas.length}</strong><small>Keep the momentum</small></span>
        </Link>
      </section>

      <div className="crm-dashboard-layout">
        <div className="crm-primary-column">
          <section className="crm-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">Portfolio</p><h2>Project health</h2></div>
              <Link to="/projects" className="text-action">View all <span className="material-symbols-outlined">arrow_forward</span></Link>
            </div>
            {projects.length === 0 ? <EmptyState icon="folder_open" title="Start your portfolio" message="Create a project to see its work and progress here." to="/projects" action="Create project" /> :
              <div className="project-health-list">
                {projects.slice(0, 4).map(project => {
                  const counts = projectTaskCounts[project.id] || { total: 0, done: 0 };
                  const progress = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;
                  return <Link className="project-health-row" to={`/projects/${project.id}`} key={project.id}>
                    <span className="project-avatar">{project.name.slice(0, 1).toUpperCase()}</span>
                    <span className="project-health-main"><strong>{project.name}</strong><small>{project.description || 'No project summary yet'}</small></span>
                    <span className="project-progress"><span><b>{progress}%</b> complete</span><i><em style={{ width: `${progress}%` }} /></i></span>
                    <span className="project-task-count">{counts.total - counts.done} <small>open</small></span>
                    <span className="material-symbols-outlined row-arrow">chevron_right</span>
                  </Link>;
                })}
              </div>}
          </section>

          <section className="crm-panel pipeline-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">Career CRM</p><h2>Application pipeline</h2></div>
              <Link to="/applications" className="text-action">Open pipeline <span className="material-symbols-outlined">arrow_forward</span></Link>
            </div>
            {jobs.length === 0 ? <EmptyState icon="business_center" title="No opportunities yet" message="Track roles and every next step in your job search." to="/applications" action="Add application" /> :
              <div className="application-list">
                {jobs.slice(0, 4).map(job => <Link to="/applications" className="application-row" key={job.id}>
                  <span className="company-mark">{job.company.slice(0, 1).toUpperCase()}</span>
                  <span><strong>{job.role}</strong><small>{job.company}</small></span>
                  <span className={`status-pill ${statusClass(job.status)}`}>{job.status.replaceAll('_', ' ')}</span>
                  <span className="material-symbols-outlined row-arrow">chevron_right</span>
                </Link>)}
              </div>}
          </section>
        </div>

        <aside className="crm-side-column">
          <section className="crm-panel focus-panel">
            <div className="panel-heading"><div><p className="eyebrow">Focus queue</p><h2>Next up</h2></div><span className="focus-count">{activeTasks.length}</span></div>
            {priorityTasks.length === 0 ? <EmptyState icon="check_circle" title="You’re all caught up" message="No open tasks across your projects." to="/projects" action="View projects" /> :
              <div className="focus-list">{priorityTasks.map(task => <Link to={`/projects/${task.project_id}`} className="focus-task" key={task.id}>
                <span className={`priority-dot ${task.priority?.toLowerCase() || 'medium'}`} />
                <span><strong>{task.title}</strong><small>{taskProjectNames.get(task.project_id)} · {task.status.replaceAll('_', ' ')}</small></span>
                <span className="material-symbols-outlined row-arrow">arrow_forward</span>
              </Link>)}</div>}
          </section>

          <section className="crm-panel ideas-panel">
            <div className="panel-heading"><div><p className="eyebrow">Idea inbox</p><h2>Worth exploring</h2></div><Link to="/ideas" className="icon-action" aria-label="Open ideas"><span className="material-symbols-outlined">arrow_outward</span></Link></div>
            {ideas.length === 0 ? <p className="muted-empty">Your idea inbox is clear. Capture a spark before it gets away.</p> : <div className="idea-list">{ideas.slice(0, 3).map(idea => <Link to="/ideas" className="idea-row" key={idea.id}><span className="material-symbols-outlined">lightbulb</span><span><strong>{idea.title}</strong><small>{idea.category || 'Idea'} · {idea.status || 'New'}</small></span></Link>)}</div>}
            <Link to="/ideas" className="side-footer-action"><span className="material-symbols-outlined">add</span> Capture a new idea</Link>
          </section>
        </aside>
      </div>
    </main>
  );
}

function EmptyState({ icon, title, message, to, action }: { icon: string; title: string; message: string; to: string; action: string }) {
  return <div className="dashboard-empty"><span className="material-symbols-outlined">{icon}</span><div><strong>{title}</strong><p>{message}</p><Link to={to}>{action} <span className="material-symbols-outlined">arrow_forward</span></Link></div></div>;
}

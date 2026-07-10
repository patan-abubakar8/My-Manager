import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Project {
  id: number;
  name: string;
  description: string;
  tech_stack: string;
}

interface Job {
  id: number;
  company: string;
  role: string;
  status: string;
}

interface Idea {
  id: number;
  title: string;
  category: string;
  status: string;
}

interface Task {
  id: number;
  status: string;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [activeTasksCount, setActiveTasksCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch projects
        const projRes = await fetch('/api/v1/projects');
        const projData = await projRes.json();
        setProjects(projData);

        // Fetch jobs
        const jobsRes = await fetch('/api/v1/jobs');
        const jobsData = await jobsRes.json();
        setJobs(jobsData);

        // Fetch ideas
        const ideasRes = await fetch('/api/v1/ideas');
        const ideasData = await ideasRes.json();
        setIdeas(ideasData);

        // Fetch tasks for all projects to count active tasks
        let activeCount = 0;
        await Promise.all(
          projData.map(async (p: Project) => {
            try {
              const taskRes = await fetch(`/api/v1/tasks/project/${p.id}`);
              if (taskRes.ok) {
                const tasks: Task[] = await taskRes.json();
                activeCount += tasks.filter(t => t.status !== 'DONE').length;
              }
            } catch (err) {
              console.error(`Failed to fetch tasks for project ${p.id}`, err);
            }
          })
        );
        setActiveTasksCount(activeCount);
      } catch (error) {
        console.error('Failed to fetch dashboard data', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Personal Life & Career Command Center</h1>
      </div>

      <div className="dashboard-grid">
        <Link to="/projects" style={{ textDecoration: 'none' }}>
          <div className="glass-panel glass-card stat-card">
            <div className="stat-icon primary">
              <span className="material-symbols-outlined">folder</span>
            </div>
            <div>
              <div className="stat-label">Projects</div>
              <div className="stat-value">{projects.length}</div>
            </div>
          </div>
        </Link>

        <Link to="/projects" style={{ textDecoration: 'none' }}>
          <div className="glass-panel glass-card stat-card">
            <div className="stat-icon success">
              <span className="material-symbols-outlined">rule</span>
            </div>
            <div>
              <div className="stat-label">Active Tasks</div>
              <div className="stat-value">{activeTasksCount}</div>
            </div>
          </div>
        </Link>

        <Link to="/applications" style={{ textDecoration: 'none' }}>
          <div className="glass-panel glass-card stat-card">
            <div className="stat-icon warning">
              <span className="material-symbols-outlined">work</span>
            </div>
            <div>
              <div className="stat-label">Job Applications</div>
              <div className="stat-value">{jobs.length}</div>
            </div>
          </div>
        </Link>

        <Link to="/ideas" style={{ textDecoration: 'none' }}>
          <div className="glass-panel glass-card stat-card">
            <div className="stat-icon danger">
              <span className="material-symbols-outlined">lightbulb</span>
            </div>
            <div>
              <div className="stat-label">Ideas Logged</div>
              <div className="stat-value">{ideas.length}</div>
            </div>
          </div>
        </Link>
      </div>

      <div className="split-layout" style={{ marginTop: '20px' }}>
        <div className="split-main" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>rocket_launch</span>
              Active Projects Overview
            </h2>
            {projects.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No active projects. Ask Copilot to help you start one!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {projects.slice(0, 3).map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{p.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{p.description}</div>
                    </div>
                    {p.tech_stack && (
                      <span style={{ fontSize: '0.8rem', background: 'var(--accent-dim)', color: 'var(--accent-hover)', padding: '4px 8px', borderRadius: '4px' }}>
                        {p.tech_stack}
                      </span>
                    )}
                  </div>
                ))}
                {projects.length > 3 && (
                  <Link to="/projects" style={{ color: 'var(--accent-hover)', textDecoration: 'none', fontSize: '0.9rem', alignSelf: 'flex-start', marginTop: '10px' }}>
                    View all projects →
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--success-color)' }}>timeline</span>
              Recent Job Applications
            </h2>
            {jobs.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No job applications tracked yet. Keep chasing those dreams!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {jobs.slice(0, 3).map(j => (
                  <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{j.role}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{j.company}</div>
                    </div>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      background: j.status === 'OFFER' ? 'var(--success-bg)' : j.status === 'REJECTED' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                      color: j.status === 'OFFER' ? 'var(--success-color)' : j.status === 'REJECTED' ? 'var(--danger-color)' : 'var(--warning-color)'
                    }}>
                      {j.status}
                    </span>
                  </div>
                ))}
                {jobs.length > 3 && (
                  <Link to="/applications" style={{ color: 'var(--accent-hover)', textDecoration: 'none', fontSize: '0.9rem', alignSelf: 'flex-start', marginTop: '10px' }}>
                    View all applications →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="split-sidebar">
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--warning-color)' }}>tips_and_updates</span>
              Latest Ideas
            </h2>
            {ideas.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No ideas captured. Quick-capture them from the Ideas page or talk to Copilot!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {ideas.slice(0, 4).map(i => (
                  <div key={i.id} style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{i.title}</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                        {i.category}
                      </span>
                      <span style={{ fontSize: '0.75rem', background: 'var(--accent-dim)', color: 'var(--accent-hover)', padding: '2px 6px', borderRadius: '4px' }}>
                        {i.status}
                      </span>
                    </div>
                  </div>
                ))}
                <Link to="/ideas" style={{ color: 'var(--accent-hover)', textDecoration: 'none', fontSize: '0.9rem', marginTop: '10px' }}>
                  Open Ideas Board →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';

interface Idea {
  id: number;
  title: string;
  description: string;
  category: string; // Tech / Business / Life
  status: string; // Idea / Exploring / Parked / Building
}

interface IdeasProps {
  onDeepDive: (idea: Idea) => void;
}

export default function Ideas({ onDeepDive }: IdeasProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Tech');
  const [status, setStatus] = useState('Idea');

  useEffect(() => {
    fetchIdeas();
  }, []);

  async function fetchIdeas() {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/ideas');
      if (res.ok) {
        const data = await res.json();
        setIdeas(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      title,
      description,
      category,
      status
    };

    try {
      if (editingIdea) {
        const res = await fetch(`/api/v1/ideas/${editingIdea.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const updated = await res.json();
          setIdeas(ideas.map(i => i.id === editingIdea.id ? updated : i));
          setShowModal(false);
        }
      } else {
        const res = await fetch('/api/v1/ideas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const created = await res.json();
          setIdeas([created, ...ideas]);
          setShowModal(false);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id: number) {
    const confirmed = await (window as any).showConfirm(
      'Delete Idea',
      'Are you sure you want to delete this idea?',
      'Delete',
      'Cancel'
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/ideas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setIdeas(ideas.filter(i => i.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  }

  function openCreateModal() {
    setEditingIdea(null);
    setTitle('');
    setDescription('');
    setCategory('Tech');
    setStatus('Idea');
    setShowModal(true);
  }

  function openEditModal(idea: Idea) {
    setEditingIdea(idea);
    setTitle(idea.title);
    setDescription(idea.description || '');
    setCategory(idea.category || 'Tech');
    setStatus(idea.status || 'Idea');
    setShowModal(true);
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Ideas Board</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <span className="material-symbols-outlined">add</span> Capture Idea
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading ideas...</p>
      ) : ideas.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--accent-color)', marginBottom: '16px' }}>lightbulb</span>
          <p style={{ color: 'var(--text-secondary)' }}>No ideas logged yet. Got an inspiration? Capture it now!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {ideas.map(idea => (
            <div key={idea.id} className="glass-panel glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', minHeight: '180px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    background: idea.category === 'Tech' ? 'var(--accent-dim)' : idea.category === 'Business' ? 'var(--warning-bg)' : 'var(--success-bg)',
                    color: idea.category === 'Tech' ? 'var(--accent-hover)' : idea.category === 'Business' ? 'var(--warning-color)' : 'var(--success-color)',
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    fontWeight: 600
                  }}>
                    {idea.category}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    background: 'var(--sub-card-bg)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    fontWeight: 600
                  }}>
                    {idea.status}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '8px' }}>{idea.title}</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{idea.description}</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => onDeepDive(idea)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--accent-color)' }}>chat</span>
                  Deep-Dive Discussion
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-action-icon" onClick={() => openEditModal(idea)}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                  </button>
                  <button className="btn-delete-icon" onClick={() => handleDelete(idea.id)}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Capture / Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>{editingIdea ? 'Edit Idea' : 'Capture Idea'}</h3>
              <button className="collapse-btn" onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="title">Idea Title *</label>
                <input type="text" id="title" style={{ width: '100%' }} value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="description">Summary / Description</label>
                <textarea id="description" style={{ width: '100%', height: '100px' }} placeholder="What is the concept? What problems does it solve?..." value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="category">Category</label>
                  <select id="category" style={{ width: '100%' }} value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="Tech">Tech</option>
                    <option value="Business">Business</option>
                    <option value="Life">Life</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="status">Current Status</label>
                  <select id="status" style={{ width: '100%' }} value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="Idea">Idea Stage</option>
                    <option value="Exploring">Exploring</option>
                    <option value="Building">Building MVP</option>
                    <option value="Parked">Parked</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingIdea ? 'Save Changes' : 'Log Idea'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

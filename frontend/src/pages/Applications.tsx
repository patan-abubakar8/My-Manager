import React, { useEffect, useState } from 'react';

interface Job {
  id: number;
  company: string;
  role: string;
  status: string; // APPLIED, INTERVIEW, OFFER, REJECTED
  salary_range: string;
  job_description: string;
  job_url: string;
  applied_date: string;
  notes: string;
}

export default function Applications() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'tracker' | 'discover'>('tracker');
  
  // Discover search parameters
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchSource, setSearchSource] = useState<'global' | 'remote'>('global');
  const [searchCategory, setSearchCategory] = useState('software-development');
  const [searchDays, setSearchDays] = useState(7);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [autoTracking, setAutoTracking] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Custom Paste Auto-track form fields
  const [pasteUrl, setPasteUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteCompany, setPasteCompany] = useState('');
  const [pasteRole, setPasteRole] = useState('');
  const [pasteSalary, setPasteSalary] = useState('');
  const [showAutoTrackForm, setShowAutoTrackForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  // Form states
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('APPLIED');
  const [salaryRange, setSalaryRange] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [appliedDate, setAppliedDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchJobs();
  }, []);

  const triggerToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  async function fetchJobs() {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    try {
      setSearching(true);
      const url = `/api/v1/jobs/search?q=${encodeURIComponent(searchKeyword)}&category=${searchCategory}&days=${searchDays}&source=${searchSource}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
        if (data.length === 0) {
          setSelectedJob(null);
          triggerToast('No jobs found matching your criteria in this date span.', 'info');
        } else {
          setSelectedJob(data[0]);
          triggerToast(`Loaded ${data.length} job listings successfully.`, 'success');
        }
      } else {
        triggerToast('Failed to fetch job listings.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || 'Error fetching jobs.', 'error');
    } finally {
      setSearching(false);
    }
  }

  async function handleAutoTrack(jobData: { url: string; text?: string; company?: string; role?: string; salary?: string }) {
    try {
      setAutoTracking(true);
      const res = await fetch('/api/v1/jobs/auto-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_url: jobData.url,
          raw_text: jobData.text || '',
          company: jobData.company || '',
          role: jobData.role || '',
          salary_range: jobData.salary || ''
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'require_text') {
          triggerToast(data.detail, 'info');
          setShowAutoTrackForm(true);
          if (jobData.url) {
            setPasteUrl(jobData.url);
            setPasteCompany(jobData.company || '');
            setPasteRole(jobData.role || '');
            setPasteSalary(jobData.salary || '');
          }
        } else {
          triggerToast(`AI parsed & tracked: ${data.job.role} at ${data.job.company}!`, 'success');
          setJobs(prev => [...prev, data.job]);
          setPasteUrl('');
          setPasteText('');
          setPasteCompany('');
          setPasteRole('');
          setPasteSalary('');
          setActiveTab('tracker');
        }
      } else {
        triggerToast('Failed to save and analyze job details.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || 'Error saving job details.', 'error');
    } finally {
      setAutoTracking(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim() || !role.trim()) return;

    const payload = {
      company,
      role,
      status,
      salary_range: salaryRange,
      job_description: jobDescription,
      job_url: jobUrl,
      applied_date: appliedDate || null,
      notes
    };

    try {
      if (editingJob) {
        const res = await fetch(`/api/v1/jobs/${editingJob.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const updated = await res.json();
          setJobs(jobs.map(j => j.id === editingJob.id ? updated : j));
          setShowModal(false);
        }
      } else {
        const res = await fetch('/api/v1/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const created = await res.json();
          setJobs([...jobs, created]);
          setShowModal(false);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id: number) {
    const confirmed = await (window as any).showConfirm(
      'Delete Application',
      'Are you sure you want to delete this job application?',
      'Delete',
      'Cancel'
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/jobs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setJobs(jobs.filter(j => j.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  }

  function openCreateModal() {
    setEditingJob(null);
    setCompany('');
    setRole('');
    setStatus('APPLIED');
    setSalaryRange('');
    setJobDescription('');
    setJobUrl('');
    setAppliedDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setShowModal(true);
  }

  function openEditModal(job: Job) {
    setEditingJob(job);
    setCompany(job.company);
    setRole(job.role);
    setStatus(job.status || 'APPLIED');
    setSalaryRange(job.salary_range || '');
    setJobDescription(job.job_description || '');
    setJobUrl(job.job_url || '');
    setAppliedDate(job.applied_date || '');
    setNotes(job.notes || '');
    setShowModal(true);
  }

  const filteredJobs = filter === 'ALL'
    ? jobs
    : jobs.filter(j => j.status === filter);

  return (
    <div>
      {/* Toast Alert System */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          <span className="material-symbols-outlined">
            {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Loading overlay for AI parsing */}
      {autoTracking && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="glass-panel" style={{ padding: '30px 40px', textAlign: 'center', maxWidth: '400px' }}>
            <span className="material-symbols-outlined spinner" style={{ fontSize: '48px', color: 'var(--accent-color)', marginBottom: '16px' }}>autorenew</span>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem' }}>AI Parsing Job Details...</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
              Analyzing requirements, extracting HR email, skills, experience, and drafting notes.
            </p>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">Job Application Tracker</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <span className="material-symbols-outlined">add</span> Track Application
        </button>
      </div>

      {/* Tabs Header Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('tracker')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'tracker' ? '2px solid var(--accent-color)' : 'none',
            color: activeTab === 'tracker' ? 'var(--text-primary)' : 'var(--text-secondary)',
            padding: '12px 24px',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'tracker' ? '600' : '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          My Tracker
        </button>
        <button
          onClick={() => {
            setActiveTab('discover');
            if (searchResults.length === 0) {
              handleSearch();
            } else if (!selectedJob) {
              setSelectedJob(searchResults[0]);
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'discover' ? '2px solid var(--accent-color)' : 'none',
            color: activeTab === 'discover' ? 'var(--text-primary)' : 'var(--text-secondary)',
            padding: '12px 24px',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'discover' ? '600' : '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>explore</span>
          Discover Tech Jobs
        </button>
      </div>

      {activeTab === 'tracker' ? (
        <>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {['ALL', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'].map(s => (
              <button
                key={s}
                className={`btn ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(s)}
                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
              >
                {s}
              </button>
            ))}
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading job applications...</p>
          ) : filteredJobs.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--accent-color)', marginBottom: '16px' }}>work</span>
              <p style={{ color: 'var(--text-secondary)' }}>No applications in this category yet.</p>
            </div>
          ) : (
            <div className="glass-panel data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Salary Range</th>
                    <th>Applied Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map(job => (
                    <tr key={job.id}>
                      <td>
                        <span style={{ color: 'var(--text-primary)' }}>{job.company}</span>
                        {job.job_url && (
                          <a href={job.job_url} target="_blank" rel="noreferrer" style={{ marginLeft: '8px', color: 'var(--accent-hover)', textDecoration: 'none', display: 'inline-flex', verticalAlign: 'middle' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
                          </a>
                        )}
                      </td>
                      <td>{job.role}</td>
                      <td>
                        <span style={{
                          fontSize: '0.8rem',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: job.status === 'OFFER' ? 'var(--success-bg)' : job.status === 'REJECTED' ? 'var(--danger-bg)' : job.status === 'INTERVIEW' ? 'var(--accent-dim)' : 'var(--warning-bg)',
                          color: job.status === 'OFFER' ? 'var(--success-color)' : job.status === 'REJECTED' ? 'var(--danger-color)' : job.status === 'INTERVIEW' ? 'var(--accent-hover)' : 'var(--warning-color)'
                        }}>
                          {job.status}
                        </span>
                      </td>
                      <td>{job.salary_range || 'N/A'}</td>
                      <td>{job.applied_date || 'N/A'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="collapse-btn" onClick={() => openEditModal(job)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                          </button>
                          <button className="collapse-btn" onClick={() => handleDelete(job.id)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--danger-color)' }}>delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* Discover Tab Content */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Paste URL / Copy Text Accordion Card */}
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            {/* Clickable Header Accordion Toggle */}
            <div 
              onClick={() => setShowAutoTrackForm(!showAutoTrackForm)}
              style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                background: showAutoTrackForm ? 'rgba(91, 224, 38, 0.03)' : 'transparent',
                transition: 'background 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)', fontSize: '20px' }}>psychology</span>
                <span style={{ fontWeight: 500, fontSize: '0.95rem' }}>Auto-Track a Job with AI (Paste Link or Description)</span>
              </div>
              <span className="material-symbols-outlined" style={{ 
                transform: showAutoTrackForm ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}>
                expand_more
              </span>
            </div>

            {showAutoTrackForm && (
              <div className="animate-slide-down" style={{ padding: '0 20px 20px 20px', borderTop: '1px solid var(--border-color)' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '16px', marginBottom: '16px' }}>
                  Paste any company career link or copy-paste job description text from Wellfound, Naukri, or Foundit. The AI will extract HR contact email, required skills, experience level, and draft your tracker listing automatically.
                </p>
                
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!pasteUrl && !pasteText) {
                    triggerToast('Please provide a Career Page URL or paste Job Description text.', 'error');
                    return;
                  }
                  handleAutoTrack({
                    url: pasteUrl,
                    text: pasteText,
                    company: pasteCompany,
                    role: pasteRole,
                    salary: pasteSalary
                  });
                }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label htmlFor="p_company" style={{ fontSize: '0.8rem' }}>Company Name (Optional)</label>
                      <input type="text" id="p_company" placeholder="e.g. Google" style={{ width: '100%', padding: '8px' }} value={pasteCompany} onChange={e => setPasteCompany(e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="p_role" style={{ fontSize: '0.8rem' }}>Role Title (Optional)</label>
                      <input type="text" id="p_role" placeholder="e.g. UI Designer" style={{ width: '100%', padding: '8px' }} value={pasteRole} onChange={e => setPasteRole(e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="p_salary" style={{ fontSize: '0.8rem' }}>Salary Range (Optional)</label>
                      <input type="text" id="p_salary" placeholder="e.g. $90k - $110k" style={{ width: '100%', padding: '8px' }} value={pasteSalary} onChange={e => setPasteSalary(e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="p_url" style={{ fontSize: '0.8rem' }}>Job Posting / Career Page URL</label>
                    <input type="text" id="p_url" placeholder="https://company.com/careers/role-listing" style={{ width: '100%', padding: '8px' }} value={pasteUrl} onChange={e => setPasteUrl(e.target.value)} />
                  </div>

                  <div>
                    <label htmlFor="p_text" style={{ fontSize: '0.8rem' }}>Job Posting Text / Copy-pasted Description</label>
                    <textarea id="p_text" placeholder="Copy and paste the job details, requirements, contact details here..." style={{ width: '100%', height: '100px', padding: '8px' }} value={pasteText} onChange={e => setPasteText(e.target.value)} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>psychology</span>
                      Auto-Track with AI
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Online Search Section */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>travel_explore</span>
              Discover Global Remote Postings
            </h3>
            
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px' }}>
              <div style={{ flex: '1', minWidth: '200px' }}>
                <label htmlFor="s_keyword" style={{ fontSize: '0.8rem' }}>Search Keywords</label>
                <input type="text" id="s_keyword" placeholder="e.g. React, Python, Product Designer" style={{ width: '100%', padding: '8px' }} value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} />
              </div>

              <div>
                <label htmlFor="s_source" style={{ fontSize: '0.8rem' }}>Job Board Source</label>
                <select id="s_source" style={{ padding: '8px' }} value={searchSource} onChange={e => setSearchSource(e.target.value as 'global' | 'remote')}>
                  <option value="global">Global Boards (Naukri, Wellfound, Foundit)</option>
                  <option value="remote">Remote Aggregator (Remotive)</option>
                </select>
              </div>

              <div>
                <label htmlFor="s_category" style={{ fontSize: '0.8rem' }}>Category</label>
                <select id="s_category" style={{ padding: '8px' }} value={searchCategory} onChange={e => setSearchCategory(e.target.value)}>
                  <option value="software-development">Software Development</option>
                  <option value="design">Design & Creative</option>
                  <option value="product">Product Management</option>
                  <option value="data">Data Science / Analyst</option>
                  <option value="marketing">Marketing & Growth</option>
                  <option value="customer-support">Customer Support</option>
                  <option value="writing">Content & Writing</option>
                  <option value="sales">Sales & BizDev</option>
                  <option value="hr">HR & Recruiting</option>
                  <option value="finance-legal">Finance / Legal</option>
                  <option value="all">All Categories</option>
                </select>
              </div>

              <div>
                <label htmlFor="s_days" style={{ fontSize: '0.8rem' }}>Span (Date Posted)</label>
                <select id="s_days" style={{ padding: '8px' }} value={searchDays} onChange={e => setSearchDays(parseInt(e.target.value))}>
                  <option value="1">Last 24 Hours</option>
                  <option value="3">Last 3 Days</option>
                  <option value="7">Last 7 Days (Default)</option>
                  <option value="14">Last 14 Days</option>
                  <option value="30">Last 30 Days</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ height: '42px', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>
                {searching ? 'Searching...' : 'Search'}
              </button>
            </form>

            {searching ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <span className="material-symbols-outlined spinner" style={{ fontSize: '36px', color: 'var(--accent-color)', marginBottom: '12px' }}>autorenew</span>
                <p style={{ color: 'var(--text-secondary)' }}>Searching active online postings...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No active online listings found. Try adjusting your query or category filters.</p>
            ) : (
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Left Side: List of Jobs */}
                <div style={{ flex: '1', minWidth: '350px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {searchResults.map(job => {
                    const initial = job.company_name ? job.company_name.charAt(0).toUpperCase() : 'J';
                    const colors = [
                      { bg: 'rgba(91, 224, 38, 0.1)', text: 'var(--accent-color)' },
                      { bg: 'rgba(59, 141, 27, 0.1)', text: 'var(--success-color)' },
                      { bg: 'rgba(245, 158, 11, 0.1)', text: 'var(--warning-color)' },
                      { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--danger-color)' },
                      { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6' },
                      { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6' }
                    ];
                    const colorIndex = Math.abs((job.company_name || '').split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)) % colors.length;
                    const logoStyle = colors[colorIndex];
                    const isSelected = selectedJob?.id === job.id;

                    return (
                      <div 
                        key={job.id} 
                        className="job-list-card" 
                        onClick={() => setSelectedJob(job)}
                        style={{ 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          gap: '16px',
                          padding: '14px 18px',
                          cursor: 'pointer',
                          borderColor: isSelected ? 'var(--accent-color)' : 'var(--border-color)',
                          background: isSelected ? 'rgba(91, 224, 38, 0.04)' : 'var(--panel-bg)'
                        }}
                      >
                        {/* Logo + Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '220px' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '8px',
                            background: logoStyle.bg,
                            color: logoStyle.text,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            flexShrink: 0,
                            border: '1px solid rgba(255, 255, 255, 0.03)'
                          }}>
                            {initial}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                              {job.title}
                            </h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                              <span style={{ fontWeight: 500, color: 'var(--accent-color)' }}>{job.company_name}</span>
                              <span style={{ color: 'var(--text-muted)' }}>•</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{job.candidate_required_location || 'Worldwide'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Badges / Source on Right of Item */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ 
                            fontSize: '0.65rem', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            background: job.source === 'Naukri' ? 'var(--warning-bg)' : job.source === 'Wellfound' ? 'var(--success-bg)' : job.source === 'Foundit' ? 'var(--danger-bg)' : 'var(--border-color)', 
                            color: job.source === 'Naukri' ? 'var(--warning-color)' : job.source === 'Wellfound' ? 'var(--success-color)' : job.source === 'Foundit' ? 'var(--danger-color)' : 'var(--text-secondary)',
                            fontWeight: '600' 
                          }}>
                            {job.source}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right Side: Selected Job Details */}
                {selectedJob && (() => {
                  const initial = selectedJob.company_name ? selectedJob.company_name.charAt(0).toUpperCase() : 'J';
                  const colors = [
                    { bg: 'rgba(91, 224, 38, 0.1)', text: 'var(--accent-color)' },
                    { bg: 'rgba(59, 141, 27, 0.1)', text: 'var(--success-color)' },
                    { bg: 'rgba(245, 158, 11, 0.1)', text: 'var(--warning-color)' },
                    { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--danger-color)' },
                    { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6' },
                    { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6' }
                  ];
                  const colorIndex = Math.abs((selectedJob.company_name || '').split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)) % colors.length;
                  const logoStyle = colors[colorIndex];

                  return (
                    <div 
                      className="glass-panel animate-slide-down" 
                      style={{ 
                        width: '420px', 
                        flexShrink: 0, 
                        padding: '24px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '20px', 
                        height: 'fit-content', 
                        position: 'sticky', 
                        top: '24px',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      {/* Top Action Icons Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', gap: '8px' }}>
                        {/* Track by Link */}
                        <button 
                          className="action-box-btn"
                          onClick={() => handleAutoTrack({ 
                            url: selectedJob.url, 
                            company: selectedJob.company_name, 
                            role: selectedJob.title, 
                            salary: selectedJob.salary 
                          })}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--accent-color)' }}>link</span>
                          <span style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.5px' }}>TRACK LINK</span>
                        </button>

                        {/* Track by JD */}
                        <button 
                          className="action-box-btn"
                          onClick={() => handleAutoTrack({ 
                            url: selectedJob.url, 
                            text: selectedJob.description, 
                            company: selectedJob.company_name, 
                            role: selectedJob.title, 
                            salary: selectedJob.salary 
                          })}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--accent-color)' }}>description</span>
                          <span style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.5px' }}>TRACK JD</span>
                        </button>

                        {/* View Post */}
                        <a 
                          href={selectedJob.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="action-box-btn"
                          style={{ textDecoration: 'none' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>open_in_new</span>
                          <span style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.5px' }}>VIEW POST</span>
                        </a>

                        {/* Source Logo Box */}
                        <div style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          width: '72px',
                          height: '72px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}>
                          <span style={{ 
                            fontSize: '0.6rem', 
                            padding: '2px 4px', 
                            borderRadius: '4px', 
                            background: selectedJob.source === 'Naukri' ? 'var(--warning-bg)' : selectedJob.source === 'Wellfound' ? 'var(--success-bg)' : selectedJob.source === 'Foundit' ? 'var(--danger-bg)' : 'var(--border-color)', 
                            color: selectedJob.source === 'Naukri' ? 'var(--warning-color)' : selectedJob.source === 'Wellfound' ? 'var(--success-color)' : selectedJob.source === 'Foundit' ? 'var(--danger-color)' : 'var(--text-secondary)',
                            fontWeight: '700'
                          }}>
                            {selectedJob.source.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>SOURCE</span>
                        </div>

                        {/* Company Logo Box */}
                        <div style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          width: '72px',
                          height: '72px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}>
                          <div style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '6px',
                            background: logoStyle.bg,
                            color: logoStyle.text,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}>
                            {initial}
                          </div>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px', maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedJob.company_name.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Basic Information */}
                      <div>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px', fontWeight: 600 }}>
                          Basic Information
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '6px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Company</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedJob.company_name}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '6px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Role</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedJob.title}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '6px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Location</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedJob.candidate_required_location || 'Worldwide'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '6px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Salary</span>
                            <span style={{ color: 'var(--accent-color)', fontWeight: 500 }}>{selectedJob.salary || 'Not Specified'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '6px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Category</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedJob.category || 'Remote'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Date Posted</span>
                            <span style={{ color: 'var(--text-primary)' }}>{selectedJob.publication_date ? new Date(selectedJob.publication_date).toLocaleDateString() : 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Job Description */}
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', fontWeight: 600 }}>
                          Job Details & Description
                        </h4>
                        <div 
                          style={{ 
                            maxHeight: '220px', 
                            overflowY: 'auto', 
                            fontSize: '0.82rem', 
                            color: 'var(--text-secondary)', 
                            lineHeight: '1.6', 
                            paddingRight: '6px'
                          }}
                        >
                          {selectedJob.description ? (
                            <div dangerouslySetInnerHTML={{ __html: selectedJob.description }} />
                          ) : (
                            <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No description provided for this job listing.</p>
                          )}
                        </div>
                      </div>

                      {/* AI Copilot Suggestion Box (Matches the Robot Face) */}
                      <div style={{ 
                        display: 'flex', 
                        gap: '12px', 
                        alignItems: 'center', 
                        marginTop: '10px',
                        background: 'var(--accent-dim)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        border: '1px solid rgba(91, 224, 38, 0.15)'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: '#0b120f',
                          border: '2px solid var(--accent-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: '0 0 10px rgba(91, 224, 38, 0.2)'
                        }}>
                          <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)', fontSize: '22px' }}>smart_toy</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                          <strong>AI Copilot:</strong> Click <strong>TRACK LINK</strong> or <strong>TRACK JD</strong> to auto-import this job and analyze required skills.
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '650px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>{editingJob ? 'Edit Application' : 'Track New Application'}</h3>
              <button className="collapse-btn" onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="company">Company Name *</label>
                  <input type="text" id="company" style={{ width: '100%' }} value={company} onChange={e => setCompany(e.target.value)} required />
                </div>
                <div>
                  <label htmlFor="role">Role *</label>
                  <input type="text" id="role" style={{ width: '100%' }} value={role} onChange={e => setRole(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="status">Application Status</label>
                  <select id="status" style={{ width: '100%' }} value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="APPLIED">Applied</option>
                    <option value="INTERVIEW">Interviewing</option>
                    <option value="OFFER">Offer Received</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="salary">Salary Range</label>
                  <input type="text" id="salary" style={{ width: '100%' }} placeholder="e.g. $100k - $120k" value={salaryRange} onChange={e => setSalaryRange(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="job_url">Job Post Link</label>
                  <input type="text" id="job_url" style={{ width: '100%' }} placeholder="https://..." value={jobUrl} onChange={e => setJobUrl(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="applied_date">Date Applied</label>
                  <input type="date" id="applied_date" style={{ width: '100%', height: '42px' }} value={appliedDate} onChange={e => setAppliedDate(e.target.value)} />
                </div>
              </div>

              <div>
                <label htmlFor="jd">Job Description (JD pasting area for ATS optimization)</label>
                <textarea id="jd" style={{ width: '100%', height: '120px' }} placeholder="Paste requirements & skills here..." value={jobDescription} onChange={e => setJobDescription(e.target.value)} />
              </div>

              <div>
                <label htmlFor="notes">Personal Notes</label>
                <textarea id="notes" style={{ width: '100%', height: '80px' }} placeholder="Interview details, contact person, etc..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingJob ? 'Save Changes' : 'Track'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

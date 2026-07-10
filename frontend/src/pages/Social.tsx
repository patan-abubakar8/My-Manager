import React, { useState, useEffect } from 'react';

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

type TabType = 'github' | 'email' | 'naukri' | 'instagram' | 'linkedin';

export default function Social() {
  const [activeSubTab, setActiveSubTab] = useState<TabType>('github');
  const [projects, setProjects] = useState<Project[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // GitHub Connection States
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [gitProfile, setGitProfile] = useState<any | null>(null);
  const [gitRepos, setGitRepos] = useState<any[]>([]);
  const [fetchingGit, setFetchingGit] = useState<boolean>(false);

  // GitHub Drafter States
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [releaseVersion, setReleaseVersion] = useState<string>('v1.0.0');
  const [releaseFeatures, setReleaseFeatures] = useState<string>('');
  const [draftedRelease, setDraftedRelease] = useState<string>('');
  const [draftingRelease, setDraftingRelease] = useState<boolean>(false);

  // Email Outreach States
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [outreachType, setOutreachType] = useState<string>('cold');
  const [recruiterName, setRecruiterName] = useState<string>('');
  const [extraDetails, setExtraDetails] = useState<string>('');
  const [draftedSubject, setDraftedSubject] = useState<string>('');
  const [draftedBody, setDraftedBody] = useState<string>('');
  const [draftingEmail, setDraftingEmail] = useState<boolean>(false);

  // Naukri Optimizer States
  const [naukriRole, setNaukriRole] = useState<string>('');
  const [naukriSkills, setNaukriSkills] = useState<string>('');
  const [naukriExperience, setNaukriExperience] = useState<string>('');
  const [naukriHeadline, setNaukriHeadline] = useState<string>('');
  const [naukriSummary, setNaukriSummary] = useState<string>('');
  const [optimizingNaukri, setOptimizingNaukri] = useState<boolean>(false);

  // Instagram Caption States
  const [instaTopic, setInstaTopic] = useState<string>('');
  const [instaNiche, setInstaNiche] = useState<string>('Tech / Programming');
  const [instaCaption, setInstaCaption] = useState<string>('');
  const [instaHashtags, setInstaHashtags] = useState<string>('');
  const [generatingInsta, setGeneratingInsta] = useState<boolean>(false);

  // LinkedIn Post States
  const [linkedinTopic, setLinkedinTopic] = useState<string>('');
  const [linkedinDraft, setLinkedinDraft] = useState<string>('');
  const [draftingLinkedin, setDraftingLinkedin] = useState<boolean>(false);

  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoadingData(true);
        // Fetch projects
        const projRes = await fetch('/api/v1/projects');
        if (projRes.ok) {
          const projData = await projRes.json();
          setProjects(projData);
          if (projData.length > 0) setSelectedProjectId(String(projData[0].id));
        }

        // Fetch jobs
        const jobsRes = await fetch('/api/v1/jobs');
        if (jobsRes.ok) {
          const jobsData = await jobsRes.json();
          setJobs(jobsData);
          if (jobsData.length > 0) setSelectedJobId(String(jobsData[0].id));
        }

        // Load saved github user if any
        const savedUser = localStorage.getItem('github_username');
        if (savedUser) {
          setUsernameInput(savedUser);
          fetchGithubStats(savedUser);
        }
      } catch (err) {
        console.error('Error fetching social page data:', err);
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, []);

  const fetchGithubStats = async (uname: string) => {
    if (!uname.trim()) return;
    setFetchingGit(true);
    try {
      const profileRes = await fetch(`https://api.github.com/users/${uname}`);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setGitProfile(profileData);
        localStorage.setItem('github_username', uname);
        
        // Fetch repos
        const reposRes = await fetch(`https://api.github.com/users/${uname}/repos?sort=updated&per_page=6`);
        if (reposRes.ok) {
          const reposData = await reposRes.json();
          setGitRepos(reposData);
        }
        triggerToast(`Connected GitHub account: ${uname}!`, 'success');
      } else {
        triggerToast('GitHub user not found or API rate limit reached.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Failed to connect to GitHub API.', 'error');
    } finally {
      setFetchingGit(false);
    }
  };

  // Mock GitHub contribution map grid items
  const renderContributionGraph = () => {
    const cells = [];
    const colors = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
    for (let i = 0; i < 7; i++) {
      const row = [];
      for (let j = 0; j < 24; j++) {
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        row.push(
          <div
            key={`${i}-${j}`}
            style={{
              width: '10px',
              height: '10px',
              backgroundColor: randomColor,
              borderRadius: '2px',
              border: '1px solid rgba(0,0,0,0.1)'
            }}
            title={`Contributions: ${Math.floor(Math.random() * 8)}`}
          />
        );
      }
      cells.push(
        <div key={i} style={{ display: 'flex', gap: '3px' }}>
          {row}
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', width: 'fit-content' }}>
        {cells}
      </div>
    );
  };

  const handleDraftRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releaseFeatures.trim()) {
      triggerToast('Please describe the changes/features built.', 'error');
      return;
    }

    const project = projects.find(p => String(p.id) === selectedProjectId);
    const projectName = project ? project.name : 'my project';
    const projectStack = project ? project.tech_stack : '';

    setDraftingRelease(true);
    setDraftedRelease('');
    try {
      const prompt = `Write professional GitHub release notes for project "${projectName}" at version ${releaseVersion}.
The project's technology stack is: ${projectStack}.
Here are the changes, features, and fixes included in this release:
"${releaseFeatures}"

Provide a clean, structured release log formatted in Markdown. Include:
- A brief tagline about this version
- A "🚀 Key Highlights / Features" section with bullet points
- A "🔧 Bug Fixes & Refactoring" section
- An "📦 Installation / Getting Started" snippet based on the tech stack.`;

      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, page: 'social' })
      });

      if (res.ok) {
        const data = await res.json();
        setDraftedRelease(data.reply);
        triggerToast('Drafted release description successfully!', 'success');
      } else {
        triggerToast('Failed to generate release draft.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error during AI drafting.', 'error');
    } finally {
      setDraftingRelease(false);
    }
  };

  const handleDraftEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const job = jobs.find(j => String(j.id) === selectedJobId);
    const company = job ? job.company : 'the company';
    const role = job ? job.role : 'the role';

    setDraftingEmail(true);
    setDraftedSubject('');
    setDraftedBody('');

    try {
      let typeLabel = '';
      let directives = '';
      if (outreachType === 'cold') {
        typeLabel = 'Cold Outreach / Application Pitch';
        directives = `Write a persuasive pitch showing interest in the "${role}" role at "${company}". Emphasize quick learning, adaptability, and high coding capabilities. Add placeholders like [My Portfolio Link] and keep it professional and crisp.`;
      } else if (outreachType === 'followup') {
        typeLabel = 'Application Status Follow-up';
        directives = `Write a polite follow-up checking on the status of the application for "${role}" at "${company}". Reiterate enthusiasm for the opportunity.`;
      } else if (outreachType === 'thankyou') {
        typeLabel = 'Post-Interview Thank You';
        directives = `Write a warm thank-you email following an interview for the "${role}" position at "${company}". Mention appreciation for their time and reference discussing key features/requirements (e.g. ${extraDetails || 'team dynamics'}).`;
      } else if (outreachType === 'negotiation') {
        typeLabel = 'Offer Negotiation';
        directives = `Write a professional, collaborative negotiation email regarding a job offer for the "${role}" role at "${company}". Politely ask if there is room for adjustment in base salary/terms while expressing absolute excitement to join.`;
      }

      const prompt = `Compose a professional job seeker outreach email.
Context:
- Type: ${typeLabel}
- Company: ${company}
- Position: ${role}
- Recruiter/Contact Name: ${recruiterName || 'Hiring Team'}
- Specific Details: ${extraDetails || 'N/A'}

Directives:
${directives}

Format your reply as a JSON object inside raw text (do not use code blocks, just return normal text) containing exactly two fields:
Subject: <write a clean, high-open-rate subject line>
Body: <write the complete email body with clear paragraphs and line breaks>

If you cannot output JSON, separate the subject and body with a double line break and write:
SUBJECT: <subject>
BODY: <body>`;

      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, page: 'social' })
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.reply;

        let parsedSubject = '';
        let parsedBody = '';

        if (reply.includes('"Subject":') || reply.includes('"subject":')) {
          try {
            const cleanJson = reply.substring(reply.indexOf('{'), reply.lastIndexOf('}') + 1);
            const parsedObj = JSON.parse(cleanJson);
            parsedSubject = parsedObj.Subject || parsedObj.subject || '';
            parsedBody = parsedObj.Body || parsedObj.body || '';
          } catch (e) {}
        }

        if (!parsedSubject || !parsedBody) {
          if (reply.includes('SUBJECT:') && reply.includes('BODY:')) {
            const parts = reply.split('BODY:');
            parsedSubject = parts[0].replace('SUBJECT:', '').replace('Subject:', '').trim();
            parsedBody = parts[1].trim();
          } else {
            parsedSubject = `Follow up regarding ${role} application at ${company}`;
            parsedBody = reply;
          }
        }

        setDraftedSubject(parsedSubject);
        setDraftedBody(parsedBody);
        triggerToast('Drafted outreach email successfully!', 'success');
      } else {
        triggerToast('Failed to generate email draft.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error during email AI drafting.', 'error');
    } finally {
      setDraftingEmail(false);
    }
  };

  const handleOptimizeNaukri = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naukriRole.trim()) {
      triggerToast('Please enter your target role.', 'error');
      return;
    }
    setOptimizingNaukri(true);
    setNaukriHeadline('');
    setNaukriSummary('');
    try {
      const prompt = `Create an optimized Naukri Profile Headline and Profile Summary paragraph.
- Target Role: ${naukriRole}
- Core Skills: ${naukriSkills || 'Web Development, Programming'}
- Years of Experience: ${naukriExperience || 'Entry-Level'}

Make the headline highly discoverable (rich in keywords for recruiter search algorithms, under 220 chars).
Make the profile summary summary a punchy 3-sentence summary highlighting key accomplishments.

Format the response like:
HEADLINE: <headline text>
SUMMARY: <summary paragraph>`;

      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, page: 'social' })
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.reply;
        if (reply.includes('HEADLINE:') && reply.includes('SUMMARY:')) {
          const parts = reply.split('SUMMARY:');
          setNaukriHeadline(parts[0].replace('HEADLINE:', '').trim());
          setNaukriSummary(parts[1].trim());
        } else {
          setNaukriHeadline(`${naukriRole} | Specialist in ${naukriSkills}`);
          setNaukriSummary(reply);
        }
        triggerToast('Naukri elements optimized successfully!', 'success');
      } else {
        triggerToast('Failed to optimize Naukri elements.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error during Naukri AI build.', 'error');
    } finally {
      setOptimizingNaukri(false);
    }
  };

  const handleGenerateInsta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instaTopic.trim()) {
      triggerToast('Please provide a post topic/idea.', 'error');
      return;
    }
    setGeneratingInsta(true);
    setInstaCaption('');
    setInstaHashtags('');
    try {
      const prompt = `Draft a compelling Instagram caption for a software developer/creator post.
- Post Topic/Snippet Idea: "${instaTopic}"
- Target Niche: ${instaNiche}

Directives:
- Write an engaging, micro-blog format caption. Hook the user in the first line.
- Use emojis naturally.
- Append a separate line with 10-15 highly popular and relevant tech hashtags.

Format the response like:
CAPTION: <caption text>
HASHTAGS: <hashtags separated by spaces>`;

      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, page: 'social' })
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.reply;
        if (reply.includes('CAPTION:') && reply.includes('HASHTAGS:')) {
          const parts = reply.split('HASHTAGS:');
          setInstaCaption(parts[0].replace('CAPTION:', '').trim());
          setInstaHashtags(parts[1].trim());
        } else {
          setInstaCaption(reply);
          setInstaHashtags('#coding #programmer #developer #javascript #tech');
        }
        triggerToast('Instagram post content drafted!', 'success');
      } else {
        triggerToast('Failed to generate Instagram draft.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error drafting post.', 'error');
    } finally {
      setGeneratingInsta(false);
    }
  };

  const handleDraftLinkedin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedinTopic.trim()) {
      triggerToast('Please specify what your post is about.', 'error');
      return;
    }
    setDraftingLinkedin(true);
    setLinkedinDraft('');
    try {
      const prompt = `Compose a viral, professional LinkedIn post update based on:
"${linkedinTopic}"

Directives:
- Start with a strong hook line (make readers click "see more").
- Use high readability line breaks (no thick walls of text).
- Include bullet points for key achievements, steps, or learnings.
- End with an engaging question to drive comments.
- Keep the tone optimistic, educational, and professional.`;

      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, page: 'social' })
      });

      if (res.ok) {
        const data = await res.json();
        setLinkedinDraft(data.reply);
        triggerToast('Drafted LinkedIn post update!', 'success');
      } else {
        triggerToast('Failed to compose LinkedIn post.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error during LinkedIn generation.', 'error');
    } finally {
      setDraftingLinkedin(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    triggerToast(`${label} copied to clipboard!`, 'success');
  };

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

      <div className="page-header">
        <h1 className="page-title">Social & Communication Hub</h1>
      </div>

      {/* Main Page Split Layout */}
      <div style={{ display: 'flex', gap: '20px', minHeight: 'calc(100vh - 180px)', alignItems: 'stretch' }}>
        
        {/* Dynamic Panels Content Panel */}
        <div style={{ flex: '1', minWidth: 0 }}>
          
          {loadingData ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading integrations...</p>
          ) : activeSubTab === 'github' ? (
            /* ==================== GITHUB HUB ==================== */
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }} className="animate-slide-down">
              <div style={{ flex: '1', minWidth: '350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* GitHub Connection */}
                <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)', fontSize: '28px' }}>account_circle</span>
                  <div style={{ flex: '1', minWidth: '200px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Connect Public GitHub Account</span>
                    {gitProfile ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={gitProfile.avatar_url} alt="avatar" style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--accent-color)' }} />
                        <span style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {gitProfile.name || gitProfile.login} (@{gitProfile.login})
                        </span>
                      </div>
                    ) : (
                      <input 
                        type="text" 
                        placeholder="Enter your GitHub username" 
                        style={{ width: '100%', padding: '6px 10px', height: '32px', fontSize: '0.85rem' }} 
                        value={usernameInput} 
                        onChange={e => setUsernameInput(e.target.value)} 
                        onKeyDown={e => { if (e.key === 'Enter') fetchGithubStats(usernameInput); }}
                      />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {gitProfile ? (
                      <button 
                        className="btn btn-secondary" 
                        style={{ height: '32px', padding: '0 12px', fontSize: '0.8rem' }}
                        onClick={() => {
                          setGitProfile(null);
                          setGitRepos([]);
                          setUsernameInput('');
                          localStorage.removeItem('github_username');
                          triggerToast('Disconnected GitHub account.', 'info');
                        }}
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button 
                        className="btn btn-primary" 
                        style={{ height: '32px', padding: '0 12px', fontSize: '0.8rem' }}
                        onClick={() => fetchGithubStats(usernameInput)}
                        disabled={fetchingGit || !usernameInput.trim()}
                      >
                        {fetchingGit ? 'Connecting...' : 'Connect'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Profile Metrics */}
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>analytics</span>
                    GitHub Developer Stats
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--accent-color)' }}>
                        {gitProfile ? gitProfile.public_repos : projects.length}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {gitProfile ? 'PUBLIC REPOS' : 'LOCAL PROJECTS'}
                      </div>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {gitProfile ? gitProfile.followers : 0}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>FOLLOWERS</div>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--accent-color)' }}>
                        {gitProfile ? gitProfile.public_gists : 0}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>PUBLIC GISTS</div>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Contribution History Map
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px', marginTop: 0 }}>
                    Visual map (simulated contribution coordinate display)
                  </p>
                  {renderContributionGraph()}
                </div>

                {/* Repositories */}
                {gitRepos.length > 0 && (
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '1.05rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>list_alt</span>
                      Latest Public Repositories (@{gitProfile?.login})
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {gitRepos.map(repo => (
                        <div key={repo.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{repo.name}</strong>
                              {repo.language && (
                                <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'var(--accent-dim)', color: 'var(--accent-hover)', flexShrink: 0 }}>
                                  {repo.language}
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '6px 0', height: '36px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {repo.description || 'No description provided.'}
                            </p>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '6px', marginTop: '4px' }}>
                            <span>⭐ {repo.stargazers_count}</span>
                            <a href={repo.html_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 500 }}>
                              View
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Release log compiler */}
              <div className="glass-panel" style={{ width: '400px', flexShrink: 0, padding: '20px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>smart_toy</span>
                  AI Release Notes Drafter
                </h3>
                
                <form onSubmit={handleDraftRelease} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label htmlFor="git_project">Select Project</label>
                    {projects.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No projects available. Create a project first!</p>
                    ) : (
                      <select id="git_project" style={{ width: '100%' }} value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label htmlFor="git_version">Release Version Tag</label>
                    <input type="text" id="git_version" placeholder="e.g. v1.0.0" style={{ width: '100%' }} value={releaseVersion} onChange={e => setReleaseVersion(e.target.value)} required />
                  </div>

                  <div>
                    <label htmlFor="git_features">Describe What was Built / Changed</label>
                    <textarea id="git_features" placeholder="e.g. Built collapsible form in applications page, redesigned job card to be horizontal split-pane list layout, fixed settings page build issue" style={{ width: '100%', height: '80px' }} value={releaseFeatures} onChange={e => setReleaseFeatures(e.target.value)} required />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }} disabled={draftingRelease || projects.length === 0}>
                    {draftingRelease ? 'Drafting Release Log...' : 'Draft Release Notes'}
                  </button>
                </form>

                {draftedRelease && (
                  <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '20px', paddingTop: '16px' }} className="animate-slide-down">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Drafted Markdown</h4>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => copyToClipboard(draftedRelease, 'Release Notes')}>
                        Copy Draft
                      </button>
                    </div>
                    <textarea
                      readOnly
                      style={{ width: '100%', height: '200px', fontFamily: 'monospace', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', padding: '10px' }}
                      value={draftedRelease}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : activeSubTab === 'email' ? (
            /* ==================== EMAIL HUB ==================== */
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }} className="animate-slide-down">
              <div style={{ flex: '1', minWidth: '350px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>rate_review</span>
                    Draft Recruiter Outreach Email
                  </h3>

                  <form onSubmit={handleDraftEmail} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label htmlFor="email_job">Linked Tracked Application</label>
                      {jobs.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No job applications tracked. Create a job application first!</p>
                      ) : (
                        <select id="email_job" style={{ width: '100%' }} value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}>
                          {jobs.map(j => (
                            <option key={j.id} value={j.id}>{j.role} at {j.company}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label htmlFor="email_type">Outreach Type</label>
                        <select id="email_type" style={{ width: '100%' }} value={outreachType} onChange={e => setOutreachType(e.target.value)}>
                          <option value="cold">Cold Pitch Email</option>
                          <option value="followup">Application Follow-up</option>
                          <option value="thankyou">Post-Interview Thank You</option>
                          <option value="negotiation">Offer Negotiation</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="email_recruiter">Contact Name (Optional)</label>
                        <input type="text" id="email_recruiter" placeholder="e.g. John Doe" style={{ width: '100%' }} value={recruiterName} onChange={e => setRecruiterName(e.target.value)} />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="email_details">Extra Context / Talking Points</label>
                      <textarea id="email_details" placeholder="e.g. Mentioned our discussion on database migrations, or requested base salary adjust of 5%..." style={{ width: '100%', height: '80px' }} value={extraDetails} onChange={e => setExtraDetails(e.target.value)} />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }} disabled={draftingEmail || jobs.length === 0}>
                      {draftingEmail ? 'Drafting Email...' : 'Draft Email with AI'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Draft display */}
              <div className="glass-panel" style={{ width: '400px', flexShrink: 0, padding: '20px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>mail_outline</span>
                  AI Drafted Email
                </h3>

                {!draftedSubject && !draftedBody ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '40px 0' }}>
                    Fill out outreach details and trigger drafting to see your personalized template.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-slide-down">
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>SUBJECT LINE</span>
                        <button className="collapse-btn" style={{ padding: '2px 6px', fontSize: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} onClick={() => copyToClipboard(draftedSubject, 'Subject Line')}>
                          Copy
                        </button>
                      </div>
                      <input readOnly style={{ width: '100%', fontWeight: 500 }} value={draftedSubject} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>EMAIL BODY</span>
                        <button className="collapse-btn" style={{ padding: '2px 6px', fontSize: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} onClick={() => copyToClipboard(draftedBody, 'Email Body')}>
                          Copy
                        </button>
                      </div>
                      <textarea readOnly style={{ width: '100%', height: '240px', lineHeight: '1.5' }} value={draftedBody} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : activeSubTab === 'naukri' ? (
            /* ==================== NAUKRI HUB ==================== */
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }} className="animate-slide-down">
              <div style={{ flex: '1', minWidth: '350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>work</span>
                    Naukri Profile Activity
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--accent-color)' }}>92%</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>PROFILE SCORE</div>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>148</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>SEARCH APPEARANCES</div>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--accent-color)' }}>12</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>RECRUITER VIEWS</div>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Naukri Profile Optimization Checklist
                  </h4>
                  <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '20px', lineHeight: '1.8' }}>
                    <li>✔️ Verified Mobile Number & Email ID</li>
                    <li>✔️ Key Skills updated with search keywords</li>
                    <li>✔️ Resume headline loaded with target roles</li>
                    <li>❌ Master profile details updated within 15 days (Update pending)</li>
                  </ul>
                </div>
              </div>

              {/* Naukri optimizer tool */}
              <div className="glass-panel" style={{ width: '400px', flexShrink: 0, padding: '20px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>bolt</span>
                  Naukri Headline Optimizer
                </h3>
                
                <form onSubmit={handleOptimizeNaukri} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label htmlFor="naukri_role">Target Role</label>
                    <input type="text" id="naukri_role" placeholder="e.g. Senior Fullstack Developer" style={{ width: '100%' }} value={naukriRole} onChange={e => setNaukriRole(e.target.value)} required />
                  </div>

                  <div>
                    <label htmlFor="naukri_skills">Key Skills (Comma-separated)</label>
                    <input type="text" id="naukri_skills" placeholder="e.g. React, Node, Python, AWS" style={{ width: '100%' }} value={naukriSkills} onChange={e => setNaukriSkills(e.target.value)} />
                  </div>

                  <div>
                    <label htmlFor="naukri_exp">Years of Experience</label>
                    <input type="text" id="naukri_exp" placeholder="e.g. 4 Years" style={{ width: '100%' }} value={naukriExperience} onChange={e => setNaukriExperience(e.target.value)} />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }} disabled={optimizingNaukri}>
                    {optimizingNaukri ? 'Optimizing Profile Headline...' : 'Optimize Headline & Summary'}
                  </button>
                </form>

                {(naukriHeadline || naukriSummary) && (
                  <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '20px', paddingTop: '16px' }} className="animate-slide-down">
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Naukri Resume Headline</span>
                        <button className="collapse-btn" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => copyToClipboard(naukriHeadline, 'Naukri Headline')}>Copy</button>
                      </div>
                      <input readOnly style={{ width: '100%', fontSize: '0.85rem' }} value={naukriHeadline} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Profile Summary Paragraph</span>
                        <button className="collapse-btn" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => copyToClipboard(naukriSummary, 'Naukri Summary')}>Copy</button>
                      </div>
                      <textarea readOnly style={{ width: '100%', height: '100px', fontSize: '0.8rem', lineHeight: '1.4' }} value={naukriSummary} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : activeSubTab === 'instagram' ? (
            /* ==================== INSTAGRAM HUB ==================== */
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }} className="animate-slide-down">
              <div style={{ flex: '1', minWidth: '350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>photo_camera</span>
                    Developer Creator Stats
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--accent-color)' }}>2.4k</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>FOLLOWERS</div>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>12.4k</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>IMPRESSIONS (30D)</div>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--accent-color)' }}>8.4%</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>ENGAGEMENT RATE</div>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Visual Content Schedule
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 600 }}>TUESDAY</span>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-primary)', margin: '4px 0 0 0' }}>Code Refactoring Reels Tutorial</p>
                    </div>
                    <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--success-color)', fontWeight: 600 }}>THURSDAY</span>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-primary)', margin: '4px 0 0 0' }}>Setup Showcase / Desk Details</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instagram post composer tool */}
              <div className="glass-panel" style={{ width: '400px', flexShrink: 0, padding: '20px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>auto_awesome</span>
                  AI Caption & Hashtags Generator
                </h3>
                
                <form onSubmit={handleGenerateInsta} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label htmlFor="insta_topic">Post Topic / Photo Details</label>
                    <textarea id="insta_topic" placeholder="e.g. Tips on how to structure large Postgres indexes, or showing off my new dark mode terminal setup" style={{ width: '100%', height: '80px' }} value={instaTopic} onChange={e => setInstaTopic(e.target.value)} required />
                  </div>

                  <div>
                    <label htmlFor="insta_niche">Niche / Target Audience</label>
                    <select id="insta_niche" style={{ width: '100%' }} value={instaNiche} onChange={e => setInstaNiche(e.target.value)}>
                      <option value="Tech / Programming">Tech / Programming</option>
                      <option value="Productivity / Career">Productivity / Career</option>
                      <option value="Desk Setup / Hardware">Desk Setup / Hardware</option>
                      <option value="Self-Improvement">Self-Improvement</option>
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }} disabled={generatingInsta}>
                    {generatingInsta ? 'Generating Post Content...' : 'Draft Caption & Hashtags'}
                  </button>
                </form>

                {(instaCaption || instaHashtags) && (
                  <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '20px', paddingTop: '16px' }} className="animate-slide-down">
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Captions</span>
                        <button className="collapse-btn" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => copyToClipboard(instaCaption, 'Caption')}>Copy</button>
                      </div>
                      <textarea readOnly style={{ width: '100%', height: '140px', fontSize: '0.8rem', lineHeight: '1.4' }} value={instaCaption} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Hashtags</span>
                        <button className="collapse-btn" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => copyToClipboard(instaHashtags, 'Hashtags')}>Copy</button>
                      </div>
                      <input readOnly style={{ width: '100%', fontSize: '0.85rem' }} value={instaHashtags} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ==================== LINKEDIN STUDIO ==================== */
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }} className="animate-slide-down">
              <div style={{ flex: '1', minWidth: '350px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>hub</span>
                    LinkedIn Post Composer
                  </h3>

                  <form onSubmit={handleDraftLinkedin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label htmlFor="linkedin_topic">What is your post/update about?</label>
                      <textarea 
                        id="linkedin_topic" 
                        placeholder="e.g. I just completed building a custom PostgreSQL connector for my personal dashboard. Learned about connection pooling limitations, check details..." 
                        style={{ width: '100%', height: '120px' }} 
                        value={linkedinTopic} 
                        onChange={e => setLinkedinTopic(e.target.value)} 
                        required 
                      />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }} disabled={draftingLinkedin}>
                      {draftingLinkedin ? 'Writing Post Hook & Body...' : 'Draft Professional LinkedIn Update'}
                    </button>
                  </form>
                </div>
              </div>

              {/* LinkedIn Post Output */}
              <div className="glass-panel" style={{ width: '400px', flexShrink: 0, padding: '20px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>feed</span>
                  Drafted LinkedIn Post
                </h3>

                {!linkedinDraft ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '40px 0' }}>
                    Describe your professional accomplishment or update and trigger drafting to see your high-engagement LinkedIn post.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-slide-down">
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>LINKEDIN POST COPY</span>
                        <button className="collapse-btn" style={{ padding: '2px 6px', fontSize: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} onClick={() => copyToClipboard(linkedinDraft, 'LinkedIn Post')}>
                          Copy Post
                        </button>
                      </div>
                      <textarea readOnly style={{ width: '100%', height: '280px', lineHeight: '1.5', fontSize: '0.82rem' }} value={linkedinDraft} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Black Vertical Navigation Strip */}
        <div 
          style={{
            width: '60px',
            background: '#0d0e12',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '16px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            flexShrink: 0,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}
        >
          {[
            { id: 'github', iconClass: 'fa-brands fa-github', label: 'GitHub Developer Hub' },
            { id: 'email', iconClass: 'fa-solid fa-envelope', label: 'AI Email Outreach' },
            { id: 'naukri', iconClass: 'fa-solid fa-briefcase', label: 'Naukri Profile Hub' },
            { id: 'instagram', iconClass: 'fa-brands fa-instagram', label: 'Instagram Creator Hub' },
            { id: 'linkedin', iconClass: 'fa-brands fa-linkedin', label: 'LinkedIn Post Studio' }
          ].map(item => {
            const isActive = activeSubTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id as TabType)}
                title={item.label}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? 'var(--accent-color)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseOver={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <i className={item.iconClass} style={{ fontSize: '18px' }}></i>
                
                {/* Active Indicator Bar */}
                {isActive && (
                  <div 
                    style={{
                      position: 'absolute',
                      left: '-2px',
                      top: '14px',
                      width: '4px',
                      height: '14px',
                      backgroundColor: '#fff',
                      borderRadius: '4px 0 0 4px'
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

      </div>

    </div>
  );
}

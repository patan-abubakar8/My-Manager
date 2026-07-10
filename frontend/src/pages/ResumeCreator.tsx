import { useEffect, useState } from 'react';

interface Job {
  id: number;
  company: string;
  role: string;
  job_description: string;
}


interface TailoredResume {
  job_application_id: number;
  tailored_summary: string;
  tailored_experience_json: string;
  cover_letter: string;
  ats_score: number;
  ats_feedback: string; // JSON array string
  ats_keywords: string; // {"matched": [], "missing": []}
}

export default function ResumeCreator() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [profileMode, setProfileMode] = useState<'upload' | 'paste' | 'form'>('upload');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | ''>('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Master Profile state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [summary, setSummary] = useState('');
  const [experience, setExperience] = useState<any[]>([]);
  const [education, setEducation] = useState<any[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [projectsList, setProjectsList] = useState<any[]>([]);

  // Parser text input
  const [rawTextImport, setRawTextImport] = useState('');
  const [fileLoading, setFileLoading] = useState(false);

  // Two-stage upload & real-time tracing states
  const [uploadedFile, setUploadedFile] = useState<{ name: string; text: string } | null>(null);
  const [showProgressModal, setShowProgressModal] = useState<boolean>(false);
  const [progressLogs, setProgressLogs] = useState<string[]>([]);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentProgressStep, setCurrentProgressStep] = useState<number>(0);

  // Tailoring state
  const [tailoring, setTailoring] = useState(false);
  const [tailoredData, setTailoredData] = useState<TailoredResume | null>(null);
  
  // Custom project recommendations state
  const [recommendations, setRecommendations] = useState<string>('');
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  function triggerToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    setToast({ message, type });
  }

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    fetchMasterProfile();
    fetchJobs();
  }, []);

  async function fetchMasterProfile() {
    try {
      const res = await fetch('/api/v1/resumes/master');
      if (res.ok) {
        const data = await res.json();
        setFullName(data.full_name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setSummary(data.summary || '');
        
        try { setExperience(JSON.parse(data.experience_json || '[]')); } catch { setExperience([]); }
        try { setEducation(JSON.parse(data.education_json || '[]')); } catch { setEducation([]); }
        try { setSkills(JSON.parse(data.skills_json || '[]')); } catch { setSkills([]); }
        try { setProjectsList(JSON.parse(data.projects_json || '[]')); } catch { setProjectsList([]); }

        if (data.full_name && data.full_name !== 'Your Name') {
          setProfileMode('form');
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchJobs() {
    try {
      const res = await fetch('/api/v1/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
        if (data.length > 0) {
          setSelectedJobId(data[0].id);
          setSelectedJob(data[0]);
          handleLoadTailored(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSaveMaster(e?: React.FormEvent) {
    if (e) e.preventDefault();
    try {
      const res = await fetch('/api/v1/resumes/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
          summary,
          experience_json: JSON.stringify(experience),
          education_json: JSON.stringify(education),
          skills_json: JSON.stringify(skills),
          projects_json: JSON.stringify(projectsList)
        })
      });
      if (res.ok) {
        triggerToast('Master profile saved successfully!', 'success');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Failed to save master profile.', 'error');
    }
  }

  async function triggerAIParse(rawText: string) {
    if (!rawText.trim()) return;

    // Reset progress tracking states
    setProgressLogs([]);
    setProgressPercent(5);
    setCurrentProgressStep(0);
    setShowProgressModal(true);

    const steps = [
      { log: '🔍 Extracting layout & section structures...', delay: 800, pct: 20 },
      { log: '🧠 Analyzing candidate profile summary...', delay: 1800, pct: 40 },
      { log: '💼 Processing professional experience timelines...', delay: 3000, pct: 60 },
      { log: '🛠️ Identifying technical skills and projects...', delay: 4200, pct: 80 },
      { log: '📝 Mapping parsed structure into JSON schema...', delay: 5400, pct: 95 }
    ];

    // Start running simulated progress logs concurrently with the API call
    const startTime = Date.now();
    const logTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      
      // Check which steps should be output based on elapsed time
      let activeStepIdx = 0;
      steps.forEach((step, idx) => {
        if (elapsed >= step.delay) {
          activeStepIdx = idx + 1;
        }
      });

      setCurrentProgressStep(activeStepIdx);
      
      // Update logs list
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const newLogs = [`[${timestamp}] ⚙️ Initializing AI parser workspace...`];
      
      for (let i = 0; i < activeStepIdx; i++) {
        const stepTime = new Date(startTime + steps[i].delay).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        newLogs.push(`[${stepTime}] ${steps[i].log}`);
      }
      
      setProgressLogs(newLogs);
      setProgressPercent(activeStepIdx === 0 ? 10 : steps[activeStepIdx - 1].pct);
    }, 300);

    try {
      const res = await fetch('/api/v1/resumes/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: rawText })
      });

      if (res.ok) {
        const data = await res.json();
        // Pause briefly to let the user appreciate the final status
        clearInterval(logTimer);
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setProgressLogs(prev => [...prev, `[${timestamp}] ✅ Structuring completed successfully!`]);
        setProgressPercent(100);
        setCurrentProgressStep(5);

        setTimeout(() => {
          setFullName(data.full_name || '');
          setEmail(data.email || '');
          setPhone(data.phone || '');
          setSummary(data.summary || '');
          try { setExperience(JSON.parse(data.experience_json || '[]')); } catch { setExperience([]); }
          try { setEducation(JSON.parse(data.education_json || '[]')); } catch { setEducation([]); }
          try { setSkills(JSON.parse(data.skills_json || '[]')); } catch { setSkills([]); }
          try { setProjectsList(JSON.parse(data.projects_json || '[]')); } catch { setProjectsList([]); }
          
          setShowProgressModal(false);
          setUploadedFile(null); // Clear uploaded file status
          setProfileMode('form'); // Switch to the form editor sub-tab
        }, 1200);
      } else {
        clearInterval(logTimer);
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.detail || 'Failed to parse resume text.';
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setProgressLogs(prev => [...prev, `[${timestamp}] ❌ Extraction failed: ${errMsg}`]);
        triggerToast(errMsg, 'error');
        setTimeout(() => setShowProgressModal(false), 4000);
      }
    } catch (err: any) {
      clearInterval(logTimer);
      console.error(err);
      const errMsg = err.message || 'An error occurred during resume parsing.';
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setProgressLogs(prev => [...prev, `[${timestamp}] ❌ Extraction failed: ${errMsg}`]);
      triggerToast(errMsg, 'error');
      setTimeout(() => setShowProgressModal(false), 4000);
    }
  }

  async function handleImportResume() {
    if (!rawTextImport.trim()) return;
    await triggerAIParse(rawTextImport);
    setRawTextImport('');
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      (window as any).showToast('Please upload a PDF file only.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setFileLoading(true);
      const res = await fetch('/api/v1/resumes/upload-pdf', {
        method: 'POST',
        body: formData
      });
      
      if (res.ok) {
        const data = await res.json();
        setUploadedFile({
          name: data.filename,
          text: data.extracted_text
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        (window as any).showToast(errData.detail || 'Failed to upload and extract PDF.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      (window as any).showToast('An error occurred while uploading the file.', 'error');
    } finally {
      setFileLoading(false);
      if (e.target) e.target.value = '';
    }
  }

  async function handleTailorResume() {
    if (!selectedJobId) return;
    try {
      setTailoring(true);
      setRecommendations('');
      // Save master first just in case
      await handleSaveMaster();

      // Trigger tailoring
      const res = await fetch(`/api/v1/resumes/tailored/${selectedJobId}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTailoredData(data);
      } else {
        (window as any).showToast('Failed to tailor resume.', 'error');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTailoring(false);
    }
  }

  async function handleUpdateJobDescription(text: string) {
    if (!selectedJob) return;
    const updatedJob = { ...selectedJob, job_description: text };
    setSelectedJob(updatedJob);
    setJobs(jobs.map(j => j.id === selectedJob.id ? updatedJob : j));
    // Save to DB
    await fetch(`/api/v1/jobs/${selectedJob.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedJob)
    });
  }

  async function handleLoadTailored(jobId: number) {
    try {
      setRecommendations('');
      const res = await fetch(`/api/v1/resumes/tailored/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setTailoredData(data);
      } else {
        setTailoredData(null);
      }
    } catch (err) {
      setTailoredData(null);
    }
  }

  async function handleGetProjectRecommendations(missingSkills: string[]) {
    if (missingSkills.length === 0) return;
    try {
      setLoadingRecs(true);
      const prompt = `I am applying for a job but I am missing the following skills: ${missingSkills.join(', ')}. Recommend 3 concrete, beginner-to-advanced project ideas that I can build to learn these skills and add to my profile. For each project, list the skills it covers and a brief implementation plan. Format in clean markdown.`;
      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, page: 'projects' })
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.reply);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRecs(false);
    }
  }

  // List management helpers
  function addExperienceField() {
    setExperience([...experience, { company: '', role: '', duration: '', bullets: '' }]);
  }
  function removeExperienceField(index: number) {
    setExperience(experience.filter((_, i) => i !== index));
  }
  function addEducationField() {
    setEducation([...education, { school: '', degree: '', duration: '' }]);
  }
  function removeEducationField(index: number) {
    setEducation(education.filter((_, i) => i !== index));
  }
  function addProjectField() {
    setProjectsList([...projectsList, { name: '', description: '' }]);
  }
  function removeProjectField(index: number) {
    setProjectsList(projectsList.filter((_, i) => i !== index));
  }

  // Parse keyword lists
  let matchedKeywords: string[] = [];
  let missingKeywords: string[] = [];
  let atsFeedback: string[] = [];
  let tailoredExperience: any[] = [];

  if (tailoredData) {
    try {
      const kw = JSON.parse(tailoredData.ats_keywords || '{}');
      matchedKeywords = kw.matched || [];
      missingKeywords = kw.missing || [];
    } catch { }
    try {
      atsFeedback = JSON.parse(tailoredData.ats_feedback || '[]');
    } catch { }
    try {
      tailoredExperience = JSON.parse(tailoredData.tailored_experience_json || '[]');
    } catch { }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">AI Resume Studio</h1>
      </div>

      {/* Wizard Steps Tracker */}
      <div className="glass-panel wizard-steps" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        marginBottom: '30px',
        borderRadius: '12px',
        background: 'var(--panel-bg)',
        border: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {[
          { num: 1, label: '1. Master Profile', icon: 'edit_document', desc: 'Build your base profile' },
          { num: 2, label: '2. Target Job', icon: 'work', desc: 'Paste the job description' },
          { num: 3, label: '3. AI Matcher', icon: 'auto_awesome', desc: 'Tailor and score resume' },
          { num: 4, label: '4. Print & Export', icon: 'download', desc: 'Download A4 PDF version' }
        ].map((step) => {
          const isActive = activeStep === step.num;
          const isCompleted = activeStep > step.num;
          return (
            <div 
              key={step.num}
              onClick={() => {
                if (step.num < activeStep) {
                  setActiveStep(step.num);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flex: 1,
                minWidth: '200px',
                cursor: step.num < activeStep ? 'pointer' : 'default',
                opacity: isActive ? 1 : isCompleted ? 0.9 : 0.5,
                borderBottom: isActive ? '3px solid var(--accent-color)' : '3px solid transparent',
                paddingBottom: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '16px',
                background: isCompleted ? 'var(--success-color)' : isActive ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)',
                color: isCompleted || isActive ? '#fff' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 500,
                fontSize: '0.9rem'
              }}>
                {isCompleted ? <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span> : step.num}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: isActive ? 500 : 400, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {step.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {step.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeStep === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)', fontSize: '28px' }}>info</span>
            <div>
              <h4 style={{ fontSize: '0.95rem', margin: 0 }}>Step 1: Setup Your Master Profile</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Choose how you want to populate your resume profile details.
              </p>
            </div>
          </div>

          {/* Sub-tabs Selector for Step 1 */}
          <div className="capsule-tabs" style={{ alignSelf: 'flex-start' }}>
            {[
              { id: 'upload', label: 'Upload PDF', icon: 'upload_file' },
              { id: 'paste', label: 'Paste Text', icon: 'content_paste' },
              { id: 'form', label: 'Fill & Edit Profile', icon: 'edit_note' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`capsule-tab-item ${profileMode === tab.id ? 'active' : ''}`}
                style={{ padding: '8px 16px', fontSize: '0.82rem', gap: '6px' }}
                onClick={() => setProfileMode(tab.id as 'upload' | 'paste' | 'form')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Render active sub-tab content */}
          {profileMode === 'upload' && (
            <div className="glass-panel" style={{ padding: '30px', maxWidth: '600px', margin: '0 auto', width: '100%', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>upload_file</span>
                Upload PDF Resume
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Upload your PDF resume. Next, we will run the AI parsing console to structure it.
              </p>

              {!uploadedFile ? (
                <div 
                  style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    padding: '40px 20px',
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.01)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'rgba(255,255,255,0.01)'; }}
                  onClick={() => document.getElementById('resume-file-input')?.click()}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    cloud_upload
                  </span>
                  <h4 style={{ fontSize: '1rem', margin: 0, color: 'var(--text-primary)' }}>
                    {fileLoading ? 'Extracting raw text...' : 'Click to select and upload your PDF'}
                  </h4>
                  <p style={{ fontSize: '0.8rem', margin: '6px 0 0 0', color: 'var(--text-muted)' }}>
                    Only standard PDF files are supported
                  </p>
                  <input 
                    type="file" 
                    id="resume-file-input" 
                    accept=".pdf" 
                    style={{ display: 'none' }} 
                    onChange={handleFileChange}
                    disabled={fileLoading}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--success-bg)', padding: '12px 20px', borderRadius: '8px', border: '1px solid var(--success-color)' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--success-color)' }}>check_circle</span>
                    <span style={{ fontWeight: 500, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{uploadedFile.name} loaded successfully</span>
                  </div>
                  
                  <div style={{ background: 'rgba(0,0,0,0.08)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', width: '100%', textAlign: 'left' }}>
                    <h5 style={{ fontSize: '0.85rem', margin: '0 0 6px 0', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Raw Extracted Preview:</h5>
                    <p style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      "{uploadedFile.text.substring(0, 150)}..."
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '10px', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => setUploadedFile(null)}
                      >
                        Choose different file
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1.5, justifyContent: 'center' }}
                        onClick={() => triggerAIParse(uploadedFile.text)}
                      >
                        <span className="material-symbols-outlined">psychology</span>
                        Parse Resume with AI
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: '100%', justifyContent: 'center', borderColor: 'var(--accent-color)', color: 'var(--text-primary)' }}
                      onClick={() => {
                        setSummary(uploadedFile.text);
                        setProfileMode('form');
                        triggerToast('Raw resume text loaded into profile summary! You can now edit your details manually.', 'info');
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>edit_note</span>
                      Skip AI & Edit Profile Directly
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {profileMode === 'paste' && (
            <div className="glass-panel" style={{ padding: '24px', maxWidth: '700px', margin: '0 auto', width: '100%' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>content_paste</span>
                Paste Old Resume Text
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Paste the text content of your resume here. Our AI parser will extract your experience, projects, skills and education structure.
              </p>
              
              <textarea
                style={{ width: '100%', height: '240px', fontSize: '0.85rem', marginBottom: '16px' }}
                placeholder="Paste old resume text here..."
                value={rawTextImport}
                onChange={e => setRawTextImport(e.target.value)}
              />
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleImportResume}
                disabled={showProgressModal || fileLoading || !rawTextImport.trim()}
              >
                <span className="material-symbols-outlined">psychology</span>
                Parse Resume with AI
              </button>
            </div>
          )}

          {profileMode === 'form' && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Fill & Edit Profile Details</h3>
              <form onSubmit={handleSaveMaster} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label>Full Name</label>
                    <input type="text" style={{ width: '100%' }} value={fullName} onChange={e => setFullName(e.target.value)} />
                  </div>
                  <div>
                    <label>Email</label>
                    <input type="email" style={{ width: '100%' }} value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label>Phone</label>
                    <input type="text" style={{ width: '100%' }} value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label>Professional Summary</label>
                  <textarea style={{ width: '100%', height: '80px' }} value={summary} onChange={e => setSummary(e.target.value)} />
                </div>

                {/* Experience section */}
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h4 style={{ fontSize: '1rem' }}>Work Experience</h4>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={addExperienceField}>
                      + Add Work
                    </button>
                  </div>
                  {experience.map((exp, idx) => (
                    <div key={idx} style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                        <div>
                          <label>Company</label>
                          <input type="text" style={{ width: '100%' }} value={exp.company || ''} onChange={e => {
                            const newExp = [...experience];
                            newExp[idx].company = e.target.value;
                            setExperience(newExp);
                          }} />
                        </div>
                        <div>
                          <label>Role</label>
                          <input type="text" style={{ width: '100%' }} value={exp.role || ''} onChange={e => {
                            const newExp = [...experience];
                            newExp[idx].role = e.target.value;
                            setExperience(newExp);
                          }} />
                        </div>
                        <div>
                          <label>Duration</label>
                          <input type="text" style={{ width: '100%' }} placeholder="e.g. 2022 - Present" value={exp.duration || ''} onChange={e => {
                            const newExp = [...experience];
                            newExp[idx].duration = e.target.value;
                            setExperience(newExp);
                          }} />
                        </div>
                      </div>
                      <div>
                        <label>Achievement Bullets (One per line)</label>
                        <textarea style={{ width: '100%', height: '80px' }} value={exp.bullets || ''} onChange={e => {
                          const newExp = [...experience];
                          newExp[idx].bullets = e.target.value;
                          setExperience(newExp);
                        }} />
                      </div>
                      <button type="button" className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem', marginTop: '10px' }} onClick={() => removeExperienceField(idx)}>
                        Remove Work
                      </button>
                    </div>
                  ))}
                </div>

                {/* Projects section */}
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h4 style={{ fontSize: '1rem' }}>Key Projects</h4>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={addProjectField}>
                      + Add Project
                    </button>
                  </div>
                  {projectsList.map((p, idx) => (
                    <div key={idx} style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ marginBottom: '10px' }}>
                        <label>Project Name</label>
                        <input type="text" style={{ width: '100%' }} value={p.name || ''} onChange={e => {
                          const newProjs = [...projectsList];
                          newProjs[idx].name = e.target.value;
                          setProjectsList(newProjs);
                        }} />
                      </div>
                      <div>
                        <label>Description</label>
                        <textarea style={{ width: '100%', height: '60px' }} value={p.description || ''} onChange={e => {
                          const newProjs = [...projectsList];
                          newProjs[idx].description = e.target.value;
                          setProjectsList(newProjs);
                        }} />
                      </div>
                      <button type="button" className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem', marginTop: '10px' }} onClick={() => removeProjectField(idx)}>
                        Remove Project
                      </button>
                    </div>
                  ))}
                </div>

                {/* Education section */}
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h4 style={{ fontSize: '1rem' }}>Education</h4>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={addEducationField}>
                      + Add Education
                    </button>
                  </div>
                  {education.map((edu, idx) => (
                    <div key={idx} style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div>
                          <label>School</label>
                          <input type="text" style={{ width: '100%' }} value={edu.school || ''} onChange={e => {
                            const newEdu = [...education];
                            newEdu[idx].school = e.target.value;
                            setEducation(newEdu);
                          }} />
                        </div>
                        <div>
                          <label>Degree</label>
                          <input type="text" style={{ width: '100%' }} value={edu.degree || ''} onChange={e => {
                            const newEdu = [...education];
                            newEdu[idx].degree = e.target.value;
                            setEducation(newEdu);
                          }} />
                        </div>
                        <div>
                          <label>Duration</label>
                          <input type="text" style={{ width: '100%' }} value={edu.duration || ''} onChange={e => {
                            const newEdu = [...education];
                            newEdu[idx].duration = e.target.value;
                            setEducation(newEdu);
                          }} />
                        </div>
                      </div>
                      <button type="button" className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem', marginTop: '10px' }} onClick={() => removeEducationField(idx)}>
                        Remove Education
                      </button>
                    </div>
                  ))}
                </div>

                {/* Skills section */}
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                  <label htmlFor="skills_input">Skills (comma separated list)</label>
                  <input
                    type="text"
                    id="skills_input"
                    style={{ width: '100%' }}
                    placeholder="e.g. JavaScript, Python, FastAPI, React"
                    value={skills.join(', ')}
                    onChange={e => {
                      const list = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                      setSkills(list);
                    }}
                  />
                </div>

                <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                  <button type="submit" className="btn btn-primary">
                    <span className="material-symbols-outlined">save</span>
                    Save Master Profile
                  </button>
                </div>
              </form>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px' }}>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={async () => {
                if (profileMode === 'form') {
                  await handleSaveMaster();
                }
                setActiveStep(2);
              }}
            >
              Continue to Target Job
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {activeStep === 2 && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3>Step 2: Select Target Job Application</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Select a job application to target. We'll load the job description so the AI can tailor your resume keywords.
            </p>

            <div>
              <label htmlFor="job_select_wizard">Select Application</label>
              <select
                id="job_select_wizard"
                style={{ width: '100%' }}
                value={selectedJobId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedJobId(val ? Number(val) : '');
                  const found = jobs.find(j => j.id === Number(val)) || null;
                  setSelectedJob(found);
                  if (found) handleLoadTailored(found.id);
                }}
              >
                <option value="">-- Choose Tracked Job Application --</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>{j.role} at {j.company}</option>
                ))}
              </select>
            </div>

            {selectedJob && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label>Company</label>
                    <input type="text" style={{ width: '100%', background: 'rgba(255,255,255,0.02)' }} value={selectedJob.company} readOnly />
                  </div>
                  <div>
                    <label>Role</label>
                    <input type="text" style={{ width: '100%', background: 'rgba(255,255,255,0.02)' }} value={selectedJob.role} readOnly />
                  </div>
                </div>
                <div>
                  <label>Job Description (Edit to refine keywords)</label>
                  <textarea
                    style={{ width: '100%', height: '260px', fontSize: '0.85rem' }}
                    value={selectedJob.job_description || ''}
                    onChange={e => handleUpdateJobDescription(e.target.value)}
                    placeholder="Paste Job Description here..."
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveStep(1)}>
                <span className="material-symbols-outlined">arrow_back</span>
                Back to Master Profile
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                disabled={!selectedJobId}
                onClick={() => setActiveStep(3)}
              >
                Proceed to Optimization
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeStep === 3 && (
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--accent-color)', marginBottom: '16px' }}>auto_awesome</span>
            <h3>Step 3: AI Resume Optimization & ATS Check</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '8px', maxWidth: '600px', margin: '8px auto' }}>
              Optimize your resume for <strong>{selectedJob?.role}</strong> at <strong>{selectedJob?.company}</strong>. We'll audit matching skills and generate missing ones.
            </p>

            <button
              className="btn btn-primary"
              style={{ margin: '20px auto 0 auto', padding: '12px 24px', fontSize: '1rem', display: 'flex', justifyContent: 'center' }}
              onClick={handleTailorResume}
              disabled={tailoring}
            >
              <span className="material-symbols-outlined">bolt</span>
              {tailoring ? 'Tailoring & Matching ATS...' : 'Optimize & Analyze ATS'}
            </button>
          </div>

          {tailoring && (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: '36px', color: 'var(--accent-color)' }}>sync</span>
              </div>
              <p style={{ color: 'var(--text-secondary)' }}>AI is matching your resume, aligning skills, generating custom bullet points, and crafting your cover letter...</p>
            </div>
          )}

          {!tailoring && tailoredData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* ATS Score Panel */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>ATS Score: {tailoredData.ats_score}%</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px' }}>
                    Rubric: 90%+ Excellent, 75%-89% Good, 60%-74% Fair, &lt;60% Needs Work
                  </p>
                </div>
                <div style={{ 
                  width: '80px', 
                  height: '80px', 
                  borderRadius: '40px', 
                  border: '5px solid ' + (tailoredData.ats_score >= 85 ? 'var(--success-color)' : tailoredData.ats_score >= 70 ? 'var(--warning-color)' : 'var(--danger-color)'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  color: tailoredData.ats_score >= 85 ? 'var(--success-color)' : tailoredData.ats_score >= 70 ? 'var(--warning-color)' : 'var(--danger-color)'
                }}>
                  {tailoredData.ats_score}
                </div>
              </div>

              {/* Keywords Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h4 style={{ fontSize: '0.95rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                    Matched Keywords ({matchedKeywords.length})
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {matchedKeywords.map((k, idx) => (
                      <span key={idx} style={{ fontSize: '0.8rem', background: 'var(--success-bg)', color: 'var(--success-color)', padding: '2px 8px', borderRadius: '4px' }}>
                        {k}
                      </span>
                    ))}
                    {matchedKeywords.length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>None detected.</span>}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h4 style={{ fontSize: '0.95rem', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
                    Missing Keywords ({missingKeywords.length})
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                    {missingKeywords.map((k, idx) => (
                      <span key={idx} style={{ fontSize: '0.8rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', padding: '2px 8px', borderRadius: '4px' }}>
                        {k}
                      </span>
                    ))}
                    {missingKeywords.length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No major gaps!</span>}
                  </div>

                  {/* Recommend projects section */}
                  {missingKeywords.length > 0 && (
                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ width: '100%', padding: '6px 12px', fontSize: '0.85rem', justifyContent: 'center' }}
                        onClick={() => handleGetProjectRecommendations(missingKeywords)}
                        disabled={loadingRecs}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>build</span>
                        {loadingRecs ? 'Analyzing missing skills...' : 'Suggest Projects to Learn These Skills'}
                      </button>
                      {recommendations && (
                        <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', overflowY: 'auto', maxHeight: '200px' }}>
                          <div style={{ color: 'var(--accent-hover)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>tips_and_updates</span> Recommended Projects:
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{recommendations}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Improvement Suggestions */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--warning-color)' }}>lightbulb</span>
                  ATS Improvement Feedback
                </h4>
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {atsFeedback.map((f, idx) => (
                    <li key={idx}>{f}</li>
                  ))}
                  {atsFeedback.length === 0 && <li>No feedback suggestions generated yet.</li>}
                </ul>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveStep(2)}>
              <span className="material-symbols-outlined">arrow_back</span>
              Back to Target Job
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              disabled={!tailoredData}
              onClick={() => setActiveStep(4)}
            >
              Proceed to Review & Export
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {activeStep === 4 && tailoredData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem' }}>Step 4: Review & Export Outputs</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                Preview your customized resume layout below (designed in standard A4 white print layout) and save/print your files.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveStep(3)}>
                <span className="material-symbols-outlined">arrow_back</span>
                Back to ATS Matcher
              </button>
              <button type="button" className="btn btn-primary" onClick={() => window.print()}>
                <span className="material-symbols-outlined">print</span>
                Print / Save PDF
              </button>
            </div>
          </div>

          <div className="split-layout">
            {/* White Paper A4 Sheet Preview */}
            <div className="split-main" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', paddingLeft: '4px' }}>Resume Paper Preview</h4>
              <div className="resume-paper-container">
                <div className="resume-paper">
                  <div className="resume-header-section">
                    <div className="resume-header-name">{fullName || 'Your Name'}</div>
                    <div className="resume-header-contact">
                      {email && <span>{email}</span>}
                      {phone && <span>{phone}</span>}
                    </div>
                  </div>

                  {tailoredData.tailored_summary && (
                    <div>
                      <div className="resume-section-title">Professional Summary</div>
                      <p style={{ fontSize: '0.95rem', color: '#1e293b' }}>{tailoredData.tailored_summary}</p>
                    </div>
                  )}

                  {tailoredExperience.length > 0 && (
                    <div>
                      <div className="resume-section-title">Work Experience</div>
                      {tailoredExperience.map((exp, idx) => (
                        <div key={idx} className="resume-item">
                          <div className="resume-item-header">
                            <span>{exp.company}</span>
                            <span style={{ fontWeight: 400, color: '#475569' }}>{exp.duration}</span>
                          </div>
                          <div style={{ fontStyle: 'italic', fontSize: '0.9rem', color: '#475569', marginTop: '2px' }}>
                            {exp.role}
                          </div>
                          <ul className="resume-item-bullets">
                            {exp.bullets?.split('\n').filter(Boolean).map((bullet: string, bidx: number) => (
                              <li key={bidx}>{bullet.replace(/^[-\*\s]+/, '')}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {projectsList.length > 0 && (
                    <div>
                      <div className="resume-section-title">Key Projects</div>
                      {projectsList.map((p, idx) => (
                        <div key={idx} className="resume-item">
                          <div className="resume-item-header">
                            <span style={{ color: '#0f172a' }}>{p.name}</span>
                          </div>
                          <p style={{ fontSize: '0.9rem', color: '#334155', marginTop: '4px' }}>{p.description}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {education.length > 0 && (
                    <div>
                      <div className="resume-section-title">Education</div>
                      {education.map((edu, idx) => (
                        <div key={idx} className="resume-item">
                          <div className="resume-item-header">
                            <span>{edu.school}</span>
                            <span style={{ fontWeight: 400, color: '#475569' }}>{edu.duration}</span>
                          </div>
                          <div style={{ fontSize: '0.9rem', color: '#475569', marginTop: '2px' }}>
                            {edu.degree}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {skills.length > 0 && (
                    <div>
                      <div className="resume-section-title">Skills</div>
                      <p style={{ fontSize: '0.95rem', color: '#334155' }}>
                        {skills.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cover Letter Panel */}
            <div className="split-sidebar" style={{ width: '380px' }}>
              <div className="glass-panel" style={{ padding: '24px', position: 'sticky', top: '20px' }}>
                <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>drafts</span>
                  Tailored Cover Letter
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>
                  Copy or print the custom generated cover letter for your job application below:
                </p>
                <textarea
                  style={{ width: '100%', height: '360px', fontSize: '0.85rem', fontFamily: 'monospace', resize: 'none' }}
                  value={tailoredData.cover_letter || ''}
                  readOnly
                />
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', marginTop: '12px', justifyContent: 'center' }}
                  onClick={() => {
                    navigator.clipboard.writeText(tailoredData.cover_letter || '');
                    triggerToast('Cover letter copied to clipboard!', 'success');
                  }}
                >
                  <span className="material-symbols-outlined">content_copy</span>
                  Copy Cover Letter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProgressModal && (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 10000 }}>
          <div className="glass-panel modal-content" style={{ maxWidth: '650px', width: '90%', padding: '30px', background: '#0b120f', border: '1px solid var(--border-color)', color: '#ffffff' }}>
            <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#ffffff', marginBottom: '8px' }}>
              <span className="material-symbols-outlined animate-spin" style={{ color: 'var(--accent-color)', fontSize: '24px' }}>sync</span>
              AI Parser Console
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#829088', marginBottom: '20px' }}>
              Running structured resume parser pipelines on extraction target...
            </p>

            {/* Stepper Visualization */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', position: 'relative' }}>
              {/* Stepper bar */}
              <div style={{ position: 'absolute', top: '14px', left: '15px', right: '15px', height: '2px', background: 'rgba(255,255,255,0.1)', zIndex: 1 }}>
                <div style={{ height: '100%', width: `${(currentProgressStep / 5) * 100}%`, background: 'var(--accent-color)', transition: 'width 0.4s ease' }} />
              </div>
              
              {[
                { label: 'Layout', icon: 'file_copy' },
                { label: 'Summary', icon: 'person' },
                { label: 'Experience', icon: 'business_center' },
                { label: 'Skills', icon: 'build' },
                { label: 'Finalize', icon: 'check_circle' }
              ].map((step, idx) => {
                const isActive = currentProgressStep >= idx;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 2, position: 'relative' }}>
                    <div style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      background: isActive ? 'var(--accent-color)' : '#070c0a',
                      border: `2px solid ${isActive ? 'var(--accent-color)' : 'rgba(255,255,255,0.2)'}`,
                      color: isActive ? '#0b120f' : '#829088',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      transition: 'all 0.3s ease'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{step.icon}</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: isActive ? '#ffffff' : '#829088', fontWeight: 500 }}>{step.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Simulated Live Terminal output */}
            <div style={{
              background: '#070c0a',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '16px',
              height: '180px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              color: '#38bdf8',
              boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
            }}>
              {progressLogs.length === 0 ? (
                <div style={{ color: '#829088' }}>Initializing logs...</div>
              ) : (
                progressLogs.map((log, idx) => (
                  <div key={idx} style={{
                    color: log.includes('✅') ? '#4ade80' : log.includes('❌') ? '#f87171' : log.includes('⚙️') ? '#a78bfa' : '#38bdf8',
                    borderLeft: `2px solid ${log.includes('✅') ? '#4ade80' : log.includes('❌') ? '#f87171' : log.includes('⚙️') ? '#a78bfa' : '#0284c7'}`,
                    paddingLeft: '8px'
                  }}>
                    {log}
                  </div>
                ))
              )}
            </div>

            {/* Percentage Indicator */}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#829088' }}>
              <span>Pipeline Progress</span>
              <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>{progressPercent}%</span>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : toast.type === 'success' ? '#0b120f' : 'rgba(13, 22, 18, 0.95)',
          border: `1px solid ${toast.type === 'error' ? '#ef4444' : 'var(--accent-color)'}`,
          color: '#ffffff',
          padding: '16px 20px',
          borderRadius: '8px',
          zIndex: 20000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(12px)',
          animation: 'slideIn 0.3s ease-out forwards',
          fontFamily: "'Karla', sans-serif"
        }}>
          <span className="material-symbols-outlined" style={{ color: toast.type === 'error' ? '#ffffff' : 'var(--accent-color)' }}>
            {toast.type === 'error' ? 'error' : toast.type === 'success' ? 'check_circle' : 'info'}
          </span>
          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{toast.message}</span>
          <button 
            type="button"
            onClick={() => setToast(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              marginLeft: '10px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>
      )}
    </div>
  );
}

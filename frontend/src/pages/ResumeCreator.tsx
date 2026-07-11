import React, { useEffect, useState } from 'react';

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

interface RequiredProjectSuggestion {
  name: string;
  description: string;
  tech_stack: string;
  why_required: string;
  starter_tasks: string[];
}

interface ProjectMatchResult {
  matched_projects: { project_id: number; reason: string; relevance: string }[];
  required_projects: RequiredProjectSuggestion[];
}

interface CoachQuestion {
  question: string;
  expected_answer: string;
  ideal_response_tips: string;
}

interface CoachTopic {
  category: string;
  key_focus_areas: string[];
  sample_questions: CoachQuestion[];
}

interface CoachReport {
  strengths: string[];
  weaknesses: string[];
  overall_readiness_expectations: string;
  interview_topics: CoachTopic[];
}

export default function ResumeCreator() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [profileMode, setProfileMode] = useState<'upload' | 'paste' | 'form'>('upload');
  
  // Scraper & JD states
  const [jdMode, setJdMode] = useState<'url' | 'paste' | 'app'>('url');
  const [jdUrl, setJdUrl] = useState('');
  const [scrapingJd, setScrapingJd] = useState(false);
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
  
  // JD-to-project matching state
  const [projectMatch, setProjectMatch] = useState<ProjectMatchResult | null>(null);
  const [loadingProjectMatch, setLoadingProjectMatch] = useState(false);

  // History states
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Templates states
  const [selectedTemplate, setSelectedTemplate] = useState<'modern' | 'tech' | 'executive'>('modern');

  // Layout Styling parameters with ultra-compact defaults
  const [customPadding, setCustomPadding] = useState<string>('0.4in');
  const [customFontSize, setCustomFontSize] = useState<string>('9pt');
  const [customLineHeight, setCustomLineHeight] = useState<string>('1.2');
  const [customSectionSpacing, setCustomSectionSpacing] = useState<string>('6px');
  const [customHeaderStyle, setCustomHeaderStyle] = useState<'underline' | 'bordered' | 'minimal'>('underline');
  const [customPrimaryColor, setCustomPrimaryColor] = useState<string>('#1e3a8a');
  const [customFontFamily, setCustomFontFamily] = useState<'sans-serif' | 'serif' | 'monospace'>('sans-serif');
  const [customCssOverrides, setCustomCssOverrides] = useState<string>('');

  const applyTemplatePreset = (tplId: 'modern' | 'tech' | 'executive') => {
    setSelectedTemplate(tplId);
    if (tplId === 'modern') {
      setCustomPadding('0.4in');
      setCustomFontSize('9pt');
      setCustomLineHeight('1.25');
      setCustomSectionSpacing('6px');
      setCustomHeaderStyle('underline');
      setCustomPrimaryColor('#1e3a8a');
      setCustomFontFamily('sans-serif');
    } else if (tplId === 'tech') {
      setCustomPadding('0.4in');
      setCustomFontSize('8.5pt');
      setCustomLineHeight('1.2');
      setCustomSectionSpacing('5px');
      setCustomHeaderStyle('minimal');
      setCustomPrimaryColor('#0f172a');
      setCustomFontFamily('monospace');
    } else if (tplId === 'executive') {
      setCustomPadding('0.6in');
      setCustomFontSize('10pt');
      setCustomLineHeight('1.3');
      setCustomSectionSpacing('8px');
      setCustomHeaderStyle('bordered');
      setCustomPrimaryColor('#111827');
      setCustomFontFamily('serif');
    }
  };

  // Interview Coach states
  const [coachReport, setCoachReport] = useState<CoachReport | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [expandedCoachTopic, setExpandedCoachTopic] = useState<number | null>(null);
  const [expandedCoachQuestion, setExpandedCoachQuestion] = useState<string | null>(null);

  // Editable analysis state
  const [editableFeedback, setEditableFeedback] = useState<string[]>([]);
  const [editingFeedbackIdx, setEditingFeedbackIdx] = useState<number | null>(null);
  const [editFeedbackText, setEditFeedbackText] = useState('');

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
    fetchHistory();
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

  async function fetchHistory() {
    try {
      const res = await fetch('/api/v1/resumes/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleLoadHistoryItem(histId: number) {
    const confirmed = await (window as any).showConfirm(
      'Load parsed snapshot?',
      'This will replace your current editor fields with the historical snapshot. You can review before saving.',
      'Load Snapshot',
      'Cancel'
    );
    if (!confirmed) return;
    try {
      const hist = historyList.find(h => h.id === histId);
      if (hist) {
        setFullName(hist.full_name || '');
        setEmail(hist.email || '');
        setPhone(hist.phone || '');
        setSummary(hist.summary || '');
        try { setExperience(JSON.parse(hist.experience_json || '[]')); } catch { setExperience([]); }
        try { setEducation(JSON.parse(hist.education_json || '[]')); } catch { setEducation([]); }
        try { setSkills(JSON.parse(hist.skills_json || '[]')); } catch { setSkills([]); }
        try { setProjectsList(JSON.parse(hist.projects_json || '[]')); } catch { setProjectsList([]); }
        setProfileMode('form');
        setShowHistoryModal(false);
        triggerToast('History snapshot loaded in editor!', 'success');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Failed to load history item.', 'error');
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
        triggerToast('Active profile saved successfully!', 'success');
        fetchHistory(); // Refresh history
      }
    } catch (err) {
      console.error(err);
      triggerToast('Failed to save profile.', 'error');
    }
  }

  async function triggerAIParse(rawText: string, filename?: string) {
    if (!rawText.trim()) return;

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

    const startTime = Date.now();
    const logTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      let activeStepIdx = 0;
      steps.forEach((step, idx) => {
        if (elapsed >= step.delay) {
          activeStepIdx = idx + 1;
        }
      });

      setCurrentProgressStep(activeStepIdx);
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
      const endpoint = filename ? '/api/v1/resumes/parse-file' : '/api/v1/resumes/parse-text';
      let payload: any = { raw_text: rawText };
      let fetchOptions: any = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      };

      if (filename && uploadedFile) {
        // If file, call parse-file directly with multipart
        const formData = new FormData();
        const fileInput = document.getElementById('resume-file-input') as HTMLInputElement;
        if (fileInput && fileInput.files && fileInput.files[0]) {
          formData.append('file', fileInput.files[0]);
          fetchOptions = {
            method: 'POST',
            body: formData
          };
        }
      }

      const res = await fetch(endpoint, fetchOptions);

      if (res.ok) {
        const data = await res.json();
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
          setUploadedFile(null);
          setProfileMode('form');
          fetchHistory(); // Refresh history
          triggerToast('Resume parsed and loaded into form editor!', 'success');
        }, 1200);
      } else {
        clearInterval(logTimer);
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.detail || 'Failed to parse resume.';
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
    const filename_lower = file.name.toLowerCase();
    
    if (!filename_lower.endsWith('.pdf') && !filename_lower.endsWith('.docx')) {
      (window as any).showToast('Please upload a PDF or DOCX file only.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setFileLoading(true);
      const res = await fetch('/api/v1/resumes/upload-file', {
        method: 'POST',
        body: formData
      });
      
      if (res.ok) {
        const data = await res.json();
        setUploadedFile({
          name: data.filename,
          text: data.extracted_text
        });
        triggerToast(`${file.name} uploaded successfully! Click Parse to structure it.`, 'success');
      } else {
        const errData = await res.json().catch(() => ({}));
        (window as any).showToast(errData.detail || 'Failed to upload and extract file.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      (window as any).showToast('An error occurred while uploading the file.', 'error');
    } finally {
      setFileLoading(false);
    }
  }

  function handleCreateFromScratch() {
    setFullName('');
    setEmail('');
    setPhone('');
    setSummary('');
    setExperience([]);
    setEducation([]);
    setSkills([]);
    setProjectsList([]);
    setProfileMode('form');
    triggerToast('Editor cleared! Fill details manually.', 'info');
  }

  async function handleScrapeJd() {
    if (!jdUrl.trim()) return;
    try {
      setScrapingJd(true);
      const res = await fetch('/api/v1/resumes/scrape-jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jdUrl })
      });
      if (res.ok) {
        const data = await res.json();
        if (selectedJob) {
          handleUpdateJobDescription(data.text);
          triggerToast('Job Description scraped from URL!', 'success');
        } else {
          // If no selected job, check if we have jobs list
          triggerToast('JD scraped successfully. Select or create an application to save it.', 'info');
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        triggerToast(errData.detail || 'Scraping failed.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || 'Scraping failed.', 'error');
    } finally {
      setScrapingJd(false);
    }
  }

  async function handleTailorResume() {
    if (!selectedJobId) return;
    try {
      setTailoring(true);
      setProjectMatch(null);
      setCoachReport(null);
      await handleSaveMaster();

      const res = await fetch(`/api/v1/resumes/tailored/${selectedJobId}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTailoredData(data);
        
        try {
          const feedback = JSON.parse(data.ats_feedback || '[]');
          setEditableFeedback(feedback);
        } catch {
          setEditableFeedback([]);
        }
        
        triggerToast('ATS Optimization complete!', 'success');
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
    
    await fetch(`/api/v1/jobs/${selectedJob.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedJob)
    });
  }

  async function handleLoadTailored(jobId: number) {
    try {
      setProjectMatch(null);
      setCoachReport(null);
      const res = await fetch(`/api/v1/resumes/tailored/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setTailoredData(data);
        try {
          setEditableFeedback(JSON.parse(data.ats_feedback || '[]'));
        } catch {
          setEditableFeedback([]);
        }
      } else {
        setTailoredData(null);
        setEditableFeedback([]);
      }
    } catch (err) {
      setTailoredData(null);
      setEditableFeedback([]);
    }
  }

  async function handleMatchProjectsToJob() {
    if (!selectedJobId) return;
    try {
      setLoadingProjectMatch(true);
      const res = await fetch(`/api/v1/resumes/project-match/${selectedJobId}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setProjectMatch({
          matched_projects: data.matched_projects || [],
          required_projects: data.required_projects || []
        });
      } else {
        (window as any).showToast('Failed to match projects with this JD.', 'error');
      }
    } catch (err) {
      console.error(err);
      (window as any).showToast('Failed to match projects with this JD.', 'error');
    } finally {
      setLoadingProjectMatch(false);
    }
  }

  async function handleAddRequiredProject(project: RequiredProjectSuggestion) {
    const confirmed = await (window as any).showConfirm(
      'Create required project',
      `"${project.name}" will be added to Required / Learnable Projects with ${project.starter_tasks?.length || 0} starter tasks.`,
      'Confirm',
      'Cancel'
    );
    if (!confirmed) return;
    try {
      const projectRes = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: project.name,
          description: project.description,
          tech_stack: project.tech_stack,
          github_url: '',
          github_summary: '',
          features_json: '[]',
          is_own_project: false,
          recreate_steps: project.why_required,
          project_kind: 'REQUIRED'
        })
      });
      if (!projectRes.ok) throw new Error('Project creation failed');
      const created = await projectRes.json();

      const starterTasks = (project.starter_tasks || []).filter(Boolean);
      if (starterTasks.length > 0) {
        await fetch('/api/v1/tasks/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tasks: starterTasks.map(title => ({
              project_id: created.id,
              title,
              description: '',
              status: 'TODO',
              priority: 'MEDIUM'
            }))
          })
        });
      }
      (window as any).showToast('Required project added to Projects!', 'success');
    } catch (err) {
      console.error(err);
      (window as any).showToast('Could not add required project.', 'error');
    }
  }

  async function handleLoadCoachReport() {
    if (!selectedJobId) return;
    try {
      setLoadingCoach(true);
      const res = await fetch(`/api/v1/resumes/interview-coach/${selectedJobId}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCoachReport(data);
        triggerToast('AI Coach Report Loaded!', 'success');
      } else {
        triggerToast('Failed to load Interview Coach Report.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Failed to load Interview Coach Report.', 'error');
    } finally {
      setLoadingCoach(false);
    }
  }

  async function handleDownloadDocx() {
    try {
      const response = await fetch('/api/v1/resumes/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          summary: tailoredData?.tailored_summary || summary,
          experience: tailoredExperience.length > 0 ? tailoredExperience : experience,
          education,
          skills,
          projects: projectsList,
          style_config: {
            padding: customPadding,
            fontSize: customFontSize,
            lineHeight: customLineHeight,
            sectionSpacing: customSectionSpacing,
            headerStyle: customHeaderStyle,
            primaryColor: customPrimaryColor,
            fontFamily: customFontFamily
          }
        })
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fullName.replace(/\s+/g, '_')}_Resume.doc`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        triggerToast('DOCX Resume download started!', 'success');
      } else {
        triggerToast('Failed to export DOCX resume.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Failed to export DOCX resume.', 'error');
    }
  }

  function handleSaveEditableFeedback() {
    if (editingFeedbackIdx === null) return;
    const newList = [...editableFeedback];
    newList[editingFeedbackIdx] = editFeedbackText;
    setEditableFeedback(newList);
    setEditingFeedbackIdx(null);
    setEditFeedbackText('');
    
    // Save back to tailored resume
    if (tailoredData) {
      fetch(`/api/v1/resumes/tailored/${selectedJobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...tailoredData,
          ats_feedback: JSON.stringify(newList)
        })
      });
    }
    triggerToast('Report feedback updated!', 'success');
  }

  function handleDeleteFeedback(idx: number) {
    const newList = editableFeedback.filter((_, i) => i !== idx);
    setEditableFeedback(newList);
    
    if (tailoredData) {
      fetch(`/api/v1/resumes/tailored/${selectedJobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...tailoredData,
          ats_feedback: JSON.stringify(newList)
        })
      });
    }
    triggerToast('Report feedback deleted!', 'info');
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
  let tailoredExperience: any[] = [];

  if (tailoredData) {
    try {
      const kw = JSON.parse(tailoredData.ats_keywords || '{}');
      matchedKeywords = kw.matched || [];
      missingKeywords = kw.missing || [];
    } catch { }
    try {
      tailoredExperience = JSON.parse(tailoredData.tailored_experience_json || '[]');
    } catch { }
  }

  return (
    <div style={{ paddingBottom: '50px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 className="page-title">AI Resume Studio</h1>
        <button 
          className="btn btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => setShowHistoryModal(true)}
        >
          <span className="material-symbols-outlined">history</span>
          Import History
        </button>
      </div>

      {/* Steps Tracker */}
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
          { num: 1, label: '1. Import & Editor', icon: 'edit_document', desc: 'Ingest resume details' },
          { num: 2, label: '2. Target Job (JD)', icon: 'work', desc: 'Feed target expectations' },
          { num: 3, label: '3. Analysis Report', icon: 'analytics', desc: 'ATS audit & suggestions' },
          { num: 4, label: '4. Resume Templates', icon: 'table_chart', desc: 'Layout preview & download' },
          { num: 5, label: '5. Interview Coach', icon: 'psychology', desc: 'Questions & weaknesses' }
        ].map((step) => {
          const isActive = activeStep === step.num;
          const isCompleted = activeStep > step.num;
          return (
            <div 
              key={step.num}
              onClick={() => {
                if (step.num < activeStep || (step.num === 2 && fullName) || (step.num === 3 && selectedJobId) || (step.num === 4 && tailoredData) || (step.num === 5 && tailoredData)) {
                  setActiveStep(step.num);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flex: 1,
                minWidth: '180px',
                cursor: 'pointer',
                opacity: isActive ? 1 : isCompleted ? 0.9 : 0.4,
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
                <div style={{ fontSize: '0.85rem', fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {step.label}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {step.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* STEP 1: IMPORT & EDITOR */}
      {activeStep === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)', fontSize: '28px' }}>info</span>
            <div>
              <h4 style={{ fontSize: '0.95rem', margin: 0 }}>Step 1: Import or Refine Your Base Profile</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Upload an existing resume document (PDF/DOCX), paste raw text content, or populate fields manually.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px', alignItems: 'start' }}>
            {/* Left Panel: Import options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Select Import Mode</h3>
                <div className="capsule-tabs" style={{ display: 'flex', flexDirection: 'column', width: '100%', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', padding: '4px' }}>
                  {[
                    { id: 'upload', label: 'Upload PDF / DOCX', icon: 'upload_file' },
                    { id: 'paste', label: 'Paste Old Text', icon: 'content_paste' },
                    { id: 'form', label: 'Active Form Fields', icon: 'edit_note' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`capsule-tab-item ${profileMode === tab.id ? 'active' : ''}`}
                      style={{ padding: '10px 14px', fontSize: '0.8rem', gap: '8px', justifyContent: 'flex-start', border: 'none', background: profileMode === tab.id ? 'var(--accent-color)' : 'transparent', color: profileMode === tab.id ? '#fff' : 'var(--text-secondary)', textAlign: 'left', borderRadius: '6px' }}
                      onClick={() => setProfileMode(tab.id as 'upload' | 'paste' | 'form')}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>
                
                <div style={{ marginTop: '10px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ width: '100%', justifyContent: 'center', borderColor: 'var(--accent-color)', color: 'var(--text-primary)' }}
                    onClick={handleCreateFromScratch}
                  >
                    <span className="material-symbols-outlined">add</span>
                    Create From Scratch
                  </button>
                </div>
              </div>

              {/* Upload panel */}
              {profileMode === 'upload' && (
                <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)', fontSize: '18px' }}>upload_file</span>
                    File Ingestion
                  </h4>
                  {!uploadedFile ? (
                    <div 
                      style={{
                        border: '2px dashed var(--border-color)',
                        borderRadius: '10px',
                        padding: '30px 10px',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.01)',
                      }}
                      onClick={() => document.getElementById('resume-file-input')?.click()}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        cloud_upload
                      </span>
                      <h5 style={{ fontSize: '0.85rem', margin: 0, color: 'var(--text-primary)' }}>
                        {fileLoading ? 'Reading document...' : 'Click to select resume'}
                      </h5>
                      <small style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Supports PDF and DOCX
                      </small>
                      <input 
                        type="file" 
                        id="resume-file-input" 
                        accept=".pdf,.docx" 
                        style={{ display: 'none' }} 
                        onChange={handleFileChange}
                        disabled={fileLoading}
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'stretch' }}>
                      <div style={{ background: 'var(--success-bg)', padding: '10px', borderRadius: '6px', border: '1px solid var(--success-color)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--success-color)', fontSize: '18px' }}>check_circle</span>
                        <span>{uploadedFile.name} loaded</span>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.1)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '0.65rem' }}>Text Preview:</small>
                        <p style={{ fontSize: '0.75rem', fontStyle: 'italic', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          "{uploadedFile.text.substring(0, 80)}..."
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                        <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => triggerAIParse(uploadedFile.text, uploadedFile.name)}>
                          <span className="material-symbols-outlined">psychology</span>
                          Parse Resume details
                        </button>
                        <button className="btn btn-secondary" style={{ justifyContent: 'center' }} onClick={() => setUploadedFile(null)}>
                          Upload different file
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Paste panel */}
              {profileMode === 'paste' && (
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)', fontSize: '18px' }}>content_paste</span>
                    Paste Clipboard
                  </h4>
                  <textarea
                    style={{ width: '100%', height: '180px', fontSize: '0.8rem', padding: '8px', marginBottom: '12px', resize: 'vertical' }}
                    placeholder="Paste resume text details here..."
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
                    Parse Text details
                  </button>
                </div>
              )}
            </div>

            {/* Right Panel: Extracted Preview Editor Form */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>edit_note</span>
                  Profile Form Editor (Extracted Preview)
                </h3>
                <button type="button" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleSaveMaster()}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                  Save Profile
                </button>
              </div>

              <form onSubmit={handleSaveMaster} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</label>
                    <input type="text" style={{ width: '100%', fontSize: '0.85rem' }} value={fullName} onChange={e => setFullName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</label>
                    <input type="email" style={{ width: '100%', fontSize: '0.85rem' }} value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Phone</label>
                    <input type="text" style={{ width: '100%', fontSize: '0.85rem' }} value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Professional Summary</label>
                  <textarea style={{ width: '100%', height: '80px', fontSize: '0.85rem' }} value={summary} onChange={e => setSummary(e.target.value)} />
                </div>

                {/* Experience section */}
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Work Experience</h4>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={addExperienceField}>
                      + Add Work
                    </button>
                  </div>
                  {experience.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      No experience records. Click Add Work to create one.
                    </div>
                  ) : (
                    experience.map((exp, idx) => (
                      <div key={idx} style={{ marginBottom: '12px', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                          <div>
                            <label style={{ fontSize: '0.75rem' }}>Company</label>
                            <input type="text" style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }} value={exp.company || ''} onChange={e => {
                              const newExp = [...experience];
                              newExp[idx].company = e.target.value;
                              setExperience(newExp);
                            }} />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem' }}>Role</label>
                            <input type="text" style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }} value={exp.role || ''} onChange={e => {
                              const newExp = [...experience];
                              newExp[idx].role = e.target.value;
                              setExperience(newExp);
                            }} />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem' }}>Duration</label>
                            <input type="text" style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }} placeholder="e.g. 2022 - Present" value={exp.duration || ''} onChange={e => {
                              const newExp = [...experience];
                              newExp[idx].duration = e.target.value;
                              setExperience(newExp);
                            }} />
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem' }}>Achievement Bullets (One per line)</label>
                          <textarea style={{ width: '100%', height: '70px', fontSize: '0.8rem', padding: '6px' }} value={exp.bullets || ''} onChange={e => {
                            const newExp = [...experience];
                            newExp[idx].bullets = e.target.value;
                            setExperience(newExp);
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                          <button type="button" className="btn btn-danger" style={{ padding: '3px 8px', fontSize: '0.7rem', height: '26px' }} onClick={() => removeExperienceField(idx)}>
                            Remove Work
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Projects section */}
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Key Projects</h4>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={addProjectField}>
                      + Add Project
                    </button>
                  </div>
                  {projectsList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      No projects added. Click Add Project to create one.
                    </div>
                  ) : (
                    projectsList.map((p, idx) => (
                      <div key={idx} style={{ marginBottom: '12px', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ marginBottom: '8px' }}>
                          <label style={{ fontSize: '0.75rem' }}>Project Name</label>
                          <input type="text" style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }} value={p.name || ''} onChange={e => {
                            const newProjs = [...projectsList];
                            newProjs[idx].name = e.target.value;
                            setProjectsList(newProjs);
                          }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem' }}>Description</label>
                          <textarea style={{ width: '100%', height: '60px', fontSize: '0.8rem', padding: '6px' }} value={p.description || ''} onChange={e => {
                            const newProjs = [...projectsList];
                            newProjs[idx].description = e.target.value;
                            setProjectsList(newProjs);
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                          <button type="button" className="btn btn-danger" style={{ padding: '3px 8px', fontSize: '0.7rem', height: '26px' }} onClick={() => removeProjectField(idx)}>
                            Remove Project
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Education section */}
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Education</h4>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={addEducationField}>
                      + Add Education
                    </button>
                  </div>
                  {education.map((edu, idx) => (
                    <div key={idx} style={{ marginBottom: '12px', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem' }}>School</label>
                          <input type="text" style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }} value={edu.school || ''} onChange={e => {
                            const newEdu = [...education];
                            newEdu[idx].school = e.target.value;
                            setEducation(newEdu);
                          }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem' }}>Degree</label>
                          <input type="text" style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }} value={edu.degree || ''} onChange={e => {
                            const newEdu = [...education];
                            newEdu[idx].degree = e.target.value;
                            setEducation(newEdu);
                          }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem' }}>Duration</label>
                          <input type="text" style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }} value={edu.duration || ''} onChange={e => {
                            const newEdu = [...education];
                            newEdu[idx].duration = e.target.value;
                            setEducation(newEdu);
                          }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button type="button" className="btn btn-danger" style={{ padding: '3px 8px', fontSize: '0.7rem', height: '26px' }} onClick={() => removeEducationField(idx)}>
                          Remove Education
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Skills section */}
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <label htmlFor="skills_input" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Skills (comma separated list)</label>
                  <input
                    type="text"
                    id="skills_input"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                    placeholder="e.g. JavaScript, Python, FastAPI, React"
                    value={skills.join(', ')}
                    onChange={e => {
                      const list = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                      setSkills(list);
                    }}
                  />
                </div>
              </form>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button 
              type="button" 
              className="btn btn-primary" 
              disabled={!fullName}
              onClick={async () => {
                await handleSaveMaster();
                setActiveStep(2);
              }}
            >
              Continue to Target Job
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: TARGET JOB EXPECTATIONS (JD) */}
      {activeStep === 2 && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Step 2: Select or Ingest Target Job Expectations</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              Specify the job you are targeting. This loads the job description keywords so the AI can analyze gaps.
            </p>

            <div className="capsule-tabs" style={{ alignSelf: 'flex-start' }}>
              {[
                { id: 'url', label: 'Import via Link', icon: 'link' },
                { id: 'paste', label: 'Paste JD Text', icon: 'content_paste' },
                { id: 'app', label: 'Select Tracked Application', icon: 'work' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  className={`capsule-tab-item ${jdMode === tab.id ? 'active' : ''}`}
                  style={{ padding: '8px 14px', fontSize: '0.8rem', gap: '6px' }}
                  onClick={() => setJdMode(tab.id as 'url' | 'paste' | 'app')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {jdMode === 'url' && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="url" 
                  style={{ flexGrow: 1 }} 
                  placeholder="Paste Job Post URL (e.g. LinkedIn, Indeed)..." 
                  value={jdUrl} 
                  onChange={e => setJdUrl(e.target.value)} 
                />
                <button className="btn btn-primary" type="button" onClick={handleScrapeJd} disabled={scrapingJd || !jdUrl.trim()}>
                  <span className="material-symbols-outlined">download</span>
                  {scrapingJd ? 'Scraping...' : 'Fetch JD'}
                </button>
              </div>
            )}

            {jdMode === 'app' && (
              <div>
                <label htmlFor="job_select_wizard" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Select Application Track</label>
                <select
                  id="job_select_wizard"
                  style={{ width: '100%', fontSize: '0.85rem' }}
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
            )}

            {selectedJob && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Company Name</label>
                    <input type="text" style={{ width: '100%', fontSize: '0.82rem', background: 'rgba(255,255,255,0.02)' }} value={selectedJob.company} onChange={e => {
                      const updated = { ...selectedJob, company: e.target.value };
                      setSelectedJob(updated);
                      setJobs(jobs.map(j => j.id === selectedJob.id ? updated : j));
                    }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Role / Title</label>
                    <input type="text" style={{ width: '100%', fontSize: '0.82rem', background: 'rgba(255,255,255,0.02)' }} value={selectedJob.role} onChange={e => {
                      const updated = { ...selectedJob, role: e.target.value };
                      setSelectedJob(updated);
                      setJobs(jobs.map(j => j.id === selectedJob.id ? updated : j));
                    }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Job Description (Edit to refine keywords)</label>
                  <textarea
                    style={{ width: '100%', height: '220px', fontSize: '0.82rem', resize: 'vertical' }}
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
                Back to Profile
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                disabled={!selectedJobId}
                onClick={() => setActiveStep(3)}
              >
                Proceed to Analysis
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: ATS ANALYSIS & SUGGESTIONS */}
      {activeStep === 3 && (
        <div style={{ maxWidth: '950px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--accent-color)', marginBottom: '12px' }}>analytics</span>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Step 3: ATS Score Analysis & Gaps Report</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', maxWidth: '600px', margin: '6px auto 0 auto' }}>
              Understand what keywords Sonu is missing, get skill-aligned project suggestions, and refine improvements.
            </p>

            <button
              className="btn btn-primary"
              style={{ margin: '16px auto 0 auto', padding: '10px 20px', fontSize: '0.9rem', display: 'flex', justifyContent: 'center' }}
              onClick={handleTailorResume}
              disabled={tailoring}
            >
              <span className="material-symbols-outlined">bolt</span>
              {tailoring ? 'Generating Audit Report...' : 'Run ATS Audit & Optimization'}
            </button>
          </div>

          {tailoring && (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: '32px', color: 'var(--accent-color)', marginBottom: '12px' }}>sync</span>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Analyzing skills registry bindings, mapping keywords, and checking score indicators...</p>
            </div>
          )}

          {!tailoring && tailoredData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Radial Score card */}
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>ATS Suitability Check</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
                    Based on resume keywords compared to <strong>{selectedJob?.role}</strong> JD.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '74px',
                    height: '74px',
                    borderRadius: '50%',
                    border: '5px solid ' + (tailoredData.ats_score >= 85 ? 'var(--success-color)' : tailoredData.ats_score >= 70 ? 'var(--warning-color)' : 'var(--danger-color)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.3rem',
                    color: tailoredData.ats_score >= 85 ? 'var(--success-color)' : tailoredData.ats_score >= 70 ? 'var(--warning-color)' : 'var(--danger-color)'
                  }}>
                    {tailoredData.ats_score}%
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: tailoredData.ats_score >= 85 ? 'var(--success-color)' : tailoredData.ats_score >= 70 ? 'var(--warning-color)' : 'var(--danger-color)' }}>
                    {tailoredData.ats_score >= 85 ? 'Excellent Match' : tailoredData.ats_score >= 70 ? 'Good Potential' : 'Needs Gaps Fixed'}
                  </span>
                </div>
              </div>

              {/* Keywords audit */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="glass-panel" style={{ padding: '16px' }}>
                  <h4 style={{ fontSize: '0.88rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px 0' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                    Matched Keywords ({matchedKeywords.length})
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {matchedKeywords.map((k, idx) => (
                      <span key={idx} style={{ fontSize: '0.74rem', background: 'var(--success-bg)', color: 'var(--success-color)', padding: '3px 8px', borderRadius: '4px', fontWeight: 500 }}>
                        {k}
                      </span>
                    ))}
                    {matchedKeywords.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No matches.</span>}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '16px' }}>
                  <h4 style={{ fontSize: '0.88rem', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px 0' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
                    Missing Gaps ({missingKeywords.length})
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {missingKeywords.map((k, idx) => (
                      <span key={idx} style={{ fontSize: '0.74rem', background: 'var(--danger-bg)', color: 'var(--danger-color)', padding: '3px 8px', borderRadius: '4px', fontWeight: 500 }}>
                        {k}
                      </span>
                    ))}
                    {missingKeywords.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Zero gaps detected!</span>}
                  </div>

                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '6px 12px', fontSize: '0.78rem', justifyContent: 'center' }}
                    onClick={handleMatchProjectsToJob}
                    disabled={loadingProjectMatch}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>school</span>
                    {loadingProjectMatch ? 'Synthesizing Projects...' : 'Blend Projects with Registered Skills'}
                  </button>
                </div>
              </div>

              {/* Project Suggestions lists */}
              {projectMatch && (
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>handyman</span>
                    Targeted Projects Suggestions (Aligned with Gaps)
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {projectMatch.required_projects.length > 0 ? (
                      projectMatch.required_projects.map((project, idx) => (
                        <div key={idx} style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{project.name}</strong>
                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: 'var(--warning-bg)', color: 'var(--warning-color)', fontWeight: 600 }}>Skill Gap Filler</span>
                          </div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{project.description}</p>
                          <small style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}><strong>Learning Value:</strong> {project.why_required}</small>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '4px 0' }}>
                            {(project.tech_stack || '').split(',').map((t, ti) => (
                              <span key={ti} className="tech-chip" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>{t.trim()}</span>
                            ))}
                          </div>
                          <button 
                            className="btn btn-primary" 
                            style={{ alignSelf: 'flex-start', padding: '4px 12px', fontSize: '0.75rem', height: '30px', marginTop: '6px' }}
                            onClick={() => handleAddRequiredProject(project)}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add_task</span>
                            Add to Required Projects (Kanban Board)
                          </button>
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>No new projects needed. Existing skills cover JDs.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Editable ATS feedback report */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--warning-color)' }}>lightbulb</span>
                  Analysis Report Feedback (Fully Editable)
                </h4>
                
                {editingFeedbackIdx !== null ? (
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                    <input 
                      type="text" 
                      style={{ flexGrow: 1, fontSize: '0.82rem' }} 
                      value={editFeedbackText} 
                      onChange={e => setEditFeedbackText(e.target.value)} 
                    />
                    <button className="btn btn-primary" onClick={handleSaveEditableFeedback}>Save</button>
                    <button className="btn btn-secondary" onClick={() => setEditingFeedbackIdx(null)}>Cancel</button>
                  </div>
                ) : null}

                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                  {editableFeedback.map((f, idx) => (
                    <li key={idx} style={{ position: 'relative', paddingRight: '60px' }}>
                      <span>{f}</span>
                      <div style={{ position: 'absolute', right: 0, top: '-2px', display: 'flex', gap: '6px' }}>
                        <button 
                          type="button" 
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                          onClick={() => {
                            setEditingFeedbackIdx(idx);
                            setEditFeedbackText(f);
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                        </button>
                        <button 
                          type="button" 
                          style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: 0 }}
                          onClick={() => handleDeleteFeedback(idx)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                        </button>
                      </div>
                    </li>
                  ))}
                  {editableFeedback.length === 0 && <li>No active recommendations. Click run audit.</li>}
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
              Proceed to Templates
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: RESUME TEMPLATES */}
      {activeStep === 4 && tailoredData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Step 4: Select ATS-Friendly Printable Resume Template</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '2px 0 0 0' }}>
                Preview A4 paper boundaries. Exports standard PDF vector sheets or structured Word documents.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleDownloadDocx}>
                <span className="material-symbols-outlined">description</span>
                Download DOCX
              </button>
              <button type="button" className="btn btn-primary" onClick={() => window.print()}>
                <span className="material-symbols-outlined">print</span>
                Print / Save PDF
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
            {/* Left: Template Selector & Style Customizer */}
            <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '80vh', overflowY: 'auto' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 4px 0' }}>Available Templates</h4>
              {[
                { id: 'modern', name: 'Modern Minimalist', desc: 'Sleek sans-serif, single column clean structure.' },
                { id: 'tech', name: 'Technical Developer', desc: 'Side columns, layout tailored for tech engineers.' },
                { id: 'executive', name: 'Executive Class', desc: 'Classic serif elegance, balanced professional margins.' }
              ].map(tpl => (
                <div 
                  key={tpl.id}
                  onClick={() => applyTemplatePreset(tpl.id as 'modern' | 'tech' | 'executive')}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid ' + (selectedTemplate === tpl.id ? 'var(--accent-color)' : 'var(--border-color)'),
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: selectedTemplate === tpl.id ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <strong style={{ fontSize: '0.82rem', color: selectedTemplate === tpl.id ? 'var(--accent-color)' : 'var(--text-primary)', display: 'block' }}>
                    {tpl.name}
                  </strong>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '2px 0 0 0', lineHeight: 1.35 }}>{tpl.desc}</p>
                </div>
              ))}
              
              {/* Layout Customizer Controls */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent-color)' }}>tune</span>
                  Layout Customizer
                </h4>

                {/* Padding / Margins */}
                <div>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Page Margins (Padding)</label>
                  <select 
                    style={{ width: '100%', fontSize: '0.78rem', padding: '4px' }}
                    value={customPadding}
                    onChange={e => setCustomPadding(e.target.value)}
                  >
                    <option value="0.3in">Ultra Compact (0.3in)</option>
                    <option value="0.4in">Compact (0.4in)</option>
                    <option value="0.5in">Tight (0.5in)</option>
                    <option value="0.6in">Medium (0.6in)</option>
                    <option value="0.75in">Standard (0.75in)</option>
                    <option value="1.0in">Wide (1.0in)</option>
                  </select>
                </div>

                {/* Font Size */}
                <div>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Font Size</label>
                  <select 
                    style={{ width: '100%', fontSize: '0.78rem', padding: '4px' }}
                    value={customFontSize}
                    onChange={e => setCustomFontSize(e.target.value)}
                  >
                    <option value="8pt">Tiny (8pt)</option>
                    <option value="8.5pt">Very Compact (8.5pt)</option>
                    <option value="9pt">Compact (9pt)</option>
                    <option value="9.5pt">Professional (9.5pt)</option>
                    <option value="10pt">Standard (10pt)</option>
                    <option value="11pt">Large (11pt)</option>
                  </select>
                </div>

                {/* Line Height */}
                <div>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Line Spacing</label>
                  <select 
                    style={{ width: '100%', fontSize: '0.78rem', padding: '4px' }}
                    value={customLineHeight}
                    onChange={e => setCustomLineHeight(e.target.value)}
                  >
                    <option value="1.1">Extra Tight (1.1)</option>
                    <option value="1.2">Compact (1.2)</option>
                    <option value="1.25">Tight (1.25)</option>
                    <option value="1.35">Normal (1.35)</option>
                    <option value="1.5">Loose (1.5)</option>
                  </select>
                </div>

                {/* Section Gap */}
                <div>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Section Spacing</label>
                  <select 
                    style={{ width: '100%', fontSize: '0.78rem', padding: '4px' }}
                    value={customSectionSpacing}
                    onChange={e => setCustomSectionSpacing(e.target.value)}
                  >
                    <option value="4px">Extra Dense (4px)</option>
                    <option value="6px">Dense (6px)</option>
                    <option value="8px">Compact (8px)</option>
                    <option value="12px">Comfortable (12px)</option>
                    <option value="18px">Spacious (18px)</option>
                  </select>
                </div>

                {/* Heading style */}
                <div>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Heading style</label>
                  <select 
                    style={{ width: '100%', fontSize: '0.78rem', padding: '4px' }}
                    value={customHeaderStyle}
                    onChange={e => setCustomHeaderStyle(e.target.value as 'underline' | 'bordered' | 'minimal')}
                  >
                    <option value="underline">Bottom Underline</option>
                    <option value="bordered">Top & Bottom Borders</option>
                    <option value="minimal">Minimal (No Borders)</option>
                  </select>
                </div>

                {/* Colors */}
                <div>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Primary Heading Color</label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input 
                      type="color" 
                      style={{ border: 'none', background: 'transparent', width: '30px', height: '30px', padding: 0, cursor: 'pointer' }}
                      value={customPrimaryColor}
                      onChange={e => setCustomPrimaryColor(e.target.value)}
                    />
                    <input 
                      type="text" 
                      style={{ flexGrow: 1, fontSize: '0.76rem', padding: '4px 6px', height: '30px' }}
                      value={customPrimaryColor}
                      onChange={e => setCustomPrimaryColor(e.target.value)}
                    />
                  </div>
                </div>

                {/* Typography selection */}
                <div>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Typography</label>
                  <select 
                    style={{ width: '100%', fontSize: '0.78rem', padding: '4px' }}
                    value={customFontFamily}
                    onChange={e => setCustomFontFamily(e.target.value as 'sans-serif' | 'serif' | 'monospace')}
                  >
                    <option value="sans-serif">Modern Sans-Serif (Manrope)</option>
                    <option value="serif">Corporate Serif (Georgia)</option>
                    <option value="monospace">Developer Mono (Courier)</option>
                  </select>
                </div>

                {/* Custom CSS block */}
                <div>
                  <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Custom CSS Overrides</label>
                  <textarea 
                    style={{ width: '100%', height: '80px', fontSize: '0.7rem', fontFamily: 'monospace', resize: 'vertical' }}
                    placeholder="e.g. .resume-header-name { letter-spacing: 2px; }"
                    value={customCssOverrides}
                    onChange={e => setCustomCssOverrides(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '8px' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent-color)' }}>drafts</span>
                  Tailored Cover Letter
                </h4>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>Crafted specially for this job role application:</p>
                <textarea 
                  style={{ width: '100%', height: '160px', fontSize: '0.74rem', fontFamily: 'monospace', resize: 'vertical' }} 
                  value={tailoredData.cover_letter || ''} 
                  readOnly 
                />
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', height: '32px', fontSize: '0.74rem', marginTop: '8px', justifyContent: 'center' }}
                  onClick={() => {
                    navigator.clipboard.writeText(tailoredData.cover_letter || '');
                    triggerToast('Cover Letter copied!', 'success');
                  }}
                >
                  Copy Cover Letter
                </button>
              </div>
            </div>

            {/* Right: Live A4 sheet preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="resume-paper-container" style={{ width: '100%', background: '#070c0a', padding: '24px 0', display: 'flex', justifyContent: 'center', borderRadius: '12px', border: '1px solid var(--border-color)', overflowX: 'auto' }}>
                
                {/* Dynamic CSS Overrides Tag */}
                <style dangerouslySetInnerHTML={{ __html: customCssOverrides }} />

                {/* Print Sheet Canvas */}
                <div className={`resume-paper template-${selectedTemplate}`} style={{
                  width: '8.27in', // A4 Width
                  minHeight: '11.69in', // A4 Height
                  background: '#ffffff',
                  color: '#222222',
                  padding: customPadding,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  boxSizing: 'border-box',
                  fontFamily: customFontFamily === 'serif' ? '"Georgia", "Times New Roman", serif' : customFontFamily === 'monospace' ? '"Courier New", Courier, monospace' : '"Manrope", "Inter", "Arial", sans-serif',
                  lineHeight: customLineHeight,
                  textAlign: 'left',
                  fontSize: customFontSize
                }}>
                  {/* Header segment */}
                  <div style={{ borderBottom: `2px solid ${customPrimaryColor}`, paddingBottom: '6px', marginBottom: customSectionSpacing, textAlign: selectedTemplate === 'modern' ? 'left' : 'center' }}>
                    <div className="resume-header-name" style={{ fontSize: '18pt', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {fullName || 'Your Name'}
                    </div>
                    <div className="resume-header-contact" style={{ fontSize: '8.5pt', color: '#64748b', marginTop: '3px', display: 'flex', gap: '12px', justifyContent: selectedTemplate === 'modern' ? 'flex-start' : 'center' }}>
                      <span>{email}</span>
                      <span>•</span>
                      <span>{phone}</span>
                    </div>
                  </div>

                  {/* Split body or traditional */}
                  <div style={{ display: selectedTemplate === 'tech' ? 'grid' : 'block', gridTemplateColumns: '1.8in 1fr', gap: '0.3in' }}>
                    
                    {/* Left side for tech template */}
                    {selectedTemplate === 'tech' && (
                      <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '0.15in' }}>
                        <div style={{ fontSize: '10pt', fontWeight: 700, color: customPrimaryColor, textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>
                          Skills
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '8pt', color: '#334155', marginBottom: '14px' }}>
                          {skills.map((s, idx) => (
                            <span key={idx} style={{ padding: '2px 0', borderBottom: '1px dashed #f1f5f9' }}>{s}</span>
                          ))}
                        </div>
                        
                        <div style={{ fontSize: '10pt', fontWeight: 700, color: customPrimaryColor, textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>
                          Education
                        </div>
                        {education.map((edu, idx) => (
                          <div key={idx} style={{ fontSize: '8pt', marginBottom: '8px', color: '#334155' }}>
                            <strong style={{ display: 'block', color: '#0f172a' }}>{edu.degree}</strong>
                            <span>{edu.school}</span>
                            <span style={{ display: 'block', fontStyle: 'italic', color: '#64748b', marginTop: '1px' }}>{edu.duration}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Main side */}
                    <div>
                      {/* Summary */}
                      <div style={{ marginBottom: customSectionSpacing }}>
                        <div style={{ 
                          fontSize: '10.5pt', 
                          fontWeight: 700, 
                          color: customPrimaryColor, 
                          textTransform: 'uppercase', 
                          borderBottom: customHeaderStyle === 'underline' ? '1px solid #e2e8f0' : 'none', 
                          borderTop: customHeaderStyle === 'bordered' ? '1px solid #e2e8f0' : 'none',
                          borderBottomColor: '#c0c0c0',
                          borderTopColor: '#c0c0c0',
                          paddingBottom: '2px', 
                          marginBottom: '4px', 
                          letterSpacing: '0.5px' 
                        }}>
                          Profile Summary
                        </div>
                        <p style={{ fontSize: customFontSize, color: '#334155', margin: 0, textAlign: 'justify' }}>{tailoredData.tailored_summary}</p>
                      </div>

                      {/* Skills if not tech template */}
                      {selectedTemplate !== 'tech' && skills.length > 0 && (
                        <div style={{ marginBottom: customSectionSpacing }}>
                          <div style={{ 
                            fontSize: '10.5pt', 
                            fontWeight: 700, 
                            color: customPrimaryColor, 
                            textTransform: 'uppercase', 
                            borderBottom: customHeaderStyle === 'underline' ? '1px solid #e2e8f0' : 'none', 
                            borderTop: customHeaderStyle === 'bordered' ? '1px solid #e2e8f0' : 'none',
                            borderBottomColor: '#c0c0c0',
                            borderTopColor: '#c0c0c0',
                            paddingBottom: '2px', 
                            marginBottom: '4px', 
                            letterSpacing: '0.5px' 
                          }}>
                            Technical Skills
                          </div>
                          <p style={{ fontSize: customFontSize, color: '#334155', margin: 0 }}>{skills.join(', ')}</p>
                        </div>
                      )}

                      {/* Work Experience */}
                      {tailoredExperience.length > 0 && (
                        <div style={{ marginBottom: customSectionSpacing }}>
                          <div style={{ 
                            fontSize: '10.5pt', 
                            fontWeight: 700, 
                            color: customPrimaryColor, 
                            textTransform: 'uppercase', 
                            borderBottom: customHeaderStyle === 'underline' ? '1px solid #e2e8f0' : 'none', 
                            borderTop: customHeaderStyle === 'bordered' ? '1px solid #e2e8f0' : 'none',
                            borderBottomColor: '#c0c0c0',
                            borderTopColor: '#c0c0c0',
                            paddingBottom: '2px', 
                            marginBottom: '6px', 
                            letterSpacing: '0.5px' 
                          }}>
                            Professional Experience
                          </div>
                          {tailoredExperience.map((exp, idx) => (
                            <div key={idx} style={{ marginBottom: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', fontWeight: 700, color: '#0f172a' }}>
                                <span>{exp.role} <span style={{ fontWeight: 400, color: '#475569' }}>at {exp.company}</span></span>
                                <span style={{ fontWeight: 400, fontStyle: 'italic', color: '#64748b' }}>{exp.duration}</span>
                              </div>
                              <ul style={{ margin: '2px 0 0 0', paddingLeft: '14px', fontSize: '8.5pt', color: '#334155' }}>
                                {exp.bullets?.split('\n').filter(Boolean).map((bullet: string, bidx: number) => (
                                  <li key={bidx} style={{ marginBottom: '2px', textAlign: 'justify' }}>{bullet.replace(/^[-\*\s•]+/, '')}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Projects */}
                      {projectsList.length > 0 && (
                        <div style={{ marginBottom: customSectionSpacing }}>
                          <div style={{ 
                            fontSize: '10.5pt', 
                            fontWeight: 700, 
                            color: customPrimaryColor, 
                            textTransform: 'uppercase', 
                            borderBottom: customHeaderStyle === 'underline' ? '1px solid #e2e8f0' : 'none', 
                            borderTop: customHeaderStyle === 'bordered' ? '1px solid #e2e8f0' : 'none',
                            borderBottomColor: '#c0c0c0',
                            borderTopColor: '#c0c0c0',
                            paddingBottom: '2px', 
                            marginBottom: '6px', 
                            letterSpacing: '0.5px' 
                          }}>
                            Key Projects
                          </div>
                          {projectsList.map((p, idx) => (
                            <div key={idx} style={{ marginBottom: '4px', fontSize: '9pt' }}>
                              <strong style={{ color: '#0f172a', display: 'block' }}>{p.name}</strong>
                              <p style={{ margin: '2px 0 0 0', color: '#334155', fontSize: '8.5pt', textAlign: 'justify' }}>{p.description}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Education if not tech template */}
                      {selectedTemplate !== 'tech' && education.length > 0 && (
                        <div>
                          <div style={{ 
                            fontSize: '10.5pt', 
                            fontWeight: 700, 
                            color: customPrimaryColor, 
                            textTransform: 'uppercase', 
                            borderBottom: customHeaderStyle === 'underline' ? '1px solid #e2e8f0' : 'none', 
                            borderTop: customHeaderStyle === 'bordered' ? '1px solid #e2e8f0' : 'none',
                            borderBottomColor: '#c0c0c0',
                            borderTopColor: '#c0c0c0',
                            paddingBottom: '2px', 
                            marginBottom: '6px', 
                            letterSpacing: '0.5px' 
                          }}>
                            Education
                          </div>
                          {education.map((edu, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', color: '#334155', marginBottom: '2px' }}>
                              <span><strong>{edu.degree}</strong> – {edu.school}</span>
                              <span style={{ fontStyle: 'italic', color: '#64748b' }}>{edu.duration}</span>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveStep(3)}>
              <span className="material-symbols-outlined">arrow_back</span>
              Back to Analysis
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setActiveStep(5)}>
              Proceed to Interview Coach
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: INTERVIEW COACH */}
      {activeStep === 5 && (
        <div style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--accent-color)', marginBottom: '12px' }}>psychology</span>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Step 5: 10-Year Recruiter Mock Interview & Readiness Coach</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', maxWidth: '600px', margin: '6px auto 0 auto' }}>
              Simulates review criteria from a veteran hiring panel. Outlines strengths, weaknesses, and questions (Aptitude, Coding, SQL, System Design).
            </p>
            <button 
              className="btn btn-primary" 
              style={{ margin: '16px auto 0 auto', display: 'flex', justifyContent: 'center' }} 
              onClick={handleLoadCoachReport} 
              disabled={loadingCoach}
            >
              <span className="material-symbols-outlined">explore</span>
              {loadingCoach ? 'Assembling Recruiter Panel...' : 'Generate Mock Readiness Interview'}
            </button>
          </div>

          {loadingCoach && (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: '32px', color: 'var(--accent-color)', marginBottom: '12px' }}>sync</span>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Veteran engineering leads are evaluating your gaps, analyzing your code profiles, and preparing SQL/Coding tests...</p>
            </div>
          )}

          {!loadingCoach && coachReport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Strengths & Weaknesses */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="glass-panel" style={{ padding: '16px' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px 0', fontWeight: 700 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>thumb_up</span>
                    Hiring Strengths
                  </h4>
                  <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {coachReport.strengths.map((str, idx) => (
                      <li key={idx}>{str}</li>
                    ))}
                  </ul>
                </div>

                <div className="glass-panel" style={{ padding: '16px' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--warning-color)', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px 0', fontWeight: 700 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>thumb_down</span>
                    Vulnerabilities & Weaknesses
                  </h4>
                  <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {coachReport.weaknesses.map((weak, idx) => (
                      <li key={idx}>{weak}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Overall expectations */}
              <div className="glass-panel" style={{ padding: '16px 20px', borderLeft: '4px solid var(--accent-color)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>10-Year Lead Recruiter Expectations</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {coachReport.overall_readiness_expectations}
                </p>
              </div>

              {/* Mock questions accordions */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 14px 0' }}>Core Interview Domains Prep</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {coachReport.interview_topics.map((topic, topicIdx) => (
                    <div 
                      key={topicIdx} 
                      style={{ 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '8px', 
                        overflow: 'hidden', 
                        background: expandedCoachTopic === topicIdx ? 'rgba(255,255,255,0.01)' : 'transparent' 
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedCoachTopic(expandedCoachTopic === topicIdx ? null : topicIdx)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.86rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)', fontSize: '18px' }}>
                            {topic.category.toLowerCase().includes('sql') ? 'database' : topic.category.toLowerCase().includes('code') ? 'code' : 'quiz'}
                          </span>
                          {topic.category}
                        </span>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', transition: 'transform 0.2s', transform: expandedCoachTopic === topicIdx ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                          expand_more
                        </span>
                      </button>

                      {expandedCoachTopic === topicIdx && (
                        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', alignSelf: 'center' }}>Focus Areas:</span>
                            {topic.key_focus_areas.map((f, fi) => (
                              <span key={fi} className="tech-chip" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>{f}</span>
                            ))}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {topic.sample_questions.map((q, qi) => {
                              const qKey = `${topicIdx}-${qi}`;
                              const isQExpanded = expandedCoachQuestion === qKey;
                              return (
                                <div key={qi} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', background: 'rgba(0,0,0,0.1)' }}>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedCoachQuestion(isQExpanded ? null : qKey)}
                                    style={{
                                      width: '100%',
                                      padding: '10px 12px',
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      fontSize: '0.8rem',
                                      fontWeight: 500,
                                      color: 'var(--text-secondary)',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}
                                  >
                                    <span>Q: {q.question}</span>
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                      {isQExpanded ? 'remove' : 'add'}
                                    </span>
                                  </button>
                                  {isQExpanded && (
                                    <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', background: 'rgba(255,255,255,0.01)', padding: '8px', borderRadius: '4px' }}>
                                        <strong>Expected Answer:</strong>
                                        <p style={{ margin: '4px 0 0 0', lineHeight: 1.4 }}>{q.expected_answer}</p>
                                      </div>
                                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                        <strong>Response Tips:</strong> {q.ideal_response_tips}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveStep(4)}>
              <span className="material-symbols-outlined">arrow_back</span>
              Back to Templates
            </button>
          </div>
        </div>
      )}

      {/* History Modal Sidebar */}
      {showHistoryModal && (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 10000 }}>
          <div className="glass-panel modal-content" style={{ maxWidth: '600px', width: '90%', padding: '24px', position: 'relative' }}>
            <button 
              type="button" 
              className="close-btn" 
              style={{ position: 'absolute', right: '16px', top: '16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
              onClick={() => setShowHistoryModal(false)}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>history</span>
              Ingestion Parse History
            </h3>
            
            <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {historyList.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '20px' }}>No previous extractions found.</p>
              ) : (
                historyList.map((hist) => {
                  const dateStr = new Date(hist.created_at).toLocaleString();
                  return (
                    <div 
                      key={hist.id} 
                      style={{ 
                        padding: '12px', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '8px', 
                        background: 'rgba(255,255,255,0.01)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                        <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>{hist.full_name || 'Anonymous Ingestion'}</strong>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{hist.filename || 'Text Clipboard Parse'}</span>
                        <small style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{dateStr}</small>
                      </div>
                      <button 
                        className="btn btn-secondary" 
                        style={{ height: '30px', padding: '0 10px', fontSize: '0.74rem' }}
                        onClick={() => handleLoadHistoryItem(hist.id)}
                      >
                        Load
                      </button>
                    </div>
                  );
                })
              )}
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

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', position: 'relative' }}>
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

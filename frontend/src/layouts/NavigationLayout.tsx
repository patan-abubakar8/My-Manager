import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  action?: any; // Intent action data
  actionStatus?: 'pending' | 'approved' | 'cancelled';
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
}

interface CopilotSkill {
  id: string;
  label: string;
  description: string;
  allowed_actions: string[];
}

interface NavigationLayoutProps {
  children: React.ReactNode;
  activeIdea: any;
  setActiveIdea: (idea: any) => void;
}

export default function NavigationLayout({ children, activeIdea, setActiveIdea }: NavigationLayoutProps) {
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const [chatMode, setChatMode] = useState<'text' | 'image' | 'video'>('text');
  const [selectedSkill, setSelectedSkill] = useState('auto');
  const [availableSkills, setAvailableSkills] = useState<CopilotSkill[]>([]);
  const [activeTextModel, setActiveTextModel] = useState('meta/llama-3.1-8b-instruct');
  const [activeImageModel, setActiveImageModel] = useState('nvidia/vila');
  const [activeVideoModel, setActiveVideoModel] = useState('adept/fuyu-8b');

  const [availableTextModels, setAvailableTextModels] = useState<string[]>([]);
  const [availableImageModels, setAvailableImageModels] = useState<string[]>([]);
  const [availableVideoModels, setAvailableVideoModels] = useState<string[]>([]);
  const [settingsFlyoutOpen, setSettingsFlyoutOpen] = useState(false);
  const flyoutRef = useRef<HTMLDivElement>(null);

  const fetchActiveModels = async () => {
    try {
      const res = await fetch('/api/v1/settings/model');
      if (res.ok) {
        const data = await res.json();
        setActiveTextModel(data.text_model || 'meta/llama-3.1-8b-instruct');
        setActiveImageModel(data.image_model || 'nvidia/vila');
        setActiveVideoModel(data.video_model || 'adept/fuyu-8b');
      }
    } catch (err) {
      console.error('Error fetching active models for chat drawer:', err);
    }
  };

  const fetchAvailableModels = async () => {
    try {
      const res = await fetch('/api/v1/settings/nim-models');
      if (res.ok) {
        const nimData = await res.json();
        setAvailableTextModels(nimData.text_models || []);
        setAvailableImageModels(nimData.image_models || []);
        setAvailableVideoModels(nimData.video_models || []);
      } else {
        setAvailableTextModels(['meta/llama-3.1-8b-instruct', 'meta/llama-3.1-70b-instruct']);
        setAvailableImageModels(['nvidia/vila']);
        setAvailableVideoModels(['adept/fuyu-8b']);
      }
    } catch (err) {
      console.error('Error fetching available models list:', err);
    }
  };

  const handleSaveModel = async (type: 'text' | 'image' | 'video', newModel: string) => {
    if (type === 'text') setActiveTextModel(newModel);
    if (type === 'image') setActiveImageModel(newModel);
    if (type === 'video') setActiveVideoModel(newModel);

    try {
      const payload: any = {};
      if (type === 'text') payload.text_model = newModel;
      if (type === 'image') payload.image_model = newModel;
      if (type === 'video') payload.video_model = newModel;

      const res = await fetch('/api/v1/settings/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        window.dispatchEvent(new Event('settings-updated'));
      }
    } catch (err) {
      console.error('Error saving active model:', err);
    }
  };

  useEffect(() => {
    fetchActiveModels();
    fetchAvailableModels();
    window.addEventListener('settings-updated', fetchActiveModels);
    return () => {
      window.removeEventListener('settings-updated', fetchActiveModels);
    };
  }, []);

  // Click outside to close settings flyout
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        const toggleBtn = document.querySelector('.copilot-settings-toggle-btn');
        if (toggleBtn && toggleBtn.contains(e.target as Node)) {
          return;
        }
        setSettingsFlyoutOpen(false);
      }
    };
    if (settingsFlyoutOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [settingsFlyoutOpen]);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const location = useLocation();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Force viewport scroll position to stay locked to the left on route changes
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
    }
  }, [location.pathname]);

  // Determine current page for context
  const getPageContext = () => {
    const path = location.pathname;
    if (path === '/') return 'dashboard';
    if (path.startsWith('/projects/')) return 'project_detail';
    return path.substring(1);
  };

  useEffect(() => {
    const page = getPageContext();
    fetch(`/api/v1/ai/skills?page=${encodeURIComponent(page)}&mode=${chatMode}`)
      .then(res => res.ok ? res.json() : [])
      .then((skills: CopilotSkill[]) => {
        setAvailableSkills(skills);
        if (selectedSkill !== 'auto' && !skills.some(skill => skill.id === selectedSkill)) setSelectedSkill('auto');
      })
      .catch(() => setAvailableSkills([]));
  }, [location.pathname, chatMode]);

  // Open Copilot and inject welcome message when activeIdea is set
  useEffect(() => {
    if (activeIdea) {
      setCopilotOpen(true);
      const hasWelcome = chatHistory.some(m => m.content.includes(activeIdea.title));
      if (!hasWelcome) {
        setChatHistory(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `I've loaded your idea: **"${activeIdea.title}"** into focus.\nLet's deep-dive! I'm representing multiple perspectives simultaneously to challenge and refine this idea. Ask me anything!`
          }
        ]);
      }
    }
  }, [activeIdea]);

  useEffect(() => {
    if (copilotOpen) {
      scrollToBottom();
    }
  }, [chatHistory, streamingContent, copilotOpen]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || isStreaming) return;

    const userText = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: userText }]);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const response = await fetch('/api/v1/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          page: getPageContext(),
          ideaContext: activeIdea ? `${activeIdea.title}: ${activeIdea.description}` : '',
          mode: chatMode,
          skill: selectedSkill
        })
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let actionObject: any = null;
      let finalAssistantText = '';
      let mediaType: 'image' | 'video' | undefined = undefined;
      let mediaUrl = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleaned = line.trim();
          if (cleaned.startsWith('data: ')) {
            const jsonStr = cleaned.substring(6).trim();
            if (jsonStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === 'token') {
                finalAssistantText += parsed.content;
                setStreamingContent(finalAssistantText);
              } else if (parsed.type === 'image') {
                mediaType = 'image';
                mediaUrl = parsed.url;
              } else if (parsed.type === 'video') {
                mediaType = 'video';
                mediaUrl = parsed.url;
              } else if (parsed.type === 'action') {
                actionObject = parsed.payload;
              } else if (parsed.type === 'error') {
                finalAssistantText += `\n[Error: ${parsed.content}]`;
                setStreamingContent(finalAssistantText);
              }
            } catch (err) {
              // Ignore line parse errors
            }
          }
        }
      }

      // Add finished assistant message to history
      setChatHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: finalAssistantText,
          action: actionObject,
          actionStatus: actionObject ? 'pending' : undefined,
          mediaType,
          mediaUrl
        }
      ]);
      setStreamingContent('');
    } catch (err: any) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'assistant', content: `Sorry, there was a connection error: ${err.message}` }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleApproveAction = async (msgIndex: number, action: any) => {
    const confirmation = getActionConfirmation(action);
    const confirmed = await (window as any).showConfirm(
      confirmation.title,
      confirmation.content,
      'Confirm',
      'Cancel'
    );
    if (!confirmed) return;
    try {
      let endpoint = '';
      let payload = action.payload;

      switch (action.type) {
        case 'CREATE_PROJECT':
          endpoint = '/api/v1/projects';
          break;
        case 'CREATE_REQUIRED_PROJECT':
          endpoint = '/api/v1/projects';
          payload = { ...payload, project_kind: 'REQUIRED', is_own_project: false };
          break;
        case 'CREATE_JOB':
          endpoint = '/api/v1/jobs';
          break;
        case 'CREATE_IDEA':
          endpoint = '/api/v1/ideas';
          break;
        case 'ADD_TASK':
          endpoint = '/api/v1/tasks';
          break;
        case 'ADD_TASKS':
          endpoint = '/api/v1/tasks/batch';
          break;
        default:
          (window as any).showToast(`Unknown action type: ${action.type}`, 'error');
          return;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setChatHistory(prev => {
          const copy = [...prev];
          copy[msgIndex].actionStatus = 'approved';
          return copy;
        });
        (window as any).showToast(`Success! Created record for ${action.type.replace('CREATE_', '').replace('ADD_', '')}`, 'success');
        // Reload project lists or other elements if on that page
        window.location.reload();
      } else {
        (window as any).showToast('Action approval failed.', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelAction = (msgIndex: number) => {
    setChatHistory(prev => {
      const copy = [...prev];
      copy[msgIndex].actionStatus = 'cancelled';
      return copy;
    });
  };

  return (
    <div className="app-viewport" ref={viewportRef}>
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-title">
            <span className="material-symbols-outlined logo-icon">cloud_sync</span>
          </div>
        </div>

        <ul className="sidebar-menu">
          <li className={`menu-item ${location.pathname === '/' ? 'active' : ''}`} title="Dashboard">
            <Link to="/">
              <span className="material-symbols-outlined">dashboard</span>
            </Link>
          </li>
          <li className={`menu-item ${location.pathname === '/projects' ? 'active' : ''}`} title="Projects">
            <Link to="/projects">
              <span className="material-symbols-outlined">folder</span>
            </Link>
          </li>
          <li className={`menu-item ${location.pathname === '/applications' ? 'active' : ''}`} title="Applications">
            <Link to="/applications">
              <span className="material-symbols-outlined">work</span>
            </Link>
          </li>
          <li className={`menu-item ${location.pathname === '/resumes' ? 'active' : ''}`} title="Resume Studio">
            <Link to="/resumes">
              <span className="material-symbols-outlined">description</span>
            </Link>
          </li>
          <li className={`menu-item ${location.pathname === '/ideas' ? 'active' : ''}`} title="Ideas Board">
            <Link to="/ideas">
              <span className="material-symbols-outlined">lightbulb</span>
            </Link>
          </li>
          <li className={`menu-item ${location.pathname === '/social' ? 'active' : ''}`} title="Social Hub">
            <Link to="/social">
              <span className="material-symbols-outlined">hub</span>
            </Link>
          </li>
        </ul>

        <div className="sidebar-bottom">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            <span className="material-symbols-outlined">
              {theme === 'dark' ? 'dark_mode' : 'light_mode'}
            </span>
          </button>
          
          <Link to="/settings" style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: location.pathname === '/settings' ? 'var(--sidebar-active-color)' : 'var(--text-secondary)',
            background: location.pathname === '/settings' ? 'var(--sidebar-active-bg)' : 'transparent',
            textDecoration: 'none'
          }} title="Settings">
            <span className="material-symbols-outlined">settings</span>
          </Link>
        </div>
      </aside>

      {/* Main Page Area */}
      <main className="main-content">
        {children}
      </main>

      {/* Floating Toggle button */}
      <button className="copilot-toggle" onClick={() => setCopilotOpen(!copilotOpen)}>
        <span className="material-symbols-outlined">chat_bubble</span>
      </button>

      {/* Sliding Copilot Chat Sidebar */}
      <div className={`copilot-panel ${copilotOpen ? 'open' : ''}`}>
        <div className="copilot-header">
          <div className="copilot-title-container">
            <div className="copilot-title-main">
              <span className="material-symbols-outlined">psychology</span>
              <span>AI Copilot</span>
            </div>
            <div className="copilot-status">
              <span className="copilot-status-dot"></span>
              <span>Online • Assistant ready</span>
            </div>
          </div>
          <button className="close-copilot" onClick={() => setCopilotOpen(false)} title="Close Sidebar">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Deep Dive focused banner */}
        {activeIdea && (
          <div style={{ background: 'var(--accent-dim)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--accent-color)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-hover)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '300px' }}>
              Deep-Diving: {activeIdea.title}
            </span>
            <button className="collapse-btn" onClick={() => setActiveIdea(null)}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>
          </div>
        )}

        {/* Chat History Messages */}
        <div className="copilot-messages" ref={chatContainerRef}>
          {chatHistory.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--info-color)' }}>psychology</span>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>How can I help you, Sonu?</h3>
              <p style={{ fontSize: '0.84rem', lineHeight: '1.5', color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '300px' }}>
                Ask me to help brainstorm ideas, track jobs, structure projects, or generate resume bullets.
              </p>
              
              <div className="copilot-suggestions">
                {[
                  { text: 'Brainstorm project ideas', icon: 'lightbulb' },
                  { text: 'Draft resume bullet points', icon: 'description' },
                  { text: 'Analyze job description skills', icon: 'work' },
                  { text: 'Structure project tasks', icon: 'assignment' }
                ].map((sug, idx) => (
                  <button 
                    key={idx}
                    type="button" 
                    className="suggestion-card"
                    onClick={() => setChatMessage(sug.text)}
                  >
                    <span className="material-symbols-outlined">{sug.icon}</span>
                    <span className="suggestion-card-text">{sug.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {chatHistory.map((msg, idx) => (
            <div key={idx} className={`chat-message-row ${msg.role}`}>
              <div className={`message-avatar ${msg.role}`}>
                <span className="material-symbols-outlined">
                  {msg.role === 'user' ? 'person' : 'smart_toy'}
                </span>
              </div>
              <div className="message-bubble-wrapper">
                <span className="message-sender-name">
                  {msg.role === 'user' ? 'Sonu' : 'Copilot'}
                </span>
                <div className="message-bubble">
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

                  {/* Render Media Bubbles */}
                  {msg.mediaType === 'image' && msg.mediaUrl && (
                    <div style={{ marginTop: '12px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
                      <img 
                        src={msg.mediaUrl} 
                        alt="Generated AI art" 
                        style={{ width: '100%', height: 'auto', display: 'block' }} 
                      />
                      <div style={{ padding: '8px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'rgba(0,0,0,0.2)' }}>
                        <a 
                          href={msg.mediaUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                          Open Full
                        </a>
                      </div>
                    </div>
                  )}

                  {msg.mediaType === 'video' && msg.mediaUrl && (
                    <div style={{ marginTop: '12px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
                      <video 
                        src={msg.mediaUrl} 
                        controls 
                        autoPlay 
                        loop 
                        muted 
                        style={{ width: '100%', display: 'block' }} 
                      />
                      <div style={{ padding: '8px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'rgba(0,0,0,0.2)' }}>
                        <a 
                          href={msg.mediaUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>download</span>
                          Download
                        </a>
                      </div>
                    </div>
                  )}
                  
                  {/* Render Confirmation Cards if action present */}
                  {msg.action && msg.actionStatus === 'pending' && (
                    <div className="intent-card">
                      <div className="intent-card-title">
                        <span className="material-symbols-outlined">auto_fix_high</span>
                        <span>{getActionLabel(msg.action)}</span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                        {getActionSummary(msg.action)}
                      </div>
                      <div className="intent-card-actions">
                        <button className="intent-btn approve" onClick={() => handleApproveAction(idx, msg.action)}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span> Approve
                        </button>
                        <button className="intent-btn cancel" onClick={() => handleCancelAction(idx)}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span> Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {msg.action && msg.actionStatus === 'approved' && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontWeight: '600' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span> Approved & Created
                    </div>
                  )}

                  {msg.action && msg.actionStatus === 'cancelled' && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontWeight: '600' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>cancel</span> Cancelled
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Streaming response tokens */}
          {isStreaming && streamingContent && (
            <div className="chat-message-row assistant">
              <div className="message-avatar assistant">
                <span className="material-symbols-outlined">smart_toy</span>
              </div>
              <div className="message-bubble-wrapper">
                <span className="message-sender-name">Copilot</span>
                <div className="message-bubble">
                  <div style={{ whiteSpace: 'pre-wrap' }}>{streamingContent}</div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Input Bar with Settings Flyout */}
        <form onSubmit={handleSendMessage} className="copilot-input-area">
          {settingsFlyoutOpen && (
            <div className="copilot-settings-flyout" ref={flyoutRef}>
              <div className="flyout-header">
                <span className="flyout-title">Copilot Configuration</span>
                <button type="button" className="close-flyout-btn" onClick={() => setSettingsFlyoutOpen(false)}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                </button>
              </div>
              
              <div className="flyout-body">
                {/* Mode Select */}
                <div className="flyout-section">
                  <label className="flyout-label">Response Mode</label>
                  <div className="capsule-tabs" style={{ width: '100%', display: 'flex' }}>
                    {[
                      { id: 'text', label: 'Text' },
                      { id: 'image', label: 'Image' },
                      { id: 'video', label: 'Video' }
                    ].map(mode => (
                      <button
                        key={mode.id}
                        type="button"
                        className={`capsule-tab-item ${chatMode === mode.id ? 'active' : ''}`}
                        style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '6px 8px' }}
                        onClick={() => setChatMode(mode.id as 'text' | 'image' | 'video')}
                      >
                        <strong>{mode.label}</strong>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 1. Skill Selector */}
                <div className="flyout-section">
                  <label className="flyout-label" htmlFor="copilot-skill">Active Skill</label>
                  <select id="copilot-skill" className="copilot-skill-select" value={selectedSkill} onChange={e => setSelectedSkill(e.target.value)}>
                    <option value="auto">Auto — choose for this task</option>
                    {availableSkills.map(skill => <option key={skill.id} value={skill.id}>{skill.label}</option>)}
                  </select>
                  {selectedSkill !== 'auto' && <p className="copilot-skill-hint">{availableSkills.find(skill => skill.id === selectedSkill)?.description}</p>}
                </div>

                {/* 2. Text Model Selector */}
                <div className="flyout-section">
                  <label className="flyout-label" htmlFor="flyout-text-model">Text Model</label>
                  <select id="flyout-text-model" className="copilot-skill-select" value={activeTextModel} onChange={e => handleSaveModel('text', e.target.value)}>
                    {availableTextModels.length === 0 ? (
                      <option value={activeTextModel}>{activeTextModel.split('/').pop()}</option>
                    ) : (
                      availableTextModels.map(m => <option key={m} value={m}>{m.split('/').pop() || m}</option>)
                    )}
                  </select>
                </div>

                {/* 3. Image Model Selector */}
                <div className="flyout-section">
                  <label className="flyout-label" htmlFor="flyout-image-model">Image Model</label>
                  <select id="flyout-image-model" className="copilot-skill-select" value={activeImageModel} onChange={e => handleSaveModel('image', e.target.value)}>
                    {availableImageModels.length === 0 ? (
                      <option value={activeImageModel}>{activeImageModel.split('/').pop()}</option>
                    ) : (
                      availableImageModels.map(m => <option key={m} value={m}>{m.split('/').pop() || m}</option>)
                    )}
                  </select>
                </div>

                {/* 4. Video Model Selector */}
                <div className="flyout-section">
                  <label className="flyout-label" htmlFor="flyout-video-model">Video Model</label>
                  <select id="flyout-video-model" className="copilot-skill-select" value={activeVideoModel} onChange={e => handleSaveModel('video', e.target.value)}>
                    {availableVideoModels.length === 0 ? (
                      <option value={activeVideoModel}>{activeVideoModel.split('/').pop()}</option>
                    ) : (
                      availableVideoModels.map(m => <option key={m} value={m}>{m.split('/').pop() || m}</option>)
                    )}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="copilot-input-wrapper">
            <button
              type="button"
              className={`copilot-settings-toggle-btn ${settingsFlyoutOpen ? 'active' : ''}`}
              onClick={() => setSettingsFlyoutOpen(!settingsFlyoutOpen)}
              title="Copilot Settings"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>tune</span>
            </button>
            <input
              type="text"
              className="copilot-input"
              placeholder={activeIdea ? "Discussing this idea..." : "Ask Copilot anything..."}
              value={chatMessage}
              onChange={e => setChatMessage(e.target.value)}
            />
            <button type="submit" className="send-message-btn" disabled={isStreaming || !chatMessage.trim()}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getActionConfirmation(action: any) {
  const payload = action.payload || {};
  switch (action.type) {
    case 'CREATE_REQUIRED_PROJECT':
      return { title: 'Agent wants to create a required project', content: `“${payload.name}” will be added to your Required / Learnable Projects section.\n\nSkills covered: ${payload.tech_stack || 'To be defined'}` };
    case 'CREATE_PROJECT':
      return { title: 'Agent wants to create a project', content: `“${payload.name}” will be added to your Projects workspace.\n\n${payload.description || ''}` };
    case 'CREATE_IDEA':
      return { title: 'Agent wants to capture an idea', content: `“${payload.title}” will be saved in ${payload.category || 'Ideas'}.` };
    case 'CREATE_JOB':
      return { title: 'Agent wants to add a job application', content: `${payload.role || 'Role'} at ${payload.company || 'Company'} will be added to your pipeline.` };
    case 'ADD_TASKS':
      return { title: 'Agent wants to add project tasks', content: `${(payload.tasks || []).length} tasks will be added to ${payload.project_name || 'this project'}.` };
    default:
      return { title: 'Agent wants to add a task', content: `“${payload.title || 'New task'}” will be added to the selected project.` };
  }
}

function getActionLabel(action: any) {
  switch (action.type) {
    case 'CREATE_REQUIRED_PROJECT':
      return 'Create required project';
    case 'CREATE_PROJECT':
      return 'Create project';
    case 'CREATE_IDEA':
      return 'Capture idea';
    case 'CREATE_JOB':
      return 'Add job application';
    case 'ADD_TASKS':
      return 'Add project tasks';
    case 'ADD_TASK':
      return 'Add project task';
    default:
      return 'Review agent action';
  }
}

function getActionSummary(action: any) {
  const payload = action.payload || {};
  switch (action.type) {
    case 'CREATE_REQUIRED_PROJECT':
    case 'CREATE_PROJECT':
      return `Name: ${payload.name || 'Untitled'}\nTech Stack: ${payload.tech_stack || 'Not specified'}`;
    case 'CREATE_JOB':
      return `Company: ${payload.company || 'Company'}\nRole: ${payload.role || 'Role'}`;
    case 'CREATE_IDEA':
      return `Title: ${payload.title || 'Untitled idea'}\nCategory: ${payload.category || 'Idea'}`;
    case 'ADD_TASKS':
      return `${(payload.tasks || []).length} tasks for ${payload.project_name || 'the selected project'}`;
    case 'ADD_TASK':
      return `Task: ${payload.title || 'New task'}`;
    default:
      return 'Review the details before confirming.';
  }
}

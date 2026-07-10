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
  const [activeTextModel, setActiveTextModel] = useState('meta/llama-3.1-8b-instruct');
  const [activeImageModel, setActiveImageModel] = useState('nvidia/vila');
  const [activeVideoModel, setActiveVideoModel] = useState('adept/fuyu-8b');

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

  useEffect(() => {
    fetchActiveModels();
    window.addEventListener('settings-updated', fetchActiveModels);
    return () => {
      window.removeEventListener('settings-updated', fetchActiveModels);
    };
  }, []);

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
    return path.substring(1);
  };

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
          mode: chatMode
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
    try {
      let endpoint = '';
      let payload = action.payload;

      switch (action.type) {
        case 'CREATE_PROJECT':
          endpoint = '/api/v1/projects';
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
          <div className="copilot-title">
            <span className="material-symbols-outlined">support_agent</span>
            <span>AI Copilot</span>
          </div>
          <button className="close-copilot" onClick={() => setCopilotOpen(false)}>
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
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--accent-color)', marginBottom: '10px' }}>psychology</span>
              <p style={{ fontSize: '0.9rem' }}>Hello Sonu! I'm your Command Center Copilot. Ask me to help brainstorm ideas, track jobs, structure projects, or generate resume bullets.</p>
            </div>
          )}
          
          {chatHistory.map((msg, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <div className={`message-bubble ${msg.role}`}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

                {/* Render Media Bubbles */}
                {msg.mediaType === 'image' && msg.mediaUrl && (
                  <div style={{ marginTop: '10px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.05)' }}>
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
                  <div style={{ marginTop: '10px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.05)' }}>
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
                      <span>AI Intent Action: {msg.action.type.replace('CREATE_', '').replace('ADD_', '')}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {msg.action.type === 'CREATE_PROJECT' && `Name: ${msg.action.payload.name}\nTech Stack: ${msg.action.payload.tech_stack}`}
                      {msg.action.type === 'CREATE_JOB' && `Company: ${msg.action.payload.company}\nRole: ${msg.action.payload.role}`}
                      {msg.action.type === 'CREATE_IDEA' && `Title: ${msg.action.payload.title}\nCategory: ${msg.action.payload.category}`}
                      {msg.action.type === 'ADD_TASK' && `Task: ${msg.action.payload.title}`}
                    </div>
                    <div className="intent-card-actions">
                      <button className="intent-btn approve" onClick={() => handleApproveAction(idx, msg.action)}>Approve</button>
                      <button className="intent-btn cancel" onClick={() => handleCancelAction(idx)}>Cancel</button>
                    </div>
                  </div>
                )}

                {msg.action && msg.actionStatus === 'approved' && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span> Approved & Created
                  </div>
                )}

                {msg.action && msg.actionStatus === 'cancelled' && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>cancel</span> Cancelled
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming response tokens */}
          {isStreaming && streamingContent && (
            <div className="message-bubble assistant">
              <div style={{ whiteSpace: 'pre-wrap' }}>{streamingContent}</div>
            </div>
          )}

        </div>

        {/* Model Mode Selector (Radio buttons) */}
        <div style={{ display: 'flex', gap: '12px', padding: '8px 16px', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.02)', flexWrap: 'wrap' }}>
          {[
            { id: 'text', label: 'Text', model: activeTextModel },
            { id: 'image', label: 'Image', model: activeImageModel },
            { id: 'video', label: 'Video', model: activeVideoModel }
          ].map(mode => (
            <label key={mode.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="radio"
                name="chat_mode"
                checked={chatMode === mode.id}
                onChange={() => setChatMode(mode.id as 'text' | 'image' | 'video')}
                style={{ accentColor: 'var(--accent-color)' }}
              />
              <span><strong>{mode.label}</strong> ({mode.model.split('/').pop()})</span>
            </label>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="copilot-input-area">
          <input
            type="text"
            className="copilot-input"
            placeholder={activeIdea ? "Discussing this idea..." : "Ask Copilot anything..."}
            value={chatMessage}
            onChange={e => setChatMessage(e.target.value)}
          />
          <button type="submit" className="send-message-btn" disabled={isStreaming || !chatMessage.trim()}>
            <span className="material-symbols-outlined">send</span>
          </button>
        </form>
      </div>
    </div>
  );
}

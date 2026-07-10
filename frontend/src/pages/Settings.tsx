import { useEffect, useState } from 'react';

interface Memory {
  id: number;
  fact: string;
  category: string;
}

export default function Settings() {
  const [activeTextModel, setActiveTextModel] = useState('');
  const [activeImageModel, setActiveImageModel] = useState('');
  const [activeVideoModel, setActiveVideoModel] = useState('');
  
  const [availableTextModels, setAvailableTextModels] = useState<string[]>([]);
  const [availableImageModels, setAvailableImageModels] = useState<string[]>([]);
  const [availableVideoModels, setAvailableVideoModels] = useState<string[]>([]);
  
  // Multiple AI provider states
  const [activeProvider, setActiveProvider] = useState('nvidia');
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({
    nvidia: '', openai: '', gemini: '', xai: '', anthropic: '', ollama: '', zai: '', custom: ''
  });
  const [providerUrls, setProviderUrls] = useState<Record<string, string>>({
    nvidia: '', openai: '', gemini: '', xai: '', anthropic: '', ollama: '', zai: '', custom: ''
  });
  const [editingProvider, setEditingProvider] = useState<string>('nvidia');

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  const providersList = [
    { id: 'nvidia', label: 'NVIDIA NIM', defaultUrl: 'https://integrate.api.nvidia.com/v1', icon: 'fa-solid fa-microchip', color: '#76B900' },
    { id: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com/v1', icon: 'fa-solid fa-circle-nodes', color: '#10a37f' },
    { id: 'gemini', label: 'Google Gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', icon: 'fa-solid fa-wand-magic-sparkles', color: '#1a73e8' },
    { id: 'xai', label: 'Grok / xAI', defaultUrl: 'https://api.x.ai/v1', icon: 'fa-solid fa-brain', color: '#ffffff' },
    { id: 'anthropic', label: 'Anthropic Claude', defaultUrl: 'https://api.anthropic.com/v1', icon: 'fa-solid fa-feather', color: '#cc855c' },
    { id: 'ollama', label: 'Ollama (Local/Cloud)', defaultUrl: 'http://localhost:11434/v1', icon: 'fa-solid fa-cube', color: '#ff8c00' },
    { id: 'zai', label: 'ZAI', defaultUrl: 'https://api.zai.ai/v1', icon: 'fa-solid fa-bolt-lightning', color: '#9b5de5' },
    { id: 'custom', label: 'Custom Endpoint', defaultUrl: '', icon: 'fa-solid fa-gears', color: '#6c757d' }
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      
      // Fetch dynamic models list from provider models catalog
      const nimModelsRes = await fetch('/api/v1/settings/nim-models');
      if (nimModelsRes.ok) {
        const nimData = await nimModelsRes.json();
        setAvailableTextModels(nimData.text_models || []);
        setAvailableImageModels(nimData.image_models || []);
        setAvailableVideoModels(nimData.video_models || []);
      } else {
        const defaults = ['meta/llama-3.1-8b-instruct', 'meta/llama-3.1-70b-instruct'];
        setAvailableTextModels(defaults);
        setAvailableImageModels(['nvidia/vila']);
        setAvailableVideoModels(['adept/fuyu-8b']);
      }

      // Fetch model & provider configurations
      const modelRes = await fetch('/api/v1/settings/model');
      if (modelRes.ok) {
        const modelData = await modelRes.json();
        setActiveTextModel(modelData.text_model || 'meta/llama-3.1-8b-instruct');
        setActiveImageModel(modelData.image_model || 'nvidia/vila');
        setActiveVideoModel(modelData.video_model || 'adept/fuyu-8b');
        setActiveProvider(modelData.ai_provider || 'nvidia');
        setEditingProvider(modelData.ai_provider || 'nvidia');
        
        if (modelData.provider_keys) {
          setProviderKeys(prev => ({ ...prev, ...modelData.provider_keys }));
        }
        if (modelData.provider_urls) {
          setProviderUrls(prev => ({ ...prev, ...modelData.provider_urls }));
        }
      }

      // Fetch memories
      const memRes = await fetch('/api/v1/ai/memories');
      if (memRes.ok) {
        const memData = await memRes.json();
        setMemories(memData);
      }
    } catch (err) {
      console.error(err);
      setAvailableTextModels(['meta/llama-3.1-8b-instruct', 'meta/llama-3.1-70b-instruct']);
      setAvailableImageModels(['nvidia/vila']);
      setAvailableVideoModels(['adept/fuyu-8b']);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveModel(type: 'text' | 'image' | 'video', newModel: string) {
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
      console.error(err);
    }
  }

  async function handleSaveCredentials(providerId: string) {
    setSavingSettings(true);
    const key = providerKeys[providerId] || '';
    const url = providerUrls[providerId] || '';
    
    try {
      const res = await fetch('/api/v1/settings/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai_provider: activeProvider, // Keep current active provider
          provider_keys: { [providerId]: key },
          provider_urls: { [providerId]: url }
        })
      });
      if (res.ok) {
        (window as any).showToast(`${providersList.find(p => p.id === providerId)?.label} credentials saved successfully!`, 'success');
        window.dispatchEvent(new Event('settings-updated'));
        fetchSettings();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSetActiveProvider(providerId: string) {
    setActiveProvider(providerId);
    try {
      const res = await fetch('/api/v1/settings/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai_provider: providerId,
          ai_api_key: providerKeys[providerId] || '',
          ai_base_url: providerUrls[providerId] || ''
        })
      });
      if (res.ok) {
        window.dispatchEvent(new Event('settings-updated'));
        
        // Trigger page re-fetch so that available models load from the new provider catalog!
        const nimModelsRes = await fetch('/api/v1/settings/nim-models');
        if (nimModelsRes.ok) {
          const nimData = await nimModelsRes.json();
          setAvailableTextModels(nimData.text_models || []);
          setAvailableImageModels(nimData.image_models || []);
          setAvailableVideoModels(nimData.video_models || []);
          
          // Pre-select first model from the list if available
          if (nimData.text_models && nimData.text_models.length > 0) {
            handleSaveModel('text', nimData.text_models[0]);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteMemory(id: number) {
    const confirmed = await (window as any).showConfirm(
      'Delete Memory',
      'Are you sure you want to delete this memory fact? The AI will forget this.',
      'Delete',
      'Cancel'
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/ai/memories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMemories(memories.filter(m => m.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  }

  const activeProviderObj = providersList.find(p => p.id === activeProvider);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Command Center Settings</h1>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading settings & memories...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* AI Providers Keys Panel */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>key</span>
                  AI API Keys & Providers Configuration
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                  Add your custom API keys for the big players. Your credentials will remain stored securely locally.
                </p>
              </div>
              
              {/* Active Provider Indicator Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '8px 16px', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>ACTIVE PROVIDER:</span>
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  color: activeProviderObj?.color || 'var(--accent-color)', 
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}>
                  <i className={activeProviderObj?.icon || 'fa-solid fa-server'}></i>
                  {activeProviderObj?.label || 'NVIDIA NIM'}
                </span>
              </div>
            </div>

            {/* Providers Layout Split */}
            <div style={{ display: 'flex', gap: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px', flexWrap: 'wrap' }}>
              {/* Left Selector List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '240px', flexShrink: 0 }}>
                {providersList.map(prov => {
                  const isSelected = editingProvider === prov.id;
                  const isActive = activeProvider === prov.id;
                  return (
                    <button
                      key={prov.id}
                      onClick={() => setEditingProvider(prov.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: isSelected ? 'rgba(255,255,255,0.05)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s ease',
                      }}
                      className="menu-item-button"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        <i className={prov.icon} style={{ width: '16px', color: isSelected ? prov.color : 'var(--text-muted)' }}></i>
                        <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 600 : 500 }}>{prov.label}</span>
                      </div>
                      
                      {/* Badge if Active */}
                      {isActive && (
                        <span style={{ fontSize: '0.65rem', background: 'var(--accent-dim)', color: 'var(--accent-hover)', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                          ACTIVE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Right Configuration Form */}
              {(() => {
                const targetProv = providersList.find(p => p.id === editingProvider) || providersList[0];
                return (
                  <div style={{ flex: 1, minWidth: '280px', padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', color: targetProv.color }}>
                        <i className={targetProv.icon}></i>
                        Configure {targetProv.label}
                      </h4>
                      {activeProvider !== targetProv.id && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', height: '26px' }}
                          onClick={() => handleSetActiveProvider(targetProv.id)}
                        >
                          Set as Active Provider
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label htmlFor="api_key_field" style={{ margin: 0 }}>API Key / Secret Token</label>
                          <button
                            type="button"
                            onClick={() => setShowKey(prev => ({ ...prev, [targetProv.id]: !prev[targetProv.id] }))}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                          >
                            {showKey[targetProv.id] ? 'Hide Key' : 'Reveal Key'}
                          </button>
                        </div>
                        <input
                          id="api_key_field"
                          type={showKey[targetProv.id] ? 'text' : 'password'}
                          placeholder={targetProv.id === 'ollama' ? 'Optional for local endpoints' : `Enter ${targetProv.label} API Key`}
                          style={{ width: '100%', fontSize: '0.85rem' }}
                          value={providerKeys[targetProv.id] || ''}
                          onChange={e => setProviderKeys({ ...providerKeys, [targetProv.id]: e.target.value })}
                        />
                      </div>

                      <div>
                        <label htmlFor="base_url_field">Base endpoint URL (Customizable)</label>
                        <input
                          id="base_url_field"
                          type="text"
                          placeholder={targetProv.defaultUrl || 'e.g. http://localhost:8080/v1'}
                          style={{ width: '100%', fontSize: '0.85rem' }}
                          value={providerUrls[targetProv.id] || ''}
                          onChange={e => setProviderUrls({ ...providerUrls, [targetProv.id]: e.target.value })}
                        />
                        {targetProv.defaultUrl && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                            Default URL: <code>{targetProv.defaultUrl}</code> (Leave blank to use default)
                          </span>
                        )}
                      </div>

                      <button
                        className="btn btn-primary"
                        style={{ marginTop: '4px', width: 'fit-content' }}
                        disabled={savingSettings}
                        onClick={() => handleSaveCredentials(targetProv.id)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
                        Save Credentials
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Model Selection */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>psychology</span>
              AI Model Configuration
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Select which LLM model from the active provider ({activeProviderObj?.label}) catalog will power your text generation, image rendering, and video creation.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <label htmlFor="text_model_select">Active Text Model</label>
                {availableTextModels.length === 0 ? (
                  <input
                    type="text"
                    value={activeTextModel}
                    placeholder="Enter custom text model"
                    onChange={e => handleSaveModel('text', e.target.value)}
                    style={{ width: '100%' }}
                  />
                ) : (
                  <select id="text_model_select" style={{ width: '100%' }} value={activeTextModel} onChange={e => handleSaveModel('text', e.target.value)}>
                    {availableTextModels.map(modelId => (
                      <option key={modelId} value={modelId}>{modelId}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label htmlFor="image_model_select">Active Image Model</label>
                {availableImageModels.length === 0 ? (
                  <input
                    type="text"
                    value={activeImageModel}
                    placeholder="Enter custom image model"
                    onChange={e => handleSaveModel('image', e.target.value)}
                    style={{ width: '100%' }}
                  />
                ) : (
                  <select id="image_model_select" style={{ width: '100%' }} value={activeImageModel} onChange={e => handleSaveModel('image', e.target.value)}>
                    {availableImageModels.map(modelId => (
                      <option key={modelId} value={modelId}>{modelId}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label htmlFor="video_model_select">Active Video Model</label>
                {availableVideoModels.length === 0 ? (
                  <input
                    type="text"
                    value={activeVideoModel}
                    placeholder="Enter custom video model"
                    onChange={e => handleSaveModel('video', e.target.value)}
                    style={{ width: '100%' }}
                  />
                ) : (
                  <select id="video_model_select" style={{ width: '100%' }} value={activeVideoModel} onChange={e => handleSaveModel('video', e.target.value)}>
                    {availableVideoModels.map(modelId => (
                      <option key={modelId} value={modelId}>{modelId}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* AI Memories Management */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)' }}>memory</span>
              AI Memory facts
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
              As you converse with the AI Copilot, it automatically extracts career facts, goals, and technical stack preferences. These are stored below and used as system context in subsequent chats.
            </p>

            {memories.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No memory facts saved yet. Chat with the AI Copilot to start teaching it about your career goals!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {memories.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.75rem', background: 'var(--accent-dim)', color: 'var(--accent-hover)', padding: '2px 6px', borderRadius: '4px', textTransform: 'capitalize' }}>
                        {m.category || 'Extracted'}
                      </span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{m.fact}</span>
                    </div>
                    <button className="collapse-btn" onClick={() => handleDeleteMemory(m.id)}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--danger-color)' }}>close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

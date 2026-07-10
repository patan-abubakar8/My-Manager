import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Applications from './pages/Applications';
import ResumeCreator from './pages/ResumeCreator';
import Ideas from './pages/Ideas';
import Settings from './pages/Settings';
import Social from './pages/Social';

import NavigationLayout from './layouts/NavigationLayout';
import ToastNotification, { type ToastData } from './components/ToastNotification';
import './styles/App.css';

export default function App() {
  const [activeIdea, setActiveIdea] = useState<any>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    (window as any).showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setToast({ message, type, id: Date.now() });
    };
  }, []);
  
  return (
    <BrowserRouter>
      <NavigationLayout 
        activeIdea={activeIdea} 
        setActiveIdea={setActiveIdea}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/resumes" element={<ResumeCreator />} />
          <Route path="/ideas" element={<Ideas onDeepDive={(idea) => {
            setActiveIdea(idea);
          }} />} />
          <Route path="/social" element={<Social />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </NavigationLayout>
      {toast && <ToastNotification toast={toast} onClose={() => setToast(null)} />}
    </BrowserRouter>
  );
}

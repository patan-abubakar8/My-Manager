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
import ConfirmationModal from './components/ConfirmationModal';
import './styles/App.css';

interface ModalState {
  isOpen: boolean;
  title: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
  resolve?: (value: boolean) => void;
}

export default function App() {
  const [activeIdea, setActiveIdea] = useState<any>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    title: '',
    content: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel'
  });

  useEffect(() => {
    (window as any).showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setToast({ message, type, id: Date.now() });
    };

    (window as any).showConfirm = (
      title: string,
      content: string,
      confirmText: string = 'Confirm',
      cancelText: string = 'Cancel'
    ) => {
      return new Promise<boolean>((resolve) => {
        setModal({
          isOpen: true,
          title,
          content,
          confirmText,
          cancelText,
          resolve
        });
      });
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
      {modal.isOpen && (
        <ConfirmationModal
          title={modal.title}
          content={modal.content}
          confirmText={modal.confirmText}
          cancelText={modal.cancelText}
          onConfirm={() => {
            modal.resolve?.(true);
            setModal(prev => ({ ...prev, isOpen: false }));
          }}
          onCancel={() => {
            modal.resolve?.(false);
            setModal(prev => ({ ...prev, isOpen: false }));
          }}
        />
      )}
    </BrowserRouter>
  );
}

import { useEffect, useState } from 'react';

export interface ToastData {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
}

interface ToastNotificationProps {
  toast: ToastData;
  onClose: () => void;
}

export default function ToastNotification({ toast, onClose }: ToastNotificationProps) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    setFade(false);
    const fadeTimer = setTimeout(() => {
      setFade(true);
    }, 3200);

    const closeTimer = setTimeout(() => {
      onClose();
    }, 3500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [toast, onClose]);

  const iconName = toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info';

  return (
    <div className="toast-container">
      <div className={`custom-toast ${toast.type} ${fade ? 'fade-out' : ''}`}>
        <span className="material-symbols-outlined toast-icon">{iconName}</span>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}

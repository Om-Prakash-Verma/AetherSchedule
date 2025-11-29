import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import type { Toast as ToastType } from '../../context/ToastContext';
import { GlassPanel } from '../GlassPanel';

interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

const icons = {
  success: <CheckCircle className="text-green-400" />,
  error: <XCircle className="text-red-400" />,
  info: <Info className="text-blue-400" />,
};

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300); // Wait for exit animation
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <GlassPanel
      className={`relative w-full max-w-sm overflow-hidden p-4 flex items-start gap-4 transition-all duration-300 transform ${
        exiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      }`}
    >
      <div className="shrink-0 pt-0.5">{icons[toast.type]}</div>
      <div className="flex-1">
        <p className="text-white font-semibold text-sm">{toast.message}</p>
      </div>
      <button onClick={handleDismiss} className="shrink-0 text-text-muted hover:text-white">
        <X size={18} />
      </button>
      <div
        className="absolute bottom-0 left-0 h-1 bg-[var(--accent)]"
        style={{
          animation: `shrink ${toast.duration}ms linear forwards`,
        }}
      />
    </GlassPanel>
  );
};
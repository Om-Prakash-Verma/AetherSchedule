import React from 'react';
import { X } from 'lucide-react';
import { GlassPanel } from '../GlassPanel';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, className = 'max-w-lg' }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose} 
    >
      <GlassPanel 
        className={`bg-panel/95 backdrop-blur-xl w-full m-4 max-h-[90vh] flex flex-col ${className}`}
        onClick={(e) => e.stopPropagation()} 
      >
        <header className="p-6 border-b border-[var(--border)] flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-white">
            <X size={20} />
          </button>
        </header>
        
        <main className="flex-1 overflow-y-auto p-6">
            {children}
        </main>
        
        {footer && (
          <footer className="p-6 border-t border-[var(--border)] mt-auto shrink-0 flex justify-end gap-4">
            {footer}
          </footer>
        )}
      </GlassPanel>
    </div>
  );
};

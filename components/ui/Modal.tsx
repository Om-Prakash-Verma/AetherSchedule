// FIX: Removed invalid file header comment that was causing a syntax error.
import React, { useEffect, useRef } from 'react';
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
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();
        }

        if (event.key === 'Tab') {
          const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (!focusableElements || focusableElements.length === 0) return;

          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (event.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              event.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              event.preventDefault();
            }
          }
        }
      };
      
      setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        firstFocusable?.focus();
      }, 100);

      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        if (triggerRef.current instanceof HTMLElement) {
          triggerRef.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in-up"
      style={{ animationDuration: '200ms', animationFillMode: 'forwards', opacity: 0 }}
      onClick={onClose} 
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <GlassPanel 
        ref={modalRef}
        className={`bg-panel/95 backdrop-blur-xl w-full m-4 max-h-[90vh] flex flex-col animate-modal-in ${className}`}
        onClick={(e) => e.stopPropagation()} 
      >
        <header className="p-6 border-b border-[var(--border)] flex justify-between items-center shrink-0">
          <h2 id="modal-title" className="text-xl font-bold text-[var(--text-white)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-white)]">
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
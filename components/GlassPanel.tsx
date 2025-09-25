import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-panel/90 backdrop-blur-xl border border-[var(--border)] rounded-xl shadow-lg ${className}`}
    >
      {children}
    </div>
  );
};

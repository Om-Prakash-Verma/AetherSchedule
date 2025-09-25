import React from 'react';
import { ChevronDown } from 'lucide-react';

interface GlassSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
  className?: string;
}

export const GlassSelect: React.FC<GlassSelectProps> = ({ children, className = '', ...props }) => {
  return (
    <div className={`relative w-full ${className}`}>
      <select
        className="glass-input w-full appearance-none pr-8"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none"
      />
    </div>
  );
};
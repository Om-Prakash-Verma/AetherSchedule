import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../utils/cn';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary';
  className?: string;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  icon: Icon,
  variant = 'primary',
  className = '',
  ...props
}) => {
  const baseClasses = 'px-4 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 border disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] focus-visible:ring-[var(--accent)]';

  const variantClasses = {
    primary: 'bg-[var(--accent)] text-[var(--text-white)] border-transparent hover:bg-[var(--accent)]/90',
    secondary: 'bg-[hsl(var(--panel-hsl)_/_0.5)] text-[var(--text-muted)] border-[var(--border)] hover:bg-[var(--panel)] hover:text-[var(--text-white)]',
  };

  return (
    <button className={cn(baseClasses, variantClasses[variant], className)} {...props}>
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};
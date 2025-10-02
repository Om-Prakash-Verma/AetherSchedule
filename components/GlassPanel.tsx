
import React from 'react';
import { cn } from '../utils/cn';

// FIX: Extend React.HTMLAttributes<HTMLDivElement> to allow standard div props like style, title, etc.
interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

// Use React.forwardRef to allow passing a ref to the underlying div
export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ children, className = '', ...props }, ref) => { // FIX: Destructure ...props to pass them down
    return (
      <div
        ref={ref} // Attach the ref here
        className={cn(
          'bg-panel/90 backdrop-blur-xl border border-[var(--border)] rounded-xl shadow-lg',
          className
        )}
        {...props} // FIX: Spread remaining props to the div element
      >
        {children}
      </div>
    );
  }
);

GlassPanel.displayName = 'GlassPanel';

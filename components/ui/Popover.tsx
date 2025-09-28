import React, { useRef, useEffect, useCallback, createContext, useContext, useState } from 'react';

interface PopoverContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

const PopoverContext = createContext<PopoverContextType | null>(null);

export const usePopover = () => {
  const context = useContext(PopoverContext);
  if (!context) throw new Error('usePopover must be used within a Popover provider');
  return context;
};

interface PopoverProps {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const Popover: React.FC<PopoverProps> = ({ children, open, onOpenChange }) => {
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      // Clicks on the trigger shouldn't close it, onContextMenu handles that
      triggerRef.current &&
      !triggerRef.current.contains(event.target as Node) &&
      contentRef.current &&
      !contentRef.current.contains(event.target as Node)
    ) {
      onOpenChange(false);
    }
  }, [onOpenChange]);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, handleClickOutside]);

  return (
    <PopoverContext.Provider value={{ open, onOpenChange, triggerRef, contentRef }}>
      <div className="relative inline-block w-full">{children}</div>
    </PopoverContext.Provider>
  );
};

export const PopoverTrigger: React.FC<{ children: React.ReactElement; asChild?: boolean }> = ({ children, asChild }) => {
  const { triggerRef, onOpenChange, open } = usePopover();
  
  if (asChild) {
    return React.cloneElement(children, { ref: triggerRef });
  }

  return (
    <button ref={triggerRef as React.RefObject<HTMLButtonElement>} onClick={() => onOpenChange(!open)}>
      {children}
    </button>
  );
};

export const PopoverContent: React.FC<{ 
    children: React.ReactNode;
    className?: string;
    position: { top: number; left: number } | null;
}> = ({ children, className = '', position }) => {
  const { open, contentRef } = usePopover();

  if (!open || !position) return null;

  const baseClassName = "fixed z-50 border border-[var(--border)] bg-panel-strong backdrop-blur-md rounded-lg shadow-2xl data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

  return (
    <div
      ref={contentRef}
      className={`${baseClassName} ${className}`}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {children}
    </div>
  );
};
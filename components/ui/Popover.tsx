import React, { useState, useRef, useEffect, useCallback } from 'react';

interface PopoverContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

const PopoverContext = React.createContext<PopoverContextType | null>(null);

export const usePopover = () => {
  const context = React.useContext(PopoverContext);
  if (!context) {
    throw new Error('usePopover must be used within a Popover provider');
  }
  return context;
};

export const Popover: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      triggerRef.current &&
      !triggerRef.current.contains(event.target as Node) &&
      contentRef.current &&
      !contentRef.current.contains(event.target as Node)
    ) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClickOutside]);
  
  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      <div className="relative inline-block w-full h-full">{children}</div>
    </PopoverContext.Provider>
  );
};

export const PopoverTrigger: React.FC<{ children: React.ReactElement; asChild?: boolean }> = ({ children, asChild }) => {
  const { setOpen, triggerRef } = usePopover();
  
  if (asChild) {
    return React.cloneElement(
        children as React.ReactElement<{ ref: React.Ref<HTMLElement>; onClick: () => void; }>, 
        {
          ref: triggerRef,
          onClick: () => setOpen(o => !o),
        }
    );
  }

  return (
    <button ref={triggerRef as React.RefObject<HTMLButtonElement>} onClick={() => setOpen(o => !o)}>
      {children}
    </button>
  );
};

export const PopoverContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { open, contentRef } = usePopover();

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      className="absolute z-50 w-72 mt-2 border border-[var(--border)] bg-panel-strong backdrop-blur-md rounded-lg shadow-2xl animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
      style={{ top: '100%', left: '50%', transform: 'translateX(-50%)' }}
    >
      {children}
    </div>
  );
};
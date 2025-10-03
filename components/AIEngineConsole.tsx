import React, { useEffect, useRef, useState } from 'react';
import { GlassPanel } from './GlassPanel';
import { X, Terminal, ChevronsDown, ChevronsUp } from 'lucide-react';
import { cn } from '../utils/cn';

interface AIEngineConsoleProps {
  isVisible: boolean;
  onClose: () => void;
  messages: string[];
  isLoading: boolean;
}

export const AIEngineConsole: React.FC<AIEngineConsoleProps> = ({ isVisible, onClose, messages, isLoading }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // State for position, dragging, and collapsing
  const [position, setPosition] = useState(() => {
      const rightMargin = 16;
      const bottomMargin = 16;
      const panelWidth = 512; // Corresponds to max-w-lg
      const panelHeight = 320; // Corresponds to h-80
      return {
          x: Math.max(0, window.innerWidth - panelWidth - rightMargin),
          y: Math.max(0, window.innerHeight - panelHeight - bottomMargin)
      };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Effect to scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Effect for handling drag events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const panelWidth = panelRef.current?.offsetWidth || 0;
      const panelHeight = panelRef.current?.offsetHeight || 0;
      // Clamp position to be within viewport
      const newX = Math.max(0, Math.min(window.innerWidth - panelWidth, e.clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - panelHeight, e.clientY - dragOffset.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);
  
  const handleMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    // Only drag with the left mouse button and not on buttons
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    e.preventDefault();
  };

  if (!isVisible) return null;

  return (
    <div
      ref={panelRef}
      className="fixed w-full max-w-lg z-40 animate-fade-in-up"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        animationDuration: '300ms'
      }}
    >
      <GlassPanel className={cn(
          "flex flex-col shadow-2xl border-accent/20 transition-all duration-300",
          isCollapsed ? "h-auto" : "h-80"
      )}>
        <header
          onMouseDown={handleMouseDown}
          className={cn(
              "p-2 border-b border-[var(--border)] flex justify-between items-center bg-panel-strong/50 shrink-0",
              isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-[var(--green-400)]" />
            <h3 className="text-sm font-bold text-[var(--text-white)] font-mono select-none">AI CORE TERMINAL</h3>
          </div>
          <div className="flex items-center">
             <button onClick={() => setIsCollapsed(!isCollapsed)} className="text-[var(--text-muted)] hover:text-[var(--text-white)] p-1">
                {isCollapsed ? <ChevronsUp size={16} /> : <ChevronsDown size={16} />}
            </button>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-white)] p-1">
              <X size={16} />
            </button>
          </div>
        </header>
        
        {!isCollapsed && (
            <main ref={scrollRef} className="flex-1 overflow-y-auto p-3 font-mono text-sm space-y-1 text-[var(--green-300)] bg-black/30">
              {messages.map((msg, i) => (
                <p key={i} className="whitespace-pre-wrap animate-line-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <span className="text-green-500/50 mr-2">&gt;</span>{msg}
                </p>
              ))}
              {isLoading && <div className="blinking-cursor" />}
            </main>
        )}
      </GlassPanel>
    </div>
  );
};
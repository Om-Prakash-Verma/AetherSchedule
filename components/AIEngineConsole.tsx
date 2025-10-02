import React, { useEffect, useRef } from 'react';
import { GlassPanel } from './GlassPanel';
import { X, Terminal } from 'lucide-react';

interface AIEngineConsoleProps {
  isVisible: boolean;
  onClose: () => void;
  messages: string[];
  isLoading: boolean;
}

export const AIEngineConsole: React.FC<AIEngineConsoleProps> = ({ isVisible, onClose, messages, isLoading }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 w-full max-w-lg z-50 animate-fade-in-up" style={{ animationDuration: '300ms' }}>
      <GlassPanel className="h-80 flex flex-col shadow-2xl border-accent/20">
        <header className="p-2 border-b border-[var(--border)] flex justify-between items-center bg-panel-strong/50 shrink-0">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-[var(--green-400)]" />
            <h3 className="text-sm font-bold text-[var(--text-white)] font-mono">AI CORE TERMINAL</h3>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-white)] p-1">
            <X size={16} />
          </button>
        </header>
        <main ref={scrollRef} className="flex-1 overflow-y-auto p-3 font-mono text-sm space-y-1 text-[var(--green-300)] bg-black/30">
          {messages.map((msg, i) => (
            <p key={i} className="whitespace-pre-wrap animate-line-in" style={{ animationDelay: `${i * 50}ms` }}>
              <span className="text-green-500/50 mr-2">&gt;</span>{msg}
            </p>
          ))}
          {isLoading && <div className="blinking-cursor" />}
        </main>
      </GlassPanel>
    </div>
  );
};
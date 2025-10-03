import React, { useState } from 'react';
import { GlassPanel } from './GlassPanel';
import { GlassButton } from './GlassButton';
import { Bot, Send, Sparkles, Check, X } from 'lucide-react';
import { Skeleton } from './ui/Skeleton';

interface AICommandBarProps {
  onCommand: (command: string) => void;
  isProcessing: boolean;
  aiSuggestion?: {
      summary: string;
      onConfirm: () => void;
      onDiscard: () => void;
  } | null;
  disabled?: boolean;
}

export const AICommandBar: React.FC<AICommandBarProps> = ({ onCommand, isProcessing, aiSuggestion, disabled }) => {
    const [command, setCommand] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (command.trim() && !isProcessing && !disabled) {
            onCommand(command.trim());
            setCommand('');
        }
    };

    const renderContent = () => {
        if (disabled) {
             return <p className="text-xs text-text-muted text-center">Load or create a draft to activate the AI assistant.</p>
        }

        if (isProcessing) {
            return (
                <div className="flex items-center gap-3">
                    <Bot size={20} className="text-accent animate-pulse" />
                    <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </div>
            )
        }

        if (aiSuggestion) {
            return (
                 <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="flex items-start gap-2 flex-1">
                        <Sparkles size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-white">AI Suggestion:</p>
                            <p className="text-xs text-text-muted">{aiSuggestion.summary}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                         <GlassButton onClick={aiSuggestion.onConfirm} className="text-sm py-1 px-3 bg-green-500/20 text-green-300 hover:bg-green-500/30 border-green-500/30"><Check size={14}/> Apply</GlassButton>
                         <GlassButton onClick={aiSuggestion.onDiscard} variant="secondary" className="text-sm py-1 px-3"><X size={14}/> Discard</GlassButton>
                    </div>
                </div>
            )
        }

        return (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <Bot size={20} className="text-accent shrink-0" />
                <input
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="e.g., 'Move DS Lab to Tuesday morning for CS S3 A'"
                    className="flex-1 bg-transparent focus:outline-none text-sm text-white placeholder:text-text-muted/70"
                />
                <GlassButton type="submit" className="p-2 aspect-square" disabled={!command.trim()}>
                    <Send size={14} />
                </GlassButton>
            </form>
        )
    }

    return (
        <GlassPanel className="p-3">
           {renderContent()}
        </GlassPanel>
    )
}
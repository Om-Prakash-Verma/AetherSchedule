import React from 'react';
import { Modal } from './ui/Modal';
import { GlassButton } from './GlassButton';
import { Loader2, Sparkles } from 'lucide-react';

interface AIComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: string | null;
  isLoading: boolean;
}

export const AIComparisonModal: React.FC<AIComparisonModalProps> = ({ isOpen, onClose, analysis, isLoading }) => {
  const footer = (
    <GlassButton onClick={onClose}>Close</GlassButton>
  );

  // A simple markdown-to-HTML renderer
  const renderAnalysis = (text: string) => {
      const html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\n/g, '<br />'); // Newlines
      return { __html: html };
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Timetable Comparison"
      footer={footer}
      className="max-w-2xl"
    >
      <div className="min-h-[20rem]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="font-semibold">AI is analyzing the candidates...</p>
            <p className="text-sm">This may take a moment.</p>
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-yellow-400 bg-yellow-900/20 p-3 rounded-lg">
                <Sparkles className="w-6 h-6 shrink-0"/>
                <h3 className="text-lg font-bold text-white">Gemini Analysis Report</h3>
            </div>
            {/* Using a simple method to render basic markdown for now */}
            <div 
              className="prose prose-invert prose-sm text-text-muted space-y-2"
              dangerouslySetInnerHTML={{ __html: analysis.replace(/\n/g, '<br />') }}
            />
          </div>
        ) : (
             <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <p>No analysis available.</p>
            </div>
        )}
      </div>
    </Modal>
  );
};
import React from 'react';
import { GlassPanel } from '../GlassPanel';
import { GlassButton } from '../GlassButton';
import { GeneratedTimetable } from '../../types';
import { Bot } from 'lucide-react';
import { cn } from '../../utils/cn';

interface SchedulerCandidatesProps {
    candidates: GeneratedTimetable[];
    viewedCandidate: GeneratedTimetable | null;
    onViewCandidate: (candidate: GeneratedTimetable) => void;
    onSaveCandidate: (candidate: GeneratedTimetable) => void;
    selectedForComparison: string[];
    onCompareSelection: React.Dispatch<React.SetStateAction<string[]>>;
    onCompare: (ids: string[]) => void;
    isComparing: boolean;
}

export const SchedulerCandidates: React.FC<SchedulerCandidatesProps> = ({ candidates, viewedCandidate, onViewCandidate, onSaveCandidate, selectedForComparison, onCompareSelection, onCompare, isComparing }) => {
    if (candidates.length === 0) return null;

    const handleSelectForCompare = (candidateId: string) => {
        onCompareSelection(prev => {
            if (prev.includes(candidateId)) return prev.filter(id => id !== candidateId);
            if (prev.length < 2) return [...prev, candidateId];
            return [prev[0], candidateId];
        });
    };

    return (
        <GlassPanel className="p-4">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-bold">New Candidates</h2>
                <GlassButton icon={Bot} variant="secondary" className="text-xs py-1 px-2" disabled={selectedForComparison.length !== 2 || isComparing} onClick={() => onCompare(selectedForComparison)}>
                    {isComparing ? 'Analyzing...' : 'Compare with AI'}
                </GlassButton>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
               {candidates.map((cand, i) => (
                   <div key={cand.id} className={cn('p-3 rounded-lg border transition-colors', viewedCandidate?.id === cand.id ? 'bg-accent/20 border-accent/30' : 'bg-panel/50 border-transparent hover:border-accent/30 hover:bg-accent/10')}>
                        <div className="flex items-start gap-3">
                            <input type="checkbox" className="mt-1 h-4 w-4 rounded border-[var(--border)] text-accent focus:ring-accent accent-accent bg-panel" checked={selectedForComparison.includes(cand.id)} onChange={() => handleSelectForCompare(cand.id)} />
                            <div className="flex-1">
                                <p className="font-semibold text-white">Candidate {i+1}</p>
                                <div className="text-xs text-text-muted grid grid-cols-2 gap-x-2">
                                    <span>Score: <span className="font-mono text-white">{cand.metrics.score.toFixed(0)}</span></span>
                                    <span>S. Gaps: <span className="font-mono text-white">{cand.metrics.studentGaps}</span></span>
                                    <span>F. Gaps: <span className="font-mono text-white">{cand.metrics.facultyGaps}</span></span>
                                    <span>F. Var: <span className="font-mono text-white">{cand.metrics.facultyWorkloadDistribution.toFixed(1)}</span></span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                 <GlassButton variant="secondary" className="text-xs py-1 px-2" onClick={() => onViewCandidate(cand)}>View</GlassButton>
                                 <GlassButton variant="secondary" className="text-xs py-1 px-2" onClick={() => onSaveCandidate(cand)}>Save</GlassButton>
                            </div>
                        </div>
                   </div>
               ))}
            </div>
        </GlassPanel>
    );
};

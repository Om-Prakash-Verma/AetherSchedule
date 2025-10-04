import React from 'react';
import { GlassPanel } from '../GlassPanel';
import { GlassButton } from '../GlassButton';
import { GeneratedTimetable } from '../../types';
import { Trash2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const statusColors: Record<GeneratedTimetable['status'], string> = {
    Draft: 'bg-yellow-500/10 text-yellow-500',
    Submitted: 'bg-blue-500/10 text-blue-400',
    Approved: 'bg-green-500/10 text-green-400',
    Rejected: 'bg-red-500/10 text-red-400',
    Archived: 'bg-gray-500/10 text-text-muted',
};

interface SchedulerVersionsProps {
    versions: GeneratedTimetable[];
    selectedVersionId: string | null;
    onSelectVersion: (id: string) => void;
    onDeleteVersion: (version: GeneratedTimetable) => void;
    isBatchSelected?: boolean;
}

export const SchedulerVersions: React.FC<SchedulerVersionsProps> = ({ versions, selectedVersionId, onSelectVersion, onDeleteVersion, isBatchSelected }) => {
    return (
        <GlassPanel className="p-4">
            <h2 className="text-lg font-bold mb-4">Saved Versions</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
                {isBatchSelected && versions.length > 0 ? versions.map(v => (
                    <div key={v.id} className="flex items-center gap-2">
                        <button onClick={() => onSelectVersion(v.id)} className={cn('flex-1 text-left p-3 rounded-lg border transition-colors', selectedVersionId === v.id ? 'bg-accent/20 border-accent/30' : 'bg-panel-strong border-transparent hover:border-[var(--border)] hover:bg-panel')}>
                            <div className="flex justify-between items-center">
                                <p className="font-semibold text-white">Version {v.version}</p>
                                <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[v.status]}`}>{v.status}</span>
                            </div>
                            <p className="text-xs text-text-muted mt-1">Created: {new Date(v.createdAt).toLocaleDateString()}</p>
                        </button>
                        {(['Approved', 'Rejected', 'Archived'].includes(v.status)) && (
                            <GlassButton variant="secondary" className="p-2 aspect-square !border-danger/30 !bg-danger/10 text-danger/80 hover:!bg-danger/20 hover:!text-danger" title="Delete this version" onClick={() => onDeleteVersion(v)}>
                                <Trash2 size={14} />
                            </GlassButton>
                        )}
                    </div>
                )) : (
                    <p className="text-sm text-text-muted text-center py-4">
                        {isBatchSelected ? 'No saved versions for this combination of batches.' : 'Select batches to see saved versions.'}
                    </p>
                )}
            </div>
        </GlassPanel>
    );
};

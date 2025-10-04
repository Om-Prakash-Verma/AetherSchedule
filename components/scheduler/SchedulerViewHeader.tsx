import React from 'react';
import { GlassButton } from '../GlassButton';
import { GeneratedTimetable } from '../../types';
import { Save, Printer, Calendar, Undo2, Redo2 } from 'lucide-react';
import { exportTimetableToPdf, exportTimetableToIcs } from '../../utils/export';
import { useQuery } from '@tanstack/react-query';
import * as api from '../../services';
import { useAppContext } from '../../hooks/useAppContext';

const statusColors: Record<GeneratedTimetable['status'], string> = {
    Draft: 'bg-yellow-500/10 text-yellow-500',
    Submitted: 'bg-blue-500/10 text-blue-400',
    Approved: 'bg-green-500/10 text-green-400',
    Rejected: 'bg-red-500/10 text-red-400',
    Archived: 'bg-gray-500/10 text-text-muted',
};

interface SchedulerViewHeaderProps {
    timetable: GeneratedTimetable;
    candidateIndex?: number;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onUpdateDraft: () => void;
}

export const SchedulerViewHeader: React.FC<SchedulerViewHeaderProps> = ({ timetable, candidateIndex, canUndo, canRedo, onUndo, onRedo, onUpdateDraft }) => {
    const { timeSlots } = useAppContext();
    const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: api.getSubjects });
    const { data: faculty = [] } = useQuery({ queryKey: ['faculty'], queryFn: api.getFaculty });
    const { data: rooms = [] } = useQuery({ queryKey: ['rooms'], queryFn: api.getRooms });
    const { data: batches = [] } = useQuery({ queryKey: ['batches'], queryFn: api.getBatches });
    
    const firstBatchForExport = batches.find(b => b.id === timetable?.batchIds[0]);
    
    return (
        <div className="border-b border-[var(--border)] pb-4 mb-4 flex flex-wrap justify-between items-center gap-4">
            <div>
                 <h3 className="text-xl font-bold text-white">
                     {timetable.version ? `Version ${timetable.version}` : `Candidate ${candidateIndex !== undefined ? candidateIndex + 1 : ''}`}
                 </h3>
                 <div className="flex items-center gap-2">
                    <p className="text-sm text-text-muted">Status: <span className={`font-semibold ${statusColors[timetable.status]}`}>{timetable.status}</span></p>
                    {canUndo && timetable.status === 'Draft' && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/10 text-orange-400 font-semibold animate-pulse">Unsaved Changes</span>
                    )}
                 </div>
             </div>
            <div className="flex items-center gap-2 flex-wrap">
                {timetable.version ? (
                     <>
                        <GlassButton variant="secondary" icon={Printer} onClick={() => exportTimetableToPdf(timetable, subjects, faculty, rooms, timeSlots, batches)}>PDF</GlassButton>
                        {firstBatchForExport && <GlassButton variant="secondary" icon={Calendar} onClick={() => exportTimetableToIcs(timetable, firstBatchForExport, subjects, faculty, rooms, timeSlots)}>ICS</GlassButton>}
                     </>
                ) : null}
                {timetable.status === 'Draft' && (
                    <>
                        <GlassButton variant="secondary" icon={Undo2} onClick={onUndo} disabled={!canUndo}>Undo</GlassButton>
                        <GlassButton variant="secondary" icon={Redo2} onClick={onRedo} disabled={!canRedo}>Redo</GlassButton>
                        <GlassButton icon={Save} onClick={onUpdateDraft} disabled={!canUndo}>Save Changes</GlassButton>
                    </>
                )}
            </div>
        </div>
    );
};

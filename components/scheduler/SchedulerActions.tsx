import React, { useState } from 'react';
import { GlassPanel } from '../GlassPanel';
import { GlassButton } from '../GlassButton';
import { GeneratedTimetable, User } from '../../types';
import { Send, Check, X } from 'lucide-react';

interface SchedulerActionsProps {
    timetable: GeneratedTimetable;
    user: User | null;
    onUpdateStatus: (status: GeneratedTimetable['status']) => void;
    onAddComment: (comment: string) => void;
}

export const SchedulerActions: React.FC<SchedulerActionsProps> = ({ timetable, user, onUpdateStatus, onAddComment }) => {
    const [comment, setComment] = useState('');

    const handleAddComment = () => {
        if (!comment.trim()) return;
        onAddComment(comment);
        setComment('');
    };

    const canSubmit = user?.role === 'DepartmentHead' || user?.role === 'TimetableManager' || user?.role === 'SuperAdmin';
    const canApprove = user?.role === 'TimetableManager' || user?.role === 'SuperAdmin';

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GlassPanel className="p-4">
                <h3 className="text-lg font-bold mb-4">Actions</h3>
                <div className="space-y-2">
                    {canSubmit && (
                        <GlassButton onClick={() => onUpdateStatus('Submitted')} disabled={timetable.status !== 'Draft'} className="w-full" title={timetable.status !== 'Draft' ? "Only drafts can be submitted." : "Submit for final review"}>
                            Submit for Review
                        </GlassButton>
                    )}
                    {canApprove && (
                        <div className="flex gap-2">
                            <GlassButton onClick={() => onUpdateStatus('Approved')} disabled={timetable.status !== 'Submitted'} icon={Check} className="w-full">Approve</GlassButton>
                            <GlassButton onClick={() => onUpdateStatus('Rejected')} disabled={timetable.status !== 'Submitted'} icon={X} variant="secondary" className="w-full hover:bg-red-500/20 hover:text-red-400">Reject</GlassButton>
                        </div>
                    )}
                    {!canSubmit && <p className="text-sm text-text-muted text-center py-2">You do not have permission to perform actions.</p>}
                </div>
            </GlassPanel>
            <GlassPanel className="p-4 flex flex-col">
                <h3 className="text-lg font-bold mb-4">Comments</h3>
                <div className="space-y-3 max-h-48 overflow-y-auto mb-4 pr-2 flex-1">
                    {timetable.comments?.length > 0 ? timetable.comments.map((c, i) => (
                        <div key={i}>
                            <p className="font-semibold text-white text-sm">{c.userName}</p>
                            <p className="text-text-muted text-sm">{c.text}</p>
                        </div>
                    )) : <p className="text-sm text-text-muted">No comments yet.</p>}
                </div>
                <div className="flex gap-2">
                    <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment..." className="glass-input flex-1"/>
                    <GlassButton icon={Send} onClick={handleAddComment} disabled={!comment.trim()} />
                </div>
            </GlassPanel>
        </div>
    );
};

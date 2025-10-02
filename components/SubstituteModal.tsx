
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './ui/Modal';
import { GlassButton } from './GlassButton';
import { GlassSelect } from './ui/GlassSelect';
import { useToast } from '../hooks/useToast';
import * as api from '../services';
import type { ClassAssignment, Substitution, Subject, RankedSubstitute } from '../types';
import { Loader2, Sparkles, BookOpen, Feather, ThumbsUp, CalendarCheck2 } from 'lucide-react';
import { Skeleton } from './ui/Skeleton';
import { cn } from '../utils/cn';
import { useQuery } from '@tanstack/react-query';

const ReasonIcon: React.FC<{ reason: string }> = ({ reason }) => {
    const r = reason.toLowerCase();
    // FIX: Removed invalid 'title' prop from Lucide icons. Tooltip is handled by the parent component.
    if (r.includes('original subject')) return <BookOpen className="w-4 h-4 text-green-400" />;
    if (r.includes('workload')) return <Feather className="w-4 h-4 text-blue-400" />;
    if (r.includes('allocated to batch')) return <ThumbsUp className="w-4 h-4 text-yellow-400" />;
    if (r.includes('compact')) return <CalendarCheck2 className="w-4 h-4 text-purple-400" />;
    return null;
}

interface SubstituteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (substitution: Omit<Substitution, 'id' | 'createdAt'>) => void;
  targetAssignment: ClassAssignment;
}

export const SubstituteModal: React.FC<SubstituteModalProps> = ({ isOpen, onClose, onConfirm, targetAssignment }) => {
    const { data: allSubjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: api.getSubjects });
    const { data: allFaculty = [] } = useQuery({ queryKey: ['faculty'], queryFn: api.getFaculty });
    const [substitutes, setSubstitutes] = useState<RankedSubstitute[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFacultyId, setSelectedFacultyId] = useState('');
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const toast = useToast();

    useEffect(() => {
        if (isOpen && targetAssignment) {
            setSelectedFacultyId('');
            setSelectedSubjectId('');
            setStartDate('');
            setEndDate('');
            
            const fetchSubstitutes = async () => {
                setIsLoading(true);
                try {
                    const foundSubstitutes = await api.findSubstitutes(targetAssignment.id);
                    setSubstitutes(foundSubstitutes);
                } catch (e: any) {
                    toast.error(e.message || "Failed to find substitutes.");
                    setSubstitutes([]);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchSubstitutes();
        }
    }, [isOpen, targetAssignment, toast]);
    
    const selectedSubstitute = useMemo(() => {
        return substitutes.find(s => s.faculty.id === selectedFacultyId);
    }, [substitutes, selectedFacultyId]);
    
    useEffect(() => {
        if (selectedSubstitute) {
            const canTeachOriginal = selectedSubstitute.suitableSubjects.some(s => s.id === targetAssignment.subjectId);
            setSelectedSubjectId(canTeachOriginal ? targetAssignment.subjectId : '');
        } else {
            setSelectedSubjectId('');
        }
    }, [selectedSubstitute, targetAssignment.subjectId]);


    const handleSubmit = () => {
        if (!selectedFacultyId || !selectedSubjectId || !startDate || !endDate) {
            toast.error("Please fill all fields.");
            return;
        }
        if (new Date(startDate) > new Date(endDate)) {
            toast.error("Start date cannot be after end date.");
            return;
        }

        const substitution: Omit<Substitution, 'id' | 'createdAt'> = {
            originalAssignmentId: targetAssignment.id,
            originalFacultyId: targetAssignment.facultyIds[0], // Assuming single-teacher class
            substituteFacultyId: selectedFacultyId,
            substituteSubjectId: selectedSubjectId,
            roomId: targetAssignment.roomId,
            batchId: targetAssignment.batchId,
            day: targetAssignment.day,
            slot: targetAssignment.slot,
            startDate,
            endDate,
        };
        onConfirm(substitution);
    };

    const targetSubject = allSubjects.find(s => s.id === targetAssignment.subjectId);
    const targetFaculty = allFaculty.find(f => f.id === targetAssignment.facultyIds[0]);

    const footer = (
      <>
        <GlassButton type="button" variant="secondary" onClick={onClose}>Cancel</GlassButton>
        <GlassButton type="button" onClick={handleSubmit}>Create Substitution</GlassButton>
      </>
    );

    return (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title="AI-Powered Substitute Finder"
          footer={footer}
          className="max-w-xl"
        >
            <div className="space-y-4">
                <div className="p-3 bg-panel-strong rounded-lg text-sm">
                    <p><span className="font-semibold text-text-muted">Original Class:</span> <span className="text-white">{targetSubject?.name}</span></p>
                    <p><span className="font-semibold text-text-muted">Original Teacher:</span> <span className="text-white">{targetFaculty?.name}</span></p>
                </div>

                {isLoading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                             <div key={i} className="flex items-center gap-4 p-3 border border-transparent rounded-lg">
                                <Skeleton className="w-10 h-10 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                                <Skeleton className="w-12 h-6 rounded-md" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                            {substitutes.length > 0 ? substitutes.map((sub, i) => (
                                <div
                                    key={sub.faculty.id}
                                    onClick={() => setSelectedFacultyId(sub.faculty.id)}
                                    className={cn(
                                        'p-3 rounded-lg border transition-all cursor-pointer flex items-center gap-4',
                                        selectedFacultyId === sub.faculty.id
                                            ? 'bg-accent/20 border-accent/30'
                                            : 'bg-panel/50 border-transparent hover:border-[var(--border)]'
                                    )}
                                >
                                    <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center font-bold text-accent shrink-0">
                                        {sub.faculty.name.charAt(0)}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-white">{sub.faculty.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {sub.reasons.map((reason, idx) => (
                                                <div key={idx} className="group relative flex items-center">
                                                    <ReasonIcon reason={reason} />
                                                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 text-xs text-white bg-panel-strong rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-[var(--border)] shadow-lg">
                                                        {reason}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-1.5 text-yellow-400">
                                            <Sparkles size={14} />
                                            <span className="font-bold text-lg">{sub.score}</span>
                                        </div>
                                        <p className="text-xs text-text-muted -mt-1">AI Score</p>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-center text-sm text-text-muted py-8">No suitable substitutes found.</p>
                            )}
                        </div>

                        {selectedSubstitute && (
                             <GlassSelect
                                placeholder="Select subject to teach..."
                                value={selectedSubjectId}
                                onChange={(val) => setSelectedSubjectId(String(val))}
                                options={selectedSubstitute.suitableSubjects.map(s => ({ value: s.id, label: `${s.code} - ${s.name}` }))}
                            />
                        )}
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-text-muted mb-1 block">Start Date</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="glass-input w-full"/>
                            </div>
                             <div>
                                <label className="text-sm text-text-muted mb-1 block">End Date</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="glass-input w-full"/>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { GlassButton } from '../components/GlassButton';
import { BatchSelectorModal } from '../components/BatchSelectorModal';
import { SubstituteModal } from '../components/SubstituteModal';
import { useAppContext } from '../hooks/useAppContext';
import { useToast } from '../hooks/useToast';
import * as api from '../services';
import type { Batch, GeneratedTimetable, TimetableGrid, DropChange, Conflict, ClassAssignment, SingleBatchTimetableGrid, Substitution } from '../types';
import { Zap, Save, ChevronLeft, ChevronRight, Download, Calendar, Send, Check, X, Loader2, ChevronDown } from 'lucide-react';
import { TimetableView } from '../components/TimetableView';
import { exportTimetableToCsv, exportTimetableToIcs } from '../utils/export';
import { checkConflicts } from '../core/conflictChecker';

const statusColors: Record<GeneratedTimetable['status'], string> = {
    Draft: 'bg-yellow-500/10 text-yellow-500',
    Submitted: 'bg-blue-500/10 text-blue-400',
    Approved: 'bg-green-500/10 text-green-400',
    Rejected: 'bg-red-500/10 text-red-400',
    Archived: 'bg-gray-500/10 text-text-muted',
};

const arrayEquals = (a: string[], b: string[]) => {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((val, index) => val === b[index]);
}

const flattenTimetable = (timetable: TimetableGrid): ClassAssignment[] => {
    return Object.values(timetable).flatMap(batchGrid => 
        Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
    );
};


const Scheduler: React.FC = () => {
    const { 
        user, batches, subjects, faculty, rooms, departments, generatedTimetables, refreshData, timeSlots, constraints,
        fetchBatches, fetchSubjects, fetchFaculty, fetchRooms, fetchDepartments, fetchTimetables, fetchSubstitutions
    } = useAppContext();
    const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [candidates, setCandidates] = useState<GeneratedTimetable[]>([]);
    const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [comment, setComment] = useState('');
    const [editedTimetable, setEditedTimetable] = useState<GeneratedTimetable | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [conflictMap, setConflictMap] = useState<Map<string, Conflict[]>>(new Map());
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [isSubstituteModalOpen, setIsSubstituteModalOpen] = useState(false);
    const [substituteTarget, setSubstituteTarget] = useState<ClassAssignment | null>(null);
    const toast = useToast();
    
    useEffect(() => {
        // Fetch all data required for the scheduler page to function
        fetchBatches();
        fetchDepartments();
        fetchTimetables();
        fetchSubjects();
        fetchFaculty();
        fetchRooms();
        fetchSubstitutions();
    }, [fetchBatches, fetchDepartments, fetchTimetables, fetchSubjects, fetchFaculty, fetchRooms, fetchSubstitutions]);

    const batchOptions = useMemo(() => {
        return departments.map(dept => ({
            label: dept.name,
            options: batches
                .filter(b => b.departmentId === dept.id)
                .map(b => ({ label: b.name, value: b.id }))
        }));
    }, [departments, batches]);

    const savedVersions = useMemo(() => {
        if (selectedBatchIds.length === 0) return [];
        return generatedTimetables
            .filter(tt => arrayEquals([...tt.batchIds].sort(), [...selectedBatchIds].sort()))
            .sort((a, b) => b.version - a.version);
    }, [generatedTimetables, selectedBatchIds]);
    
    const selectedTimetable = useMemo(() => {
        if (selectedVersionId) return generatedTimetables.find(v => v.id === selectedVersionId);
        return candidates[selectedCandidateIndex];
    }, [generatedTimetables, selectedVersionId, candidates, selectedCandidateIndex]);

    const calculateConflicts = useCallback((grid: TimetableGrid | undefined, currentTimetableId: string) => {
        if (!grid) return new Map();
        
        const draftAssignments = flattenTimetable(grid);
        
        const approvedAssignments = generatedTimetables
            .filter(tt => tt.status === 'Approved' && tt.id !== currentTimetableId)
            .flatMap(tt => flattenTimetable(tt.timetable));
            
        const allApprovedAssignments = generatedTimetables.flatMap(tt => flattenTimetable(tt.timetable));
        
        // CRITICAL FIX: The temporary assignment object created for a substitution
        // must use `facultyIds: [sub.substituteFacultyId]` to match the `ClassAssignment` type.
        // The previous code used `facultyId`, which caused the conflict checker to crash.
        const substitutionAssignments: ClassAssignment[] = constraints.substitutions.map(sub => ({
            id: sub.id,
            subjectId: sub.substituteSubjectId,
            facultyIds: [sub.substituteFacultyId],
            roomId: allApprovedAssignments.find(a => a.id === sub.originalAssignmentId)?.roomId || '',
            batchId: sub.batchId,
            day: sub.day,
            slot: sub.slot,
        }));
            
        return checkConflicts(draftAssignments, faculty, rooms, [...approvedAssignments, ...substitutionAssignments]);
    }, [generatedTimetables, faculty, rooms, constraints.substitutions]);
    
    useEffect(() => {
        if (selectedTimetable) {
            setEditedTimetable(JSON.parse(JSON.stringify(selectedTimetable)));
            setConflictMap(calculateConflicts(selectedTimetable.timetable, selectedTimetable.id));
        } else {
            setEditedTimetable(null);
            setConflictMap(new Map());
        }
        setIsDirty(false);
    }, [selectedTimetable, calculateConflicts]);

    const handleDropAssignment = useCallback((change: DropChange) => {
        if (!editedTimetable) return;

        const newGrid: TimetableGrid = JSON.parse(JSON.stringify(editedTimetable.timetable));
        let changedAssignmentIds: string[] = [];

        if (change.type === 'move') {
            const { assignment, to } = change;
            const batchGrid = newGrid[assignment.batchId];
            if (!batchGrid) return;
            // Remove from old position
            if (batchGrid[assignment.day]?.[assignment.slot]) {
                delete batchGrid[assignment.day][assignment.slot];
            }
            // Add to new position
            if (!batchGrid[to.day]) batchGrid[to.day] = {};
            batchGrid[to.day][to.slot] = { ...assignment, day: to.day, slot: to.slot };
            changedAssignmentIds = [assignment.id];

        } else if (change.type === 'swap') {
            const { assignment1, assignment2 } = change;
            const batchGrid1 = newGrid[assignment1.batchId];
            const batchGrid2 = newGrid[assignment2.batchId];
            if (!batchGrid1 || !batchGrid2) return;
            // Place them in each other's slots
            batchGrid1[assignment1.day][assignment1.slot] = { ...assignment2, day: assignment1.day, slot: assignment1.slot };
            batchGrid2[assignment2.day][assignment2.slot] = { ...assignment1, day: assignment2.day, slot: assignment2.slot };
            changedAssignmentIds = [assignment1.id, assignment2.id];
        }

        const newConflictMap = calculateConflicts(newGrid, editedTimetable.id);
        
        // Check for new conflicts on the items that were just moved and notify the user
        for (const id of changedAssignmentIds) {
            const assignmentConflicts = newConflictMap.get(id);
            if (assignmentConflicts && assignmentConflicts.length > 0) {
                toast.error(assignmentConflicts[0].message);
                break; // Show one toast at a time
            }
        }
        
        setEditedTimetable(prev => prev ? { ...prev, timetable: newGrid } : null);
        setConflictMap(newConflictMap);
        setIsDirty(true);
    }, [editedTimetable, calculateConflicts, toast]);

    const handleUpdateDraft = useCallback(async () => {
        if (!editedTimetable || !isDirty) return;
        try {
            await api.updateTimetable(editedTimetable);
            await refreshData();
            setIsDirty(false);
            toast.success('Draft updated successfully.');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update draft.');
        }
    }, [editedTimetable, isDirty, refreshData, toast]);

    const handleBatchChange = (ids: string[]) => {
        setSelectedBatchIds(ids);
        setCandidates([]);
        setSelectedVersionId(null);
    };
    
    const handleConfirmBatchSelection = (ids: string[]) => {
        handleBatchChange(ids);
        setIsBatchModalOpen(false);
    };

    const handleGenerate = useCallback(async () => {
        if (selectedBatchIds.length === 0) {
            toast.error('Please select one or more batches.');
            return;
        }
        setIsLoading(true);
        setCandidates([]);
        setSelectedVersionId(null);
        try {
            const results = await api.runScheduler(selectedBatchIds);
            setCandidates(results);
            setSelectedCandidateIndex(0);
            if (results.length > 0) {
                toast.success(`Generated ${results.length} new candidates.`);
            } else {
                toast.info('No valid timetables could be generated.');
            }
        } catch (error: any) {
            toast.error(error.message || 'Error during generation.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedBatchIds, toast]);

    const handleSaveCandidate = useCallback(async () => {
        const candidateToSave = candidates[selectedCandidateIndex];
        if (!candidateToSave) return;

        const newVersion = (savedVersions.reduce((max, v) => Math.max(max, v.version), 0) || 0) + 1;
        const newTimetable: GeneratedTimetable = {
            ...candidateToSave,
            id: `tt_${selectedBatchIds.join('_')}_v${newVersion}`,
            version: newVersion,
            status: 'Draft',
            comments: [],
            createdAt: new Date().toISOString(),
        };

        try {
            await api.saveTimetable(newTimetable);
            await refreshData();
            setCandidates([]);
            setSelectedVersionId(newTimetable.id);
            toast.success(`Saved as Version ${newVersion}`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to save draft.');
        }
    }, [candidates, selectedCandidateIndex, savedVersions, selectedBatchIds, refreshData, toast]);
    
    const handleUpdateStatus = useCallback(async (status: GeneratedTimetable['status']) => {
        if (!selectedTimetable) return;
        try {
            const updatedTimetable = { ...selectedTimetable, status };
            await api.updateTimetable(updatedTimetable);
            await refreshData();
            toast.success(`Timetable status updated to ${status}.`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to update status.');
        }
    }, [selectedTimetable, refreshData, toast]);

    const handleAddComment = useCallback(async () => {
        if (!comment.trim() || !selectedTimetable || !user) return;
        try {
            const newComment = {
                userId: user.id,
                userName: user.name,
                text: comment.trim(),
                timestamp: new Date().toISOString(),
            };
            const updatedTimetable = { 
                ...selectedTimetable,
                comments: [...(selectedTimetable.comments || []), newComment],
            };
            await api.updateTimetable(updatedTimetable);
            await refreshData();
            setComment('');
            toast.success('Comment added.');
        } catch (error: any) {
            toast.error(error.message || 'Failed to add comment.');
        }
    }, [comment, selectedTimetable, user, refreshData, toast]);
    
    const handleFindSubstitute = (assignment: ClassAssignment) => {
        setSubstituteTarget(assignment);
        setIsSubstituteModalOpen(true);
    };

    const handleCreateSubstitution = async (substitution: Omit<Substitution, 'id'>) => {
        try {
            const newSub: Substitution = {
                ...substitution,
                id: `sub_${Date.now()}`
            };
            await api.createSubstitution(newSub);
            await refreshData();
            toast.success("Substitution created successfully.");
            setIsSubstituteModalOpen(false);
            setSubstituteTarget(null);
        } catch(e: any) {
            toast.error(e.message || "Failed to create substitution.");
        }
    };

    const canSubmit = user?.role === 'DepartmentHead' || user?.role === 'TimetableManager' || user?.role === 'SuperAdmin';
    const canApprove = user?.role === 'TimetableManager' || user?.role === 'SuperAdmin';
    
    const firstBatchForExport = batches.find(b => b.id === selectedTimetable?.batchIds[0]);

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <GlassPanel className="p-4 relative z-10">
                        <h2 className="text-lg font-bold mb-4">Controls</h2>
                        <div className="space-y-4">
                             <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">Select Batches</label>
                                <GlassButton
                                    variant="secondary"
                                    className="w-full justify-between items-center text-left"
                                    onClick={() => setIsBatchModalOpen(true)}
                                >
                                    <span className="truncate pr-2">
                                        {selectedBatchIds.length > 0 ? `${selectedBatchIds.length} batch(es) selected` : 'Click to select batches...'}
                                    </span>
                                    <ChevronDown className="h-4 w-4 text-text-muted shrink-0"/>
                                </GlassButton>
                            </div>
                            <GlassButton 
                                icon={isLoading ? undefined : Zap} 
                                onClick={handleGenerate} 
                                disabled={isLoading || selectedBatchIds.length === 0} 
                                className="w-full"
                            >
                                {isLoading ? 
                                    <span className="flex items-center justify-center">
                                        <Loader2 className="animate-spin mr-2" size={16} /> Optimizing...
                                    </span> 
                                    : 'Generate New'
                                }
                            </GlassButton>
                            {isLoading && (
                                <p className="text-xs text-text-muted text-center mt-2">
                                    AI is devising a multi-phase optimization strategy... Then, executing a high-speed, self-correcting genetic evolution. This may take a moment.
                                </p>
                            )}
                        </div>
                    </GlassPanel>

                    <GlassPanel className="p-4">
                        <h2 className="text-lg font-bold mb-4">Saved Versions</h2>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {selectedBatchIds.length > 0 && savedVersions.length > 0 ? savedVersions.map(v => (
                                <button key={v.id} onClick={() => { setSelectedVersionId(v.id); setCandidates([]); }} 
                                    className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedVersionId === v.id ? 'bg-[var(--accent)]/20 border-[var(--accent)]/30' : 'bg-white/10 border-transparent hover:border-white/20'}`}>
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold text-white">Version {v.version}</p>
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[v.status]}`}>{v.status}</span>
                                    </div>
                                    <p className="text-xs text-text-muted mt-1">Created: {new Date(v.createdAt).toLocaleDateString()}</p>
                                </button>
                            )) : (
                                <p className="text-sm text-text-muted text-center py-4">
                                    {selectedBatchIds.length > 0 ? 'No saved versions for this combination of batches.' : 'Select batches to see saved versions.'}
                                </p>
                            )}
                        </div>
                    </GlassPanel>
                </div>

                <div className="lg:col-span-3 space-y-6">
                    {selectedTimetable && editedTimetable ? (
                        <>
                            <GlassPanel className="p-4">
                                <div className="border-b border-[var(--border)] pb-4 mb-4 flex flex-wrap justify-between items-center gap-4">
                                    <div>
                                         <h3 className="text-xl font-bold text-white">
                                             {selectedTimetable.version ? `Version ${selectedTimetable.version}` : `Candidate ${selectedCandidateIndex + 1}/${candidates.length}`}
                                         </h3>
                                         <div className="flex items-center gap-2">
                                            <p className="text-sm text-text-muted">Status: <span className={`font-semibold ${statusColors[selectedTimetable.status]}`}>{selectedTimetable.status}</span></p>
                                            {isDirty && selectedTimetable.status === 'Draft' && (
                                                <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/10 text-orange-400 font-semibold animate-pulse">Unsaved Changes</span>
                                            )}
                                         </div>
                                     </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {selectedTimetable.version && firstBatchForExport && (
                                             <>
                                                {/* FIX: Pass dynamic timeSlots to export functions. */}
                                                <GlassButton variant="secondary" icon={Download} onClick={() => exportTimetableToCsv(selectedTimetable, firstBatchForExport, subjects, faculty, rooms, timeSlots)}>CSV</GlassButton>
                                                <GlassButton variant="secondary" icon={Calendar} onClick={() => exportTimetableToIcs(selectedTimetable, firstBatchForExport, subjects, faculty, rooms, timeSlots)}>ICS</GlassButton>
                                             </>
                                        )}
                                        {candidates.length > 0 && !selectedVersionId && (
                                            <div className="flex items-center gap-2">
                                                <GlassButton variant="secondary" className="p-2" onClick={() => setSelectedCandidateIndex(p => Math.max(0, p - 1))} disabled={selectedCandidateIndex === 0}><ChevronLeft size={16}/></GlassButton>
                                                <span className="font-mono text-sm">{selectedCandidateIndex + 1} / {candidates.length}</span>
                                                <GlassButton variant="secondary" className="p-2" onClick={() => setSelectedCandidateIndex(p => Math.min(candidates.length - 1, p + 1))} disabled={selectedCandidateIndex === candidates.length - 1}><ChevronRight size={16}/></GlassButton>
                                                <GlassButton icon={Save} onClick={handleSaveCandidate}>Save as Draft</GlassButton>
                                            </div>
                                        )}
                                        {selectedTimetable.version && selectedTimetable.status === 'Draft' && (
                                            <GlassButton icon={Save} onClick={handleUpdateDraft} disabled={!isDirty}>Save Changes</GlassButton>
                                        )}
                                    </div>
                                </div>
                                 <div className="space-y-8">
                                    {editedTimetable.batchIds.map(batchId => {
                                        const batch = batches.find(b => b.id === batchId);
                                        if (!batch) return null;

                                        const singleBatchGrid = editedTimetable.timetable[batchId] || {};
                                        
                                        // Create a temporary GeneratedTimetable-like object for TimetableView
                                        const singleBatchTimetable = {
                                            ...editedTimetable,
                                            id: `${editedTimetable.id}_${batchId}`,
                                            batchIds: [batchId],
                                            timetable: singleBatchGrid, // This now expects SingleBatchTimetableGrid
                                        };

                                        return (
                                            <div key={batchId}>
                                                <h4 className="text-lg font-bold text-white mb-2">{batch.name}</h4>
                                                <TimetableView
                                                    timetableData={singleBatchTimetable}
                                                    isEditable={editedTimetable.status === 'Draft'}
                                                    onDropAssignment={handleDropAssignment}
                                                    onFindSubstitute={handleFindSubstitute}
                                                    conflictMap={conflictMap}
                                                    substitutions={constraints.substitutions}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </GlassPanel>
                            
                            {selectedVersionId && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <GlassPanel className="p-4">
                                        <h3 className="text-lg font-bold mb-4">Actions</h3>
                                        <div className="space-y-2">
                                            {canSubmit && (
                                                <GlassButton 
                                                    onClick={() => handleUpdateStatus('Submitted')} 
                                                    disabled={selectedTimetable.status !== 'Draft' || isDirty} 
                                                    className="w-full"
                                                    title={isDirty ? "Please save your changes before submitting." : "Submit for final review"}
                                                >
                                                    Submit for Review
                                                </GlassButton>
                                            )}
                                            {canApprove && (
                                                <div className="flex gap-2">
                                                    <GlassButton onClick={() => handleUpdateStatus('Approved')} disabled={selectedTimetable.status !== 'Submitted'} icon={Check} className="w-full">Approve</GlassButton>
                                                    <GlassButton onClick={() => handleUpdateStatus('Rejected')} disabled={selectedTimetable.status !== 'Submitted'} icon={X} variant="secondary" className="w-full hover:bg-red-500/20 hover:text-red-400">Reject</GlassButton>
                                                </div>
                                            )}
                                            {!canSubmit && <p className="text-sm text-text-muted text-center py-2">You do not have permission to perform actions.</p>}
                                        </div>
                                    </GlassPanel>
                                    <GlassPanel className="p-4 flex flex-col">
                                        <h3 className="text-lg font-bold mb-4">Comments</h3>
                                        <div className="space-y-3 max-h-48 overflow-y-auto mb-4 pr-2 flex-1">
                                            {selectedTimetable.comments?.length > 0 ? selectedTimetable.comments.map((c, i) => (
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
                            )}
                        </>
                    ) : (
                        <GlassPanel className="p-6 text-center h-96 flex flex-col items-center justify-center">
                            <Zap size={48} className="text-text-muted mb-4"/>
                            <h3 className="text-xl font-bold text-white">No Timetable Selected</h3>
                            <p className="text-text-muted mt-2">Generate new candidates or select a saved version.</p>
                        </GlassPanel>
                    )}
                </div>
            </div>
            <BatchSelectorModal
                isOpen={isBatchModalOpen}
                onClose={() => setIsBatchModalOpen(false)}
                onConfirm={handleConfirmBatchSelection}
                groupedOptions={batchOptions}
                initialSelected={selectedBatchIds}
            />
            {substituteTarget && (
                 <SubstituteModal
                    isOpen={isSubstituteModalOpen}
                    onClose={() => setIsSubstituteModalOpen(false)}
                    onConfirm={handleCreateSubstitution}
                    targetAssignment={substituteTarget}
                />
            )}
        </>
    );
};

export default Scheduler;
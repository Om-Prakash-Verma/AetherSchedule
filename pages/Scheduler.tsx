import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { useAppContext } from '../hooks/useAppContext';
import { useToast } from '../hooks/useToast';
import { useUndoRedo } from '../hooks/useUndoRedo';
import * as api from '../services';
import type { GeneratedTimetable, TimetableGrid, DropChange, Conflict, ClassAssignment, Substitution } from '../types';
import { Bot, Zap } from 'lucide-react';
import { BatchSelectorModal } from '../components/BatchSelectorModal';
import { SubstituteModal } from '../components/SubstituteModal';
import { AIEngineConsole } from '../components/AIEngineConsole';
import { AICommandBar } from '../components/AICommandBar';
import { AIComparisonModal } from '../components/AIComparisonModal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '../hooks/useConfirm';
import { SchedulerControls } from '../components/scheduler/SchedulerControls';
import { SchedulerCandidates } from '../components/scheduler/SchedulerCandidates';
import { SchedulerVersions } from '../components/scheduler/SchedulerVersions';
import { SchedulerViewHeader } from '../components/scheduler/SchedulerViewHeader';
import { SchedulerActions } from '../components/scheduler/SchedulerActions';
import { TimetableView } from '../components/TimetableView';
import { ConflictChecker } from '../core/conflictChecker';

const CONSOLE_MESSAGES = [
    "Waking up the AI scheduling engine...", "Reading all your rules and requirements...",
    "Asking the AI for the smartest way to solve this...", "AI has a plan! Starting the scheduling process...",
    "Creating hundreds of rough draft timetables to start...", "Checking how good the first drafts are...",
    "Evolving the best drafts to make them even better...", "Mixing and matching the best parts of good schedules...",
    "Making small, smart changes to find improvements...", "Checking if we're stuck on a 'good enough' solution...",
    "Thinking outside the box... Asking AI for a creative idea.", "Double-checking to make sure no rules are broken...",
    "Polishing the best options for the final touches...", "Reviewing the top timetable candidates...",
    "Preparing your top 5 timetable options.",
];

const arrayEquals = (a: string[], b: string[]) => {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((val, index) => val === b[index]);
}

const flattenTimetable = (timetable: TimetableGrid): ClassAssignment[] => {
    return Object.values(timetable).flatMap(batchGrid => 
        Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
    );
};

const diffTimetables = (oldGrid: TimetableGrid, newGrid: TimetableGrid, subjects: any[], batches: any[]): string => {
    const oldAssignments = flattenTimetable(oldGrid).map(a => `${a.batchId}-${a.subjectId}-${a.day}-${a.slot}`);
    const newAssignments = flattenTimetable(newGrid);

    const moved: ClassAssignment[] = [];
    newAssignments.forEach(newAsgn => {
        const oldVersion = `${newAsgn.batchId}-${newAsgn.subjectId}-${newAsgn.day}-${newAsgn.slot}`;
        if (!oldAssignments.includes(oldVersion)) {
            moved.push(newAsgn);
        }
    });

    if (moved.length === 2) {
        const sub1 = subjects.find(s => s.id === moved[0].subjectId)?.code;
        const batch1 = batches.find(b => b.id === moved[0].batchId)?.name;
        const sub2 = subjects.find(s => s.id === moved[1].subjectId)?.code;
        const batch2 = batches.find(b => b.id === moved[1].batchId)?.name;
        return `Swap ${sub1} for ${batch1} with ${sub2} for ${batch2}.`;
    }
    if (moved.length === 1) {
         const sub1 = subjects.find(s => s.id === moved[0].subjectId)?.code;
         const batch1 = batches.find(b => b.id === moved[0].batchId)?.name;
         return `Move ${sub1} for ${batch1}.`
    }
    return "Multiple changes were made.";
};


const Scheduler: React.FC = () => {
    const { user } = useAppContext();
    const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [candidates, setCandidates] = useState<GeneratedTimetable[]>([]);
    const [viewedCandidate, setViewedCandidate] = useState<GeneratedTimetable | null>(null);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    
    const [editedTimetable, { set: setEditedTimetable, undo, redo, canUndo, canRedo, reset: resetEditedTimetable }] = useUndoRedo<GeneratedTimetable | null>(null);
    
    const [conflictMap, setConflictMap] = useState<Map<string, Conflict[]>>(new Map());
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [isSubstituteModalOpen, setIsSubstituteModalOpen] = useState(false);
    const [substituteTarget, setSubstituteTarget] = useState<ClassAssignment | null>(null);
    const [isConsoleVisible, setIsConsoleVisible] = useState(false);
    const [consoleMessages, setConsoleMessages] = useState<string[]>([]);
    const messageIntervalRef = useRef<number | null>(null);
    const [isAIProcessing, setIsAIProcessing] = useState(false);
    const [aiSuggestedTimetable, setAISuggestedTimetable] = useState<TimetableGrid | null>(null);
    
    const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
    const [isComparing, setIsComparing] = useState(false);
    const [comparisonResult, setComparisonResult] = useState<string | null>(null);
    const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
    
    const toast = useToast();
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    
    const { data: batches = [] } = useQuery({ queryKey: ['batches'], queryFn: api.getBatches });
    const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: api.getDepartments });
    const { data: generatedTimetables = [] } = useQuery({ queryKey: ['timetables'], queryFn: api.getTimetables });
    const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: api.getSubjects });
    const { data: faculty = [] } = useQuery({ queryKey: ['faculty'], queryFn: api.getFaculty });
    const { data: rooms = [] } = useQuery({ queryKey: ['rooms'], queryFn: api.getRooms });
    const { data: constraints } = useQuery({ queryKey: ['constraints'], queryFn: api.getConstraints, initialData: { substitutions: [], pinnedAssignments: [], plannedLeaves: [], facultyAvailability: [] }});
    const { data: facultyAllocations = [] } = useQuery({ queryKey: ['facultyAllocations'], queryFn: api.getFacultyAllocations });
    const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });


    const deleteTimetableMutation = useMutation({
        mutationFn: (id: string) => api.deleteTimetable(id),
        onSuccess: (data, deletedId) => {
            queryClient.invalidateQueries({ queryKey: ['timetables'] });
            toast.success("Timetable version deleted.");
            if (selectedVersionId === deletedId) {
                setSelectedVersionId(null);
                setViewedCandidate(null);
            }
        },
        onError: (error: Error) => toast.error(error.message || 'Failed to delete timetable.')
    });

    const handleDeleteVersion = async (version: GeneratedTimetable) => {
        const confirmed = await confirm({
            title: `Delete Version ${version.version}`,
            description: `Are you sure you want to permanently delete this timetable version (${version.status})? This action cannot be undone.`
        });
        if (confirmed) deleteTimetableMutation.mutate(version.id);
    };

    const batchOptions = useMemo(() => {
        return departments.map(dept => ({
            label: dept.name,
            options: batches.filter(b => b.departmentId === dept.id).map(b => ({ label: b.name, value: b.id }))
        }));
    }, [departments, batches]);

    const savedVersions = useMemo(() => {
        if (selectedBatchIds.length === 0) return [];
        return generatedTimetables
            .filter(tt => arrayEquals([...tt.batchIds].sort(), [...selectedBatchIds].sort()))
            .sort((a, b) => b.version - a.version);
    }, [generatedTimetables, selectedBatchIds]);
    
    const selectedTimetableToView = useMemo(() => {
        if (selectedVersionId) return generatedTimetables.find(v => v.id === selectedVersionId);
        return viewedCandidate;
    }, [generatedTimetables, selectedVersionId, viewedCandidate]);

    const calculateConflicts = useCallback((grid: TimetableGrid | undefined) => {
        if (!grid || !settings?.timetableSettings) return new Map();
        const validationContext = { subjects, faculty, rooms, batches, constraints, facultyAllocations, timetableSettings: settings.timetableSettings };
        const checker = new ConflictChecker(validationContext);
        return checker.check(grid);
    }, [subjects, faculty, rooms, batches, constraints, facultyAllocations, settings]);
    
    useEffect(() => {
        if (selectedTimetableToView) {
            const newTimetable = JSON.parse(JSON.stringify(selectedTimetableToView));
            resetEditedTimetable(newTimetable);
            setConflictMap(calculateConflicts(newTimetable.timetable));
        } else {
            resetEditedTimetable(null);
            setConflictMap(new Map());
        }
    }, [selectedTimetableToView, calculateConflicts, resetEditedTimetable]);

    const handleDropAssignment = useCallback((change: DropChange) => {
        if (!editedTimetable) return;

        const newGrid: TimetableGrid = JSON.parse(JSON.stringify(editedTimetable.timetable));
        let changedAssignmentIds: string[] = [];

        if (change.type === 'move') {
            const { assignment, to } = change;
            const batchGrid = newGrid[assignment.batchId];
            if (!batchGrid) return;
            if (batchGrid[assignment.day]?.[assignment.slot]) delete batchGrid[assignment.day][assignment.slot];
            if (!batchGrid[to.day]) batchGrid[to.day] = {};
            batchGrid[to.day][to.slot] = { ...assignment, day: to.day, slot: to.slot };
            changedAssignmentIds = [assignment.id];

        } else if (change.type === 'swap') {
            const { assignment1, assignment2 } = change;
            const batchGrid1 = newGrid[assignment1.batchId];
            const batchGrid2 = newGrid[assignment2.batchId];
            if (!batchGrid1 || !batchGrid2) return;
            batchGrid1[assignment1.day][assignment1.slot] = { ...assignment2, day: assignment1.day, slot: assignment1.slot };
            batchGrid2[assignment2.day][assignment2.slot] = { ...assignment1, day: assignment2.day, slot: assignment2.slot };
            changedAssignmentIds = [assignment1.id, assignment2.id];
        }

        const newConflictMap = calculateConflicts(newGrid);
        const newTimetableState = { ...editedTimetable, timetable: newGrid };
        setEditedTimetable(newTimetableState);
        setConflictMap(newConflictMap);

        const newConflicts = flattenTimetable(newGrid).filter(a => changedAssignmentIds.includes(a.id)).flatMap(a => newConflictMap.get(a.id) || []);
        if (newConflicts.length > 0) toast.error(newConflicts[0].message);

    }, [editedTimetable, calculateConflicts, toast, setEditedTimetable]);

    const handleUpdateDraft = useCallback(async () => {
        if (!editedTimetable || !canUndo) return;
        try {
            await api.updateTimetable(editedTimetable);
            await queryClient.invalidateQueries({ queryKey: ['timetables'] });
            resetEditedTimetable(editedTimetable);
            toast.success('Draft updated successfully.');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update draft.');
        }
    }, [editedTimetable, canUndo, queryClient, toast, resetEditedTimetable]);

    const handleBatchChange = (ids: string[]) => {
        setSelectedBatchIds(ids);
        setCandidates([]);
        setSelectedVersionId(null);
        setViewedCandidate(null);
    };

    const handleGenerate = useCallback(async () => {
        if (selectedBatchIds.length === 0) {
            toast.error('Please select one or more batches.');
            return;
        }
        setIsLoading(true); setCandidates([]); setSelectedVersionId(null); setViewedCandidate(null);
        
        setIsConsoleVisible(true); setConsoleMessages(["[SYSTEM] Starting the AI timetable generator..."]);
        let messageIndex = 0;
        messageIntervalRef.current = window.setInterval(() => {
            setConsoleMessages(prev => [...prev, CONSOLE_MESSAGES[messageIndex % CONSOLE_MESSAGES.length]]);
            messageIndex++;
        }, 1200);

        try {
            const results = await api.runScheduler(selectedBatchIds);
            setCandidates(results); setViewedCandidate(results[0] || null);
            if (results.length > 0) {
                toast.success(`Generated ${results.length} new candidates.`);
                setConsoleMessages(prev => [...prev, `[SUCCESS] All done! Here are your ${results.length} best options.`]);
            } else {
                toast.info('No valid timetables could be generated.');
                setConsoleMessages(prev => [...prev, `[PROBLEM] The AI couldn't find a solution. Your rules might be too strict.`]);
            }
        } catch (error: any) {
            toast.error(error.message || 'Error during generation.');
            setConsoleMessages(prev => [...prev, `[ERROR] An unexpected problem occurred: ${error.message}.`]);
        } finally {
            setIsLoading(false);
            if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
            messageIntervalRef.current = null;
        }
    }, [selectedBatchIds, toast]);

    const handleSaveCandidate = useCallback(async (candidateToSave: GeneratedTimetable) => {
        if (!candidateToSave) return;
        const newVersion = (savedVersions.reduce((max, v) => Math.max(max, v.version), 0) || 0) + 1;
        const newTimetable: GeneratedTimetable = { ...candidateToSave, id: `tt_${selectedBatchIds.join('_')}_v${newVersion}`, version: newVersion, status: 'Draft', comments: [], createdAt: new Date() };

        try {
            await api.saveTimetable(newTimetable);
            await queryClient.invalidateQueries({ queryKey: ['timetables'] });
            setCandidates([]); setSelectedVersionId(newTimetable.id); setViewedCandidate(null);
            toast.success(`Saved as Version ${newVersion}`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to save draft.');
        }
    }, [savedVersions, selectedBatchIds, queryClient, toast]);
    
    const handleUpdateStatus = useCallback(async (status: GeneratedTimetable['status']) => {
        if (!selectedTimetableToView) return;
        try {
            const updatedTimetable = { ...selectedTimetableToView, status };
            await api.updateTimetable(updatedTimetable);
            await queryClient.invalidateQueries({ queryKey: ['timetables'] });
            toast.success(`Timetable status updated to ${status}.`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to update status.');
        }
    }, [selectedTimetableToView, queryClient, toast]);

    const handleAddComment = useCallback(async (comment: string) => {
        if (!comment.trim() || !selectedTimetableToView || !user) return;
        try {
            const newComment = { userId: user.id, userName: user.name, text: comment.trim(), timestamp: new Date().toISOString() };
            const updatedTimetable = { ...selectedTimetableToView, comments: [...(selectedTimetableToView.comments || []), newComment] };
            await api.updateTimetable(updatedTimetable);
            await queryClient.invalidateQueries({ queryKey: ['timetables'] });
            toast.success('Comment added.');
        } catch (error: any) {
            toast.error(error.message || 'Failed to add comment.');
        }
    }, [selectedTimetableToView, user, queryClient, toast]);
    
    const handleFindSubstitute = (assignment: ClassAssignment) => {
        setSubstituteTarget(assignment); setIsSubstituteModalOpen(true);
    };

    const handleCreateSubstitution = async (substitution: Omit<Substitution, 'id' | 'createdAt'>) => {
        try {
            const newSub: Substitution = { ...substitution, id: `sub_${Date.now()}`, createdAt: new Date().toISOString() };
            await api.createSubstitution(newSub);
            await queryClient.invalidateQueries({ queryKey: ['constraints'] });
            toast.success("Substitution created successfully.");
            setIsSubstituteModalOpen(false); setSubstituteTarget(null);
        } catch(e: any) {
            toast.error(e.message || "Failed to create substitution.");
        }
    };

    const handleAICommand = async (command: string) => {
        if (!editedTimetable) return;
        setIsAIProcessing(true); setAISuggestedTimetable(null);
        try {
            const newGrid = await api.applyNLC(editedTimetable.timetable, command);
            setAISuggestedTimetable(newGrid);
        } catch (e: any) {
            toast.error(e.message || "AI command failed.");
        } finally {
            setIsAIProcessing(false);
        }
    };

    const confirmAISuggestion = () => {
        if (aiSuggestedTimetable && editedTimetable) {
            const newTimetableState = { ...editedTimetable, timetable: aiSuggestedTimetable };
            setEditedTimetable(newTimetableState);
            setConflictMap(calculateConflicts(aiSuggestedTimetable));
            setAISuggestedTimetable(null);
            toast.success("AI change applied.");
        }
    };
    
    const handleCompare = async (ids: string[]) => {
        if (ids.length !== 2) return;
        const candidate1 = candidates.find(c => c.id === ids[0]);
        const candidate2 = candidates.find(c => c.id === ids[1]);
        if (!candidate1 || !candidate2) return;
        
        setIsComparing(true); setComparisonResult(null); setIsComparisonModalOpen(true);
        try {
            const result = await api.compareTimetables(candidate1, candidate2);
            setComparisonResult(result.analysis);
        } catch (e: any) {
            toast.error(e.message || "Failed to get AI comparison.");
            setIsComparisonModalOpen(false);
        } finally {
            setIsComparing(false);
        }
    };
    
    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <SchedulerControls
                        selectedBatchIds={selectedBatchIds}
                        onSelectBatches={() => setIsBatchModalOpen(true)}
                        onGenerate={handleGenerate}
                        isLoading={isLoading}
                    />
                     <AICommandBar
                        onCommand={handleAICommand} isProcessing={isAIProcessing}
                        aiSuggestion={aiSuggestedTimetable && editedTimetable ? {
                            summary: diffTimetables(editedTimetable.timetable, aiSuggestedTimetable, subjects, batches),
                            onConfirm: confirmAISuggestion,
                            onDiscard: () => setAISuggestedTimetable(null),
                        } : null}
                        disabled={!editedTimetable || editedTimetable.status !== 'Draft'}
                    />
                    <SchedulerCandidates
                        candidates={candidates}
                        viewedCandidate={viewedCandidate}
                        onViewCandidate={(c) => { setViewedCandidate(c); setSelectedVersionId(null); }}
                        onSaveCandidate={handleSaveCandidate}
                        selectedForComparison={selectedForComparison}
                        onCompareSelection={setSelectedForComparison}
                        onCompare={handleCompare}
                        isComparing={isComparing}
                    />
                    <SchedulerVersions
                        versions={savedVersions}
                        selectedVersionId={selectedVersionId}
                        onSelectVersion={(id) => { setSelectedVersionId(id); setViewedCandidate(null); }}
                        onDeleteVersion={handleDeleteVersion}
                    />
                </div>

                <div className="lg:col-span-3 space-y-6">
                    {selectedTimetableToView && editedTimetable ? (
                        <>
                            <GlassPanel className="p-4">
                                <SchedulerViewHeader 
                                    timetable={editedTimetable}
                                    canUndo={canUndo} canRedo={canRedo}
                                    onUndo={undo} onRedo={redo} onUpdateDraft={handleUpdateDraft}
                                />
                                 <div className="space-y-8 mt-4">
                                    {editedTimetable.batchIds.map(batchId => {
                                        const batch = batches.find(b => b.id === batchId);
                                        if (!batch) return null;
                                        return (
                                            <div key={batchId}>
                                                <h4 className="text-lg font-bold text-white mb-2">{batch.name}</h4>
                                                <TimetableView
                                                    timetableData={{ ...editedTimetable, timetable: editedTimetable.timetable[batchId] || {} }}
                                                    isEditable={editedTimetable.status === 'Draft'}
                                                    onDropAssignment={handleDropAssignment}
                                                    onFindSubstitute={editedTimetable.status === 'Approved' ? handleFindSubstitute : undefined}
                                                    conflictMap={conflictMap}
                                                    substitutions={constraints.substitutions}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </GlassPanel>
                            {selectedVersionId && <SchedulerActions timetable={editedTimetable} user={user} onUpdateStatus={handleUpdateStatus} onAddComment={handleAddComment} />}
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

            {/* Modals and Overlays */}
            <BatchSelectorModal isOpen={isBatchModalOpen} onClose={() => setIsBatchModalOpen(false)} onConfirm={(ids) => { handleBatchChange(ids); setIsBatchModalOpen(false); }} groupedOptions={batchOptions} initialSelected={selectedBatchIds}/>
            {substituteTarget && editedTimetable && <SubstituteModal isOpen={isSubstituteModalOpen} onClose={() => setIsSubstituteModalOpen(false)} onConfirm={handleCreateSubstitution} targetAssignment={substituteTarget} currentTimetableGrid={editedTimetable.timetable}/>}
            <AIEngineConsole isVisible={isConsoleVisible} onClose={() => setIsConsoleVisible(false)} messages={consoleMessages} isLoading={isLoading}/>
            <AIComparisonModal isOpen={isComparisonModalOpen} onClose={() => setIsComparisonModalOpen(false)} analysis={comparisonResult} isLoading={isComparing}/>
        </>
    );
};

export default Scheduler;

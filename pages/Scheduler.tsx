import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { GlassButton } from '../components/GlassButton';
import { BatchSelectorModal } from '../components/BatchSelectorModal';
import { SubstituteModal } from '../components/SubstituteModal';
import { useAppContext } from '../hooks/useAppContext';
import { useToast } from '../hooks/useToast';
import { useUndoRedo } from '../hooks/useUndoRedo';
import * as api from '../services';
import type { Batch, GeneratedTimetable, TimetableGrid, DropChange, Conflict, ClassAssignment, SingleBatchTimetableGrid, Substitution } from '../types';
import { Zap, Save, Printer, Calendar, Send, Check, X, Loader2, ChevronDown, Bot, Undo2, Redo2 } from 'lucide-react';
import { TimetableView } from '../components/TimetableView';
import { exportTimetableToPdf, exportTimetableToIcs } from '../utils/export';
import { checkConflicts } from '../core/conflictChecker';
import { AIEngineConsole } from '../components/AIEngineConsole';
import { AICommandBar } from '../components/AICommandBar';
import { AIComparisonModal } from '../components/AIComparisonModal';
import { cn } from '../utils/cn';
import { useQuery } from '@tanstack/react-query';

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


const CONSOLE_MESSAGES = [
    "[INIT] Initializing scheduling engine...",
    "[CONFIG] Loading institutional constraints and settings...",
    "[GEMINI_QUERY] Requesting dynamic hyper-heuristic strategy from Gemini API...",
    "[STRATEGY] Received multi-phase evolutionary strategy. Applying to current run.",
    "[POP_GEN] Generating initial population of timetable chromosomes...",
    "[FITNESS_CALC] Evaluating fitness of initial population against soft constraints...",
    "[EVOLUTION] Beginning evolutionary cycle: Selection, Crossover, Mutation.",
    "[CROSSOVER] Applying day-wise crossover to promising parent solutions.",
    "[MUTATION] Executing swap and move mutations to explore solution space.",
    "[STAGNATION_DETECT] Monitoring fitness score for local optima stagnation.",
    "[INTERVENTION] Stagnation detected. Querying Gemini for a creative intervention swap.",
    "[REPAIR] Applying greedy repair heuristic to ensure hard constraint validity.",
    "[REFINEMENT] Executing simulated annealing for fine-grained optimization.",
    "[ANALYSIS] Performing final validation on elite candidates...",
    "[SYNTHESIS] Synthesizing and ranking top 5 distinct timetable solutions...",
];

const Scheduler: React.FC = () => {
    const { user, refreshAllData: refreshData, timeSlots } = useAppContext();
    const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [candidates, setCandidates] = useState<GeneratedTimetable[]>([]);
    const [viewedCandidate, setViewedCandidate] = useState<GeneratedTimetable | null>(null);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [comment, setComment] = useState('');
    
    // NEW: Use useUndoRedo for timetable state management
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
    
    // State for AI comparison feature
    const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
    const [isComparing, setIsComparing] = useState(false);
    const [comparisonResult, setComparisonResult] = useState<string | null>(null);
    const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
    
    const toast = useToast();
    
    const { data: batches = [] } = useQuery({ queryKey: ['batches'], queryFn: api.getBatches });
    const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: api.getDepartments });
    const { data: generatedTimetables = [] } = useQuery({ queryKey: ['timetables'], queryFn: api.getTimetables });
    const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: api.getSubjects });
    const { data: faculty = [] } = useQuery({ queryKey: ['faculty'], queryFn: api.getFaculty });
    const { data: rooms = [] } = useQuery({ queryKey: ['rooms'], queryFn: api.getRooms });
    const { data: constraints = { substitutions: [] } } = useQuery({ queryKey: ['constraints'], queryFn: api.getConstraints });

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
    
    const selectedTimetableToView = useMemo(() => {
        if (selectedVersionId) return generatedTimetables.find(v => v.id === selectedVersionId);
        return viewedCandidate;
    }, [generatedTimetables, selectedVersionId, viewedCandidate]);

    const calculateConflicts = useCallback((grid: TimetableGrid | undefined, currentTimetableId: string) => {
        if (!grid) return new Map();
        
        const draftAssignments = flattenTimetable(grid);
        
        const approvedAssignments = generatedTimetables
            .filter(tt => tt.status === 'Approved' && tt.id !== currentTimetableId)
            .flatMap(tt => flattenTimetable(tt.timetable));
            
        const substitutionAssignments: ClassAssignment[] = (constraints.substitutions || []).map(sub => ({
            id: sub.id,
            subjectId: sub.substituteSubjectId,
            facultyIds: [sub.substituteFacultyId],
            roomId: sub.roomId, // Use roomId from the self-contained substitution record
            batchId: sub.batchId,
            day: sub.day,
            slot: sub.slot,
        }));
            
        return checkConflicts(draftAssignments, faculty, rooms, subjects, batches, [...approvedAssignments, ...substitutionAssignments]);
    }, [generatedTimetables, faculty, rooms, subjects, batches, constraints.substitutions]);
    
    useEffect(() => {
        if (selectedTimetableToView) {
            // Reset the history with the new timetable
            resetEditedTimetable(JSON.parse(JSON.stringify(selectedTimetableToView)));
            setConflictMap(calculateConflicts(selectedTimetableToView.timetable, selectedTimetableToView.id));
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
        
        // Push the new state to the undo/redo history
        setEditedTimetable({ ...editedTimetable, timetable: newGrid });
        setConflictMap(newConflictMap);
    }, [editedTimetable, calculateConflicts, toast, setEditedTimetable]);

    const handleUpdateDraft = useCallback(async () => {
        if (!editedTimetable || !canUndo) return;
        try {
            await api.updateTimetable(editedTimetable);
            await refreshData();
            // After saving, reset the history to make the current state the new baseline
            resetEditedTimetable(editedTimetable);
            toast.success('Draft updated successfully.');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update draft.');
        }
    }, [editedTimetable, canUndo, refreshData, toast, resetEditedTimetable]);

    const handleBatchChange = (ids: string[]) => {
        setSelectedBatchIds(ids);
        setCandidates([]);
        setSelectedVersionId(null);
        setViewedCandidate(null);
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
        setViewedCandidate(null);
        
        setIsConsoleVisible(true);
        setConsoleMessages(["[SYS] Initiating AI timetable generation sequence..."]);

        let messageIndex = 0;
        messageIntervalRef.current = window.setInterval(() => {
            setConsoleMessages(prev => [...prev, CONSOLE_MESSAGES[messageIndex % CONSOLE_MESSAGES.length]]);
            messageIndex++;
        }, 1200);

        try {
            const results = await api.runScheduler(selectedBatchIds);
            setCandidates(results);
            setViewedCandidate(results[0] || null);
            if (results.length > 0) {
                toast.success(`Generated ${results.length} new candidates.`);
                setConsoleMessages(prev => [...prev, `[SUCCESS] ${results.length} optimal candidates generated. Process complete.`]);
            } else {
                toast.info('No valid timetables could be generated.');
                setConsoleMessages(prev => [...prev, `[WARN] AI could not find a valid solution. Suggest adjusting constraints or input data.`]);
            }
        } catch (error: any) {
            toast.error(error.message || 'Error during generation.');
            setConsoleMessages(prev => [...prev, `[ERROR] System fault: ${error.message}. Please review system logs.`]);
        } finally {
            setIsLoading(false);
            if (messageIntervalRef.current) {
                clearInterval(messageIntervalRef.current);
                messageIntervalRef.current = null;
            }
        }
    }, [selectedBatchIds, toast]);

    const handleSaveCandidate = useCallback(async (candidateToSave: GeneratedTimetable) => {
        if (!candidateToSave) return;

        const newVersion = (savedVersions.reduce((max, v) => Math.max(max, v.version), 0) || 0) + 1;
        const newTimetable: GeneratedTimetable = {
            ...candidateToSave,
            id: `tt_${selectedBatchIds.join('_')}_v${newVersion}`,
            version: newVersion,
            status: 'Draft',
            comments: [],
            // FIX: Changed to a Date object to match the type definition.
            createdAt: new Date(),
        };

        try {
            await api.saveTimetable(newTimetable);
            await refreshData();
            setCandidates([]);
            setSelectedVersionId(newTimetable.id);
            setViewedCandidate(null);
            toast.success(`Saved as Version ${newVersion}`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to save draft.');
        }
    }, [savedVersions, selectedBatchIds, refreshData, toast]);
    
    const handleUpdateStatus = useCallback(async (status: GeneratedTimetable['status']) => {
        if (!selectedTimetableToView) return;
        try {
            const updatedTimetable = { ...selectedTimetableToView, status };
            await api.updateTimetable(updatedTimetable);
            await refreshData();
            toast.success(`Timetable status updated to ${status}.`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to update status.');
        }
    }, [selectedTimetableToView, refreshData, toast]);

    const handleAddComment = useCallback(async () => {
        if (!comment.trim() || !selectedTimetableToView || !user) return;
        try {
            const newComment = {
                userId: user.id,
                userName: user.name,
                text: comment.trim(),
                timestamp: new Date().toISOString(),
            };
            const updatedTimetable = { 
                ...selectedTimetableToView,
                comments: [...(selectedTimetableToView.comments || []), newComment],
            };
            await api.updateTimetable(updatedTimetable);
            await refreshData();
            setComment('');
            toast.success('Comment added.');
        } catch (error: any) {
            toast.error(error.message || 'Failed to add comment.');
        }
    }, [comment, selectedTimetableToView, user, refreshData, toast]);
    
    const handleFindSubstitute = (assignment: ClassAssignment) => {
        setSubstituteTarget(assignment);
        setIsSubstituteModalOpen(true);
    };

    const handleCreateSubstitution = async (substitution: Omit<Substitution, 'id' | 'createdAt'>) => {
        try {
            const newSub: Substitution = {
                ...substitution,
                id: `sub_${Date.now()}`,
                createdAt: new Date().toISOString(),
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

    const handleAICommand = async (command: string) => {
        if (!editedTimetable) return;
        setIsAIProcessing(true);
        setAISuggestedTimetable(null);
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
            setEditedTimetable({ ...editedTimetable, timetable: aiSuggestedTimetable });
            setConflictMap(calculateConflicts(aiSuggestedTimetable, editedTimetable.id));
            setAISuggestedTimetable(null);
            toast.success("AI change applied.");
        }
    };
    
    const handleCompareSelection = (candidateId: string) => {
        setSelectedForComparison(prev => {
            if (prev.includes(candidateId)) {
                return prev.filter(id => id !== candidateId);
            }
            if (prev.length < 2) {
                return [...prev, candidateId];
            }
            // If already 2 selected, replace the last one
            return [prev[0], candidateId];
        });
    };
    
    const handleCompare = async () => {
        if (selectedForComparison.length !== 2) return;
        
        const candidate1 = candidates.find(c => c.id === selectedForComparison[0]);
        const candidate2 = candidates.find(c => c.id === selectedForComparison[1]);

        if (!candidate1 || !candidate2) return;
        
        setIsComparing(true);
        setComparisonResult(null);
        setIsComparisonModalOpen(true);

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


    const canSubmit = user?.role === 'DepartmentHead' || user?.role === 'TimetableManager' || user?.role === 'SuperAdmin';
    const canApprove = user?.role === 'TimetableManager' || user?.role === 'SuperAdmin';
    
    const firstBatchForExport = batches.find(b => b.id === selectedTimetableToView?.batchIds[0]);

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
                        </div>
                    </GlassPanel>

                     <AICommandBar
                        onCommand={handleAICommand}
                        isProcessing={isAIProcessing}
                        aiSuggestion={aiSuggestedTimetable && editedTimetable ? {
                            summary: diffTimetables(editedTimetable.timetable, aiSuggestedTimetable, subjects, batches),
                            onConfirm: confirmAISuggestion,
                            onDiscard: () => setAISuggestedTimetable(null),
                        } : null}
                        disabled={!editedTimetable || editedTimetable.status !== 'Draft'}
                    />

                    {candidates.length > 0 && (
                        <GlassPanel className="p-4">
                             <div className="flex justify-between items-center mb-2">
                                <h2 className="text-lg font-bold">New Candidates</h2>
                                <GlassButton 
                                    icon={Bot} 
                                    variant="secondary" 
                                    className="text-xs py-1 px-2"
                                    disabled={selectedForComparison.length !== 2 || isComparing}
                                    onClick={handleCompare}
                                >
                                    {isComparing ? 'Analyzing...' : 'Compare with AI'}
                                </GlassButton>
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                               {candidates.map((cand, i) => (
                                   <div key={cand.id} className={cn('p-3 rounded-lg border transition-colors', viewedCandidate?.id === cand.id ? 'bg-accent/20 border-accent/30' : 'bg-panel/50 border-transparent')}>
                                        <div className="flex items-start gap-3">
                                            <input 
                                                type="checkbox"
                                                className="mt-1 h-4 w-4 rounded border-[var(--border)] text-accent focus:ring-accent accent-accent bg-panel"
                                                checked={selectedForComparison.includes(cand.id)}
                                                onChange={() => handleCompareSelection(cand.id)}
                                            />
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
                                                 <GlassButton variant="secondary" className="text-xs py-1 px-2" onClick={() => { setViewedCandidate(cand); setSelectedVersionId(null); }}>View</GlassButton>
                                                 <GlassButton variant="secondary" className="text-xs py-1 px-2" onClick={() => handleSaveCandidate(cand)}>Save</GlassButton>
                                            </div>
                                        </div>
                                   </div>
                               ))}
                            </div>
                        </GlassPanel>
                    )}

                    <GlassPanel className="p-4">
                        <h2 className="text-lg font-bold mb-4">Saved Versions</h2>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {selectedBatchIds.length > 0 && savedVersions.length > 0 ? savedVersions.map(v => (
                                <button key={v.id} onClick={() => { setSelectedVersionId(v.id); setViewedCandidate(null); }} 
                                    className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedVersionId === v.id ? 'bg-[var(--accent)]/20 border-[var(--accent)]/30' : 'bg-panel-strong border-transparent hover:border-[var(--border)]'}`}>
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
                    {selectedTimetableToView && editedTimetable ? (
                        <>
                            <GlassPanel className="p-4">
                                <div className="border-b border-[var(--border)] pb-4 mb-4 flex flex-wrap justify-between items-center gap-4">
                                    <div>
                                         <h3 className="text-xl font-bold text-white">
                                             {selectedTimetableToView.version ? `Version ${selectedTimetableToView.version}` : `Candidate ${candidates.findIndex(c=>c.id === selectedTimetableToView.id) + 1}`}
                                         </h3>
                                         <div className="flex items-center gap-2">
                                            <p className="text-sm text-text-muted">Status: <span className={`font-semibold ${statusColors[selectedTimetableToView.status]}`}>{selectedTimetableToView.status}</span></p>
                                            {canUndo && selectedTimetableToView.status === 'Draft' && (
                                                <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/10 text-orange-400 font-semibold animate-pulse">Unsaved Changes</span>
                                            )}
                                         </div>
                                     </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {selectedTimetableToView.version ? (
                                             <>
                                                <GlassButton variant="secondary" icon={Printer} onClick={() => exportTimetableToPdf(selectedTimetableToView, subjects, faculty, rooms, timeSlots, batches)}>PDF</GlassButton>
                                                {firstBatchForExport && <GlassButton variant="secondary" icon={Calendar} onClick={() => exportTimetableToIcs(selectedTimetableToView, firstBatchForExport, subjects, faculty, rooms, timeSlots)}>ICS</GlassButton>}
                                             </>
                                        ) : null}
                                        {editedTimetable.status === 'Draft' && (
                                            <>
                                                <GlassButton variant="secondary" icon={Undo2} onClick={undo} disabled={!canUndo}>Undo</GlassButton>
                                                <GlassButton variant="secondary" icon={Redo2} onClick={redo} disabled={!canRedo}>Redo</GlassButton>
                                                <GlassButton icon={Save} onClick={handleUpdateDraft} disabled={!canUndo}>Save Changes</GlassButton>
                                            </>
                                        )}
                                    </div>
                                </div>
                                 <div className="space-y-8">
                                    {editedTimetable.batchIds.map(batchId => {
                                        const batch = batches.find(b => b.id === batchId);
                                        if (!batch) return null;

                                        const singleBatchGrid = editedTimetable.timetable[batchId] || {};
                                        
                                        const singleBatchTimetable = {
                                            ...editedTimetable,
                                            id: `${editedTimetable.id}_${batchId}`,
                                            batchIds: [batchId],
                                            timetable: singleBatchGrid,
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
                                                    disabled={selectedTimetableToView.status !== 'Draft' || canUndo} 
                                                    className="w-full"
                                                    title={canUndo ? "Please save your changes before submitting." : "Submit for final review"}
                                                >
                                                    Submit for Review
                                                </GlassButton>
                                            )}
                                            {canApprove && (
                                                <div className="flex gap-2">
                                                    <GlassButton onClick={() => handleUpdateStatus('Approved')} disabled={selectedTimetableToView.status !== 'Submitted'} icon={Check} className="w-full">Approve</GlassButton>
                                                    <GlassButton onClick={() => handleUpdateStatus('Rejected')} disabled={selectedTimetableToView.status !== 'Submitted'} icon={X} variant="secondary" className="w-full hover:bg-red-500/20 hover:text-red-400">Reject</GlassButton>
                                                </div>
                                            )}
                                            {!canSubmit && <p className="text-sm text-text-muted text-center py-2">You do not have permission to perform actions.</p>}
                                        </div>
                                    </GlassPanel>
                                    <GlassPanel className="p-4 flex flex-col">
                                        <h3 className="text-lg font-bold mb-4">Comments</h3>
                                        <div className="space-y-3 max-h-48 overflow-y-auto mb-4 pr-2 flex-1">
                                            {selectedTimetableToView.comments?.length > 0 ? selectedTimetableToView.comments.map((c, i) => (
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
            <AIEngineConsole 
                isVisible={isConsoleVisible}
                onClose={() => setIsConsoleVisible(false)}
                messages={consoleMessages}
                isLoading={isLoading}
            />
             <AIComparisonModal
                isOpen={isComparisonModalOpen}
                onClose={() => setIsComparisonModalOpen(false)}
                analysis={comparisonResult}
                isLoading={isComparing}
            />
        </>
    );
};

export default Scheduler;
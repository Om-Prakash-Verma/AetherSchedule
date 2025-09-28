import React, { useState, useEffect, useMemo } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { TimetableView } from '../components/TimetableView';
import { useAppContext } from '../hooks/useAppContext';
import { useToast } from '../hooks/useToast';
import type { GeneratedTimetable, SingleBatchTimetableGrid, ClassAssignment, TimetableFeedback, Substitution } from '../types';
import { Star } from 'lucide-react';
import * as api from '../services';

const TimetableFeedbackComponent: React.FC<{ timetable: GeneratedTimetable }> = ({ timetable }) => {
    const { user, refreshData } = useAppContext();
    const [hoverRating, setHoverRating] = useState(0);
    const toast = useToast();

    if (!user || user.role !== 'Faculty' || !user.facultyId) {
        return null;
    }
    
    const existingFeedback = timetable.feedback?.find(f => f.facultyId === user.facultyId);
    const currentRating = existingFeedback?.rating || 0;

    const handleRatingSubmit = async (rating: number) => {
        if (!user.facultyId) return;
        try {
            const feedbackData: Omit<TimetableFeedback, 'id' | 'createdAt'> = {
                timetableId: timetable.id,
                facultyId: user.facultyId,
                rating,
            };
            // This needs a new API endpoint, let's assume one exists for now.
            await api.saveTimetableFeedback(feedbackData);
            await refreshData();
            toast.success('Thank you for your feedback!');
        } catch(e: any) {
            toast.error(e.message || 'Failed to submit feedback.');
        }
    };

    return (
        <GlassPanel className="p-4 mt-6">
            <h3 className="text-lg font-bold text-white mb-2">Rate This Schedule</h3>
            <p className="text-sm text-text-muted mb-4">Your feedback helps the AI create better timetables in the future.</p>
            <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                    <button 
                        key={star}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => handleRatingSubmit(star)}
                        className="transition-transform duration-200 hover:scale-125"
                    >
                        <Star 
                            size={28}
                            className={`
                                ${(hoverRating || currentRating) >= star ? 'text-yellow-400 fill-yellow-400' : 'text-text-muted'}
                            `}
                        />
                    </button>
                ))}
            </div>
            {currentRating > 0 && <p className="text-xs text-[var(--accent)] mt-2">You rated this schedule {currentRating} out of 5 stars.</p>}
        </GlassPanel>
    );
};


const MyTimetable: React.FC = () => {
    const { 
        user, generatedTimetables, batches, faculty, constraints,
        fetchTimetables, fetchBatches, fetchFaculty, fetchConstraints
    } = useAppContext();

    useEffect(() => {
        fetchTimetables();
        fetchBatches();
        fetchFaculty();
        fetchConstraints(); // Fetches substitutions as well
    }, [fetchTimetables, fetchBatches, fetchFaculty, fetchConstraints]);

    const userDisplayTimetable = useMemo(() => {
        const today = new Date();
        const approvedTimetables = generatedTimetables.filter(tt => tt.status === 'Approved');
        if (approvedTimetables.length === 0) return null;

        const allApprovedAssignments = approvedTimetables.flatMap(tt => 
            Object.values(tt.timetable).flatMap(batchGrid => 
                Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
            )
        );

        const activeSubstitutions = constraints.substitutions.filter(sub => 
            new Date(today) >= new Date(sub.startDate) && new Date(today) <= new Date(sub.endDate)
        );

        // --- STUDENT LOGIC ---
        if (user?.role === 'Student' && user.batchId) {
            const userBatch = batches.find(b => b.id === user.batchId);
            if (!userBatch) return null;
            
            const multiBatchTimetable = approvedTimetables.find(tt => tt.batchIds.includes(user.batchId!));
            if (!multiBatchTimetable) return null;

            return {
                ...multiBatchTimetable,
                batchIds: [user.batchId],
                timetable: multiBatchTimetable.timetable[user.batchId] || {},
                title: `${userBatch.name} - Timetable`,
            };
        }

        // --- FACULTY LOGIC (UPGRADED FOR MULTI-TEACHER COMPATIBILITY) ---
        if (user?.role === 'Faculty' && user.facultyId) {
            const facultyProfile = faculty.find(f => f.id === user.facultyId);
            if (!facultyProfile) return null;
            
            const originalAssignments = allApprovedAssignments.filter(a => a.facultyIds.includes(facultyProfile.id));
            const substitutedOriginalIds = new Set(activeSubstitutions.filter(sub => sub.originalFacultyId === facultyProfile.id).map(sub => sub.originalAssignmentId));
            const finalOwnAssignments = originalAssignments.filter(a => !substitutedOriginalIds.has(a.id));

            // CRITICAL FIX: Re-engineered this logic to be more robust.
            // It now explicitly constructs a new, valid ClassAssignment for each substitution,
            // preventing crashes from malformed or missing original assignment data.
            const substituteAssignments: ClassAssignment[] = activeSubstitutions
                .filter(sub => sub.substituteFacultyId === facultyProfile.id)
                .map(sub => {
                    const originalAssignment = allApprovedAssignments.find(a => a.id === sub.originalAssignmentId);
                    if (!originalAssignment || !originalAssignment.roomId) {
                        console.warn(`Could not create substitution view for sub ID ${sub.id}: Original assignment or its room not found.`);
                        return null;
                    }

                    const newAssignment: ClassAssignment = {
                        id: sub.id,
                        subjectId: sub.substituteSubjectId,
                        facultyIds: [sub.substituteFacultyId],
                        roomId: originalAssignment.roomId,
                        batchId: sub.batchId,
                        day: sub.day,
                        slot: sub.slot,
                    };
                    return newAssignment;
                })
                .filter((a): a is ClassAssignment => a !== null);


            const allFinalAssignments = [...finalOwnAssignments, ...substituteAssignments];
            const facultyTimetableGrid: SingleBatchTimetableGrid = {};
            const facultyBatchIds = new Set<string>();

            for (const assignment of allFinalAssignments) {
                if (!facultyTimetableGrid[assignment.day]) facultyTimetableGrid[assignment.day] = {};
                facultyTimetableGrid[assignment.day][assignment.slot] = assignment;
                facultyBatchIds.add(assignment.batchId);
            }
            
            const relevantTimetableShell = 
                approvedTimetables.find(tt => tt.batchIds.some(bId => facultyBatchIds.has(bId))) 
                || approvedTimetables[0];

            // FIX: Add a null-safety check to prevent a crash if no relevant timetables exist.
            if (!relevantTimetableShell) return null;

            return {
                ...relevantTimetableShell,
                id: `${relevantTimetableShell.id}_fac_${facultyProfile.id}`,
                batchIds: Array.from(facultyBatchIds),
                timetable: facultyTimetableGrid,
                title: "My Timetable",
            };
        }

        return null;
    }, [user, generatedTimetables, batches, faculty, constraints.substitutions]);
    

    return (
        <div className="space-y-6">
            <GlassPanel className="p-6">
                <h2 className="text-2xl font-bold text-white">{userDisplayTimetable?.title || "My Timetable"}</h2>
                <p className="text-text-muted">Showing the currently approved and published schedule for today, including any substitutions.</p>
            </GlassPanel>
            
            <GlassPanel className="p-2 sm:p-4">
                {userDisplayTimetable ? (
                    <TimetableView 
                        timetableData={userDisplayTimetable} 
                        isEditable={false} 
                        conflictMap={new Map()}
                        substitutions={constraints.substitutions}
                        viewDate={new Date()}
                    />
                ) : (
                    <div className="text-center py-20">
                        <p className="text-lg text-white">No approved timetable is available for you at the moment.</p>
                        <p className="text-text-muted">Please check back later or contact your department head.</p>
                    </div>
                )}
            </GlassPanel>

            {userDisplayTimetable && user?.role === 'Faculty' && (
                <TimetableFeedbackComponent timetable={userDisplayTimetable} />
            )}
        </div>
    );
};

export default MyTimetable;
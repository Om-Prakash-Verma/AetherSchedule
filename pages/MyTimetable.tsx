import React, { useState, useEffect } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { TimetableView } from '../components/TimetableView';
import { useAppContext } from '../hooks/useAppContext';
import { useToast } from '../hooks/useToast';
import type { GeneratedTimetable, SingleBatchTimetableGrid, ClassAssignment, TimetableFeedback } from '../types';
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
        user, generatedTimetables, batches, faculty, 
        fetchTimetables, fetchBatches, fetchFaculty 
    } = useAppContext();

    useEffect(() => {
        fetchTimetables();
        fetchBatches();
        fetchFaculty();
    }, [fetchTimetables, fetchBatches, fetchFaculty]);


    let userDisplayTimetable: any | null = null;
    let title = "My Timetable";

    if (user?.role === 'Student' && user.batchId) {
        const userBatch = batches.find(b => b.id === user.batchId);
        if (userBatch) {
            title = `${userBatch.name} - Timetable`;
            const multiBatchTimetable = generatedTimetables.find(tt => tt.batchIds.includes(user.batchId!) && tt.status === 'Approved') || null;

            if (multiBatchTimetable) {
                const singleBatchGrid = multiBatchTimetable.timetable[user.batchId] || {};
                
                userDisplayTimetable = {
                    ...multiBatchTimetable,
                    batchIds: [user.batchId],
                    timetable: singleBatchGrid,
                };
            }
        }
    } else if (user?.role === 'Faculty') {
        const facultyProfile = faculty.find(f => f.userId === user.id || f.id === user.facultyId);
        
        if (facultyProfile) {
            const facultyAssignments: ClassAssignment[] = [];
            
            const relevantTimetable = generatedTimetables.find(tt => 
                tt.status === 'Approved' &&
                // FIX: Explicitly type parameters to help TypeScript inference with nested Object.values.
                Object.values(tt.timetable).some((batchGrid: SingleBatchTimetableGrid) => 
                    Object.values(batchGrid).some((daySlots: Record<number, ClassAssignment>) =>
                        Object.values(daySlots).some((assignment: ClassAssignment) => assignment.facultyId === facultyProfile.id)
                    )
                )
            );
            
            if (relevantTimetable) {
                const facultyTimetableGrid: SingleBatchTimetableGrid = {};
                // FIX: Explicitly type parameters to help TypeScript inference with nested Object.values.
                Object.values(relevantTimetable.timetable).forEach((batchGrid: SingleBatchTimetableGrid) => {
                    Object.values(batchGrid).forEach((daySlots: Record<number, ClassAssignment>) => {
                        Object.values(daySlots).forEach((assignment: ClassAssignment) => {
                            if (assignment.facultyId === facultyProfile.id) {
                                if (!facultyTimetableGrid[assignment.day]) {
                                    facultyTimetableGrid[assignment.day] = {};
                                }
                                facultyTimetableGrid[assignment.day][assignment.slot] = assignment;
                                facultyAssignments.push(assignment);
                            }
                        });
                    });
                });

                 userDisplayTimetable = {
                    ...relevantTimetable,
                    id: relevantTimetable.id,
                    batchIds: [...new Set(facultyAssignments.map(a => a.batchId))],
                    timetable: facultyTimetableGrid,
                };
            }
        }
    }
    

    return (
        <div className="space-y-6">
            <GlassPanel className="p-6">
                <h2 className="text-2xl font-bold text-white">{title}</h2>
                <p className="text-text-muted">Showing the currently approved and published schedule.</p>
            </GlassPanel>
            
            <GlassPanel className="p-2 sm:p-4">
                {userDisplayTimetable ? (
                    <TimetableView timetableData={userDisplayTimetable} isEditable={false} conflictMap={new Map()} />
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

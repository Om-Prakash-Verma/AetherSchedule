



import React, { useMemo, useState } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { TimetableView } from '../components/TimetableView';
import { useAppContext } from '../hooks/useAppContext';
import type { GeneratedTimetable, SingleBatchTimetableGrid, ClassAssignment } from '../types';
import { Calendar } from 'lucide-react';
import { GlassButton } from '../components/GlassButton';
import { useQuery } from '@tanstack/react-query';
import * as api from '../services';

const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
}

const MyTimetable: React.FC = () => {
    const { user } = useAppContext();
    const [viewDate, setViewDate] = useState(new Date());

    const { data: generatedTimetables = [] } = useQuery({ queryKey: ['timetables'], queryFn: api.getTimetables });
    // FIX: Provide a complete initialData object to match the Constraints type.
    const { data: constraints } = useQuery({ queryKey: ['constraints'], queryFn: api.getConstraints, initialData: { substitutions: [], pinnedAssignments: [], plannedLeaves: [], facultyAvailability: [] } });

    const userTimetable: GeneratedTimetable | null = useMemo(() => {
        if (!user || generatedTimetables.length === 0) return null;

        const approvedTimetables = generatedTimetables.filter(tt => tt.status === 'Approved');
        if (approvedTimetables.length === 0) return null;

        if (user.role === 'Student' && user.batchId) {
            return approvedTimetables.find(tt => tt.batchIds.includes(user.batchId!)) || null;
        }

        if (user.role === 'Faculty' && user.facultyId) {
             const personalTimetable: GeneratedTimetable = {
                id: `faculty_${user.facultyId}_timetable`,
                batchIds: [], // Not applicable for a faculty view
                version: 0,
                status: 'Approved',
                comments: [],
                // FIX: Changed createdAt to a Date object to match the type definition.
                createdAt: new Date(),
                metrics: { score: 0, hardConflicts: 0, studentGaps: 0, facultyGaps: 0, facultyWorkloadDistribution: 0, preferenceViolations: 0 },
                timetable: {},
            };

            const userAssignments: ClassAssignment[] = [];
            approvedTimetables.forEach(tt => {
                Object.values(tt.timetable).forEach(batchGrid => {
                    Object.values(batchGrid).forEach(daySlots => {
                        Object.values(daySlots).forEach(assignment => {
                            const classAssignment = assignment as ClassAssignment;
                            if (classAssignment.facultyIds.includes(user.facultyId!)) {
                                userAssignments.push(classAssignment);
                            }
                        });
                    });
                });
            });

            const grid: SingleBatchTimetableGrid = {};
            userAssignments.forEach(a => {
                if (!grid[a.day]) grid[a.day] = {};
                grid[a.day][a.slot] = a;
            });
            personalTimetable.timetable = { 'faculty_view': grid }; // Wrap in a master grid structure
            return personalTimetable;
        }

        return null;
    }, [user, generatedTimetables]);
    
    const displayGrid = useMemo(() => {
        if (!userTimetable) return {};
        if (user?.role === 'Student' && user.batchId) {
            return userTimetable.timetable[user.batchId] || {};
        }
        if (user?.role === 'Faculty') {
            return userTimetable.timetable['faculty_view'] || {};
        }
        return {};
    }, [user, userTimetable]);


    const handleDateChange = (daysToAdd: number) => {
        const newDate = new Date(viewDate);
        newDate.setDate(newDate.getDate() + daysToAdd);
        setViewDate(newDate);
    }
    
    const weekStart = getWeekStart(viewDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 4);

    return (
        <div className="space-y-6">
            <GlassPanel className="p-6">
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white">My Timetable</h2>
                        <p className="text-text-muted">Your personalized weekly schedule.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <GlassButton variant="secondary" onClick={() => handleDateChange(-7)}>Prev Week</GlassButton>
                        <span className="text-sm font-semibold text-white w-52 text-center">
                            {weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        <GlassButton variant="secondary" onClick={() => handleDateChange(7)}>Next Week</GlassButton>
                    </div>
                </div>
            </GlassPanel>

            {userTimetable ? (
                 <GlassPanel className="p-4 sm:p-6">
                    <TimetableView
                        timetableData={{ ...userTimetable, timetable: displayGrid as SingleBatchTimetableGrid }}
                        isEditable={false}
                        conflictMap={new Map()}
                        substitutions={constraints.substitutions}
                        viewDate={viewDate}
                    />
                 </GlassPanel>
            ) : (
                <GlassPanel className="p-6 text-center h-96 flex flex-col items-center justify-center">
                    <Calendar size={48} className="text-text-muted mb-4"/>
                    <h3 className="text-xl font-bold text-white">No Timetable Found</h3>
                    <p className="text-text-muted mt-2">
                        An approved timetable for your {user?.role === 'Student' ? 'batch' : 'profile'} is not yet available.
                    </p>
                </GlassPanel>
            )}
        </div>
    );
};

export default MyTimetable;
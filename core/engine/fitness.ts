import type { TimetableGrid, TimetableMetrics, Batch, Faculty, GlobalConstraints } from '../../types';
import { flattenTimetable } from './helpers';

// --- FITNESS FUNCTION (UPGRADED for multi-teacher classes) ---
export const calculateMetrics = (timetable: TimetableGrid, batches: Batch[], allFaculty: Faculty[], globalConstraints: GlobalConstraints): TimetableMetrics => {
    let studentGaps = 0;
    let facultyGaps = 0;
    let preferenceViolations = 0;

    // Student Gaps
    for (const batchId in timetable) {
        const batchGrid = timetable[batchId];
        for (let day = 0; day < 6; day++) {
            const daySlots = batchGrid[day] ? Object.keys(batchGrid[day]).map(Number).sort((a,b)=>a-b) : [];
            if (daySlots.length > 1) {
                for (let i = 0; i < daySlots.length - 1; i++) {
                    studentGaps += (daySlots[i+1] - daySlots[i] - 1);
                }
            }
        }
    }

    // Faculty Gaps & Workload
    const facultyWorkload: Record<string, number> = {};
    const allAssignments = flattenTimetable(timetable);
    for(const facultyMember of allFaculty) {
        facultyWorkload[facultyMember.id] = 0;
        for (let day = 0; day < 6; day++) {
            const daySlots = allAssignments
                .filter(a => a.day === day && a.facultyIds.includes(facultyMember.id))
                .map(a => a.slot)
                .sort((a,b) => a-b);
            
            facultyWorkload[facultyMember.id] += daySlots.length;
            
            if (daySlots.length > 1) {
                for (let i = 0; i < daySlots.length - 1; i++) {
                    facultyGaps += (daySlots[i+1] - daySlots[i] - 1);
                }
            }
            
            if (facultyMember.preferredSlots) {
                for (const slot of daySlots) {
                    if (!facultyMember.preferredSlots[day]?.includes(slot)) {
                        preferenceViolations++;
                    }
                }
            }
        }
    }

    // Faculty Workload Distribution
    const workloads = Object.values(facultyWorkload);
    let facultyWorkloadDistribution = 0;
    if (workloads.length > 1) {
        const mean = workloads.reduce((a, b) => a + b, 0) / workloads.length;
        const variance = workloads.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / workloads.length;
        facultyWorkloadDistribution = Math.sqrt(variance);
    }
    
    const gc = globalConstraints;
    // Calculate score (higher is better)
    const score = 1000 
        - (studentGaps * gc.aiStudentGapWeight)
        - (facultyGaps * gc.aiFacultyGapWeight)
        - (facultyWorkloadDistribution * gc.aiFacultyWorkloadDistributionWeight)
        - (preferenceViolations * gc.aiFacultyPreferenceWeight);

    return {
        score: Math.max(0, score),
        hardConflicts: 0, // Hard conflicts are resolved during generation, so this is 0
        studentGaps,
        facultyGaps,
        facultyWorkloadDistribution,
        preferenceViolations,
    };
};

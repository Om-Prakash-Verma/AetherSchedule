import type { Batch, Subject, Faculty, PlannedLeave, FacultyAvailability, GeneratedTimetable, Substitution, ClassAssignment, FacultyAllocation } from '../types';

interface SubstituteFinderInput {
    assignmentId: string;
    allBatches: Batch[];
    allSubjects: Subject[];
    allFaculty: Faculty[];
    allLeaves: PlannedLeave[];
    allAvailabilities: FacultyAvailability[];
    approvedTimetables: GeneratedTimetable[];
    allSubstitutions: Substitution[];
    allFacultyAllocations: FacultyAllocation[];
}

interface RankedSubstitute {
    facultyId: string;
    score: number;
    reasons: string[];
    canTeachOriginalSubject: boolean;
    alternativeSubjectIds: string[];
}

const flattenTimetable = (timetable: GeneratedTimetable['timetable']): ClassAssignment[] => {
    return Object.values(timetable).flatMap(batchGrid =>
        Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
    );
};

export const findSubstitutes = async (input: SubstituteFinderInput): Promise<RankedSubstitute[]> => {
    const { assignmentId, allBatches, allSubjects, allFaculty, allLeaves, allAvailabilities, approvedTimetables, allSubstitutions, allFacultyAllocations } = input;

    // 1. Find the original assignment
    const allApprovedAssignments = approvedTimetables.flatMap(tt => flattenTimetable(tt.timetable));
    const targetAssignment = allApprovedAssignments.find(a => a.id === assignmentId);

    if (!targetAssignment) {
        throw new Error('Original class assignment not found in any approved timetable.');
    }
    
    const targetBatch = allBatches.find(b => b.id === targetAssignment.batchId);
    if (!targetBatch) {
        throw new Error('Batch for the original assignment not found.');
    }

    // --- PHASE 1: CANDIDATE FILTERING (Upgraded Logic) ---
    
    // 1a. Determine the pool of faculty for this batch
    // UPGRADE: The pool of potential substitutes is now restricted to faculty members who are explicitly
    // allocated to teach at least one subject to the target batch. This ensures substitutes are familiar with the student group.
    
    // Get all faculty IDs allocated to this batch from the facultyAllocations table.
    const allocatedFacultyIdsForBatch = new Set<string>(
        allFacultyAllocations
            .filter(alloc => alloc.batchId === targetBatch.id)
            .flatMap(alloc => alloc.facultyIds)
    );

    let facultyPool: Faculty[];
    if (allocatedFacultyIdsForBatch.size > 0) {
        facultyPool = allFaculty.filter(f => allocatedFacultyIdsForBatch.has(f.id));
    } else {
        // Fallback: If no specific allocations exist for this batch, use the old, broader logic.
        // This maintains functionality for batches that haven't had specific faculty assigned yet.
        const batchSubjectIds = new Set(targetBatch.subjectIds);
        facultyPool = allFaculty.filter(f => f.subjectIds.some(subId => batchSubjectIds.has(subId)));
    }
    
    
    // 1b. Filter this pool by hard constraints
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Get all assignments happening today, including other substitutions
    const assignmentsToday = [
        ...allApprovedAssignments.filter(a => a.day === targetAssignment.day),
        ...allSubstitutions
            .filter(sub => sub.day === targetAssignment.day && todayStr >= sub.startDate && todayStr <= sub.endDate)
            .map(sub => ({
                // create a temporary assignment-like object for conflict checking
                id: sub.id,
                // FIX: Use facultyIds array for consistency with ClassAssignment type.
                facultyIds: [sub.substituteFacultyId],
                batchId: sub.batchId,
                day: sub.day,
                slot: sub.slot,
            } as any))
    ];

    const possibleCandidates = facultyPool.filter(faculty => {
        // Must not be the original teacher
        // FIX: Check against the facultyIds array instead of the non-existent facultyId property.
        if (targetAssignment.facultyIds.includes(faculty.id)) return false;

        // Availability Check: Must not have another class at that time
        // FIX: Check against the facultyIds array for all assignments today.
        const isBusy = assignmentsToday.some(a => a.facultyIds.includes(faculty.id) && a.day === targetAssignment.day && a.slot === targetAssignment.slot);
        if (isBusy) return false;

        // Leave Check: Must not be on a planned leave today
        const isOnLeave = allLeaves.some(l => l.facultyId === faculty.id && todayStr >= l.startDate && todayStr <= l.endDate);
        if (isOnLeave) return false;
        
        // Custom Availability Check
        const facultyAvailability = allAvailabilities.find(a => a.facultyId === faculty.id);
        if (facultyAvailability && (!facultyAvailability.availability[targetAssignment.day] || !facultyAvailability.availability[targetAssignment.day].includes(targetAssignment.slot))) {
            return false;
        }

        return true;
    });


    // --- PHASE 2: INTELLIGENT RANKING ---
    
    // UPGRADE: A more accurate, real-time workload calculation that accounts for substitutions.
    // This creates a snapshot of every teacher's load for today.
    const facultyWorkloadMap = new Map<string, number>();
    // Initialize with base workload from approved schedules.
    allFaculty.forEach(f => facultyWorkloadMap.set(f.id, 0));
    // FIX: Iterate over the facultyIds array to correctly calculate workload for multi-teacher classes.
    allApprovedAssignments.forEach(a => {
        a.facultyIds.forEach(facultyId => {
            facultyWorkloadMap.set(facultyId, (facultyWorkloadMap.get(facultyId) || 0) + 1);
        });
    });
    // Adjust workload based on today's active substitutions.
    allSubstitutions.forEach(s => {
        if (todayStr >= s.startDate && todayStr <= s.endDate) {
            // The substitute's load increases.
            facultyWorkloadMap.set(s.substituteFacultyId, (facultyWorkloadMap.get(s.substituteFacultyId) || 0) + 1);
            // The original teacher's load decreases.
            facultyWorkloadMap.set(s.originalFacultyId, (facultyWorkloadMap.get(s.originalFacultyId) || 1) - 1);
        }
    });
    const getWorkload = (facultyId: string) => facultyWorkloadMap.get(facultyId) || 0;
    
    const allWorkloads = Array.from(facultyWorkloadMap.values());
    const avgWorkload = allWorkloads.length > 0 ? allWorkloads.reduce((sum, val) => sum + val, 0) / allWorkloads.length : 0;
    
    const targetBatchSubjectIds = new Set(targetBatch.subjectIds);

    const rankedCandidates: RankedSubstitute[] = possibleCandidates.map(candidate => {
        let score = 100;
        const reasons: string[] = [];

        // Factor 1: Subject Match (30 points)
        const canTeachOriginalSubject = candidate.subjectIds.includes(targetAssignment.subjectId);
        if (canTeachOriginalSubject) {
            score += 30; // Bonus points
            reasons.push('Can teach the original subject.');
        }

        // Factor 2: Workload Balance (40 points)
        const workload = getWorkload(candidate.id);
        if (workload < avgWorkload) {
            const diff = (avgWorkload - workload) / (avgWorkload || 1);
            score += diff * 40;
            reasons.push('Lower than average current workload.');
        } else {
             const diff = (workload - avgWorkload) / (avgWorkload || 1);
             score -= diff * 20; // Less penalty for being overworked
        }

        // Factor 3: Schedule Compactness (30 points)
        // FIX: Check against the facultyIds array to correctly find the candidate's assignments.
        const candidateAssignmentsToday = assignmentsToday.filter(a => a.facultyIds.includes(candidate.id) && a.day === targetAssignment.day).map(a => a.slot).sort((a,b) => a - b);
        const newSlots = [...candidateAssignmentsToday, targetAssignment.slot].sort((a,b) => a - b);
        
        let gaps = 0;
        for (let i = 1; i < newSlots.length; i++) {
            gaps += (newSlots[i] - newSlots[i-1] - 1);
        }
        if (gaps > 0) {
            score -= gaps * 15; // Penalty for each gap created
            reasons.push(`Creates ${gaps} slot gap(s) in their schedule.`);
        } else {
            reasons.push('Maintains a compact schedule.');
        }
        
        const alternativeSubjectIds = canTeachOriginalSubject 
            ? [] 
            : candidate.subjectIds.filter(subId => targetBatchSubjectIds.has(subId));

        if (!canTeachOriginalSubject && alternativeSubjectIds.length > 0) {
             reasons.push(`Can teach other subjects in this batch's curriculum.`);
        } else if (!canTeachOriginalSubject) {
            score -= 50; // Heavy penalty if they can't teach anything relevant
        }
        
        return {
            facultyId: candidate.id,
            score: Math.max(0, Math.round(score)),
            reasons,
            canTeachOriginalSubject,
            alternativeSubjectIds,
        };
    });

    return rankedCandidates.sort((a, b) => b.score - a.score);
};
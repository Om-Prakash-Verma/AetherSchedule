import type { ClassAssignment, Faculty, Subject, FacultyAvailability, RankedSubstitute, Batch, FacultyAllocation } from '../types';
import { isFacultyAvailable } from './conflictChecker';

export const findRankedSubstitutes = async (
    targetAssignment: ClassAssignment,
    allFaculty: Faculty[],
    allSubjects: Subject[],
    allAssignments: ClassAssignment[],
    facultyAvailabilities: FacultyAvailability[],
    facultyAllocations: FacultyAllocation[],
    allBatches: Batch[]
): Promise<RankedSubstitute[]> => {
    const { day, slot, batchId, subjectId, facultyIds: originalFacultyIds } = targetAssignment;
    
    // Use a Map to store unique candidates and their qualification reasons
    const candidates = new Map<string, { faculty: Faculty; reasons: Set<string> }>();

    // Rule 1: Add faculty who are qualified to teach the subject
    const qualifiedFaculty = allFaculty.filter(f => f.subjectIds.includes(subjectId));
    qualifiedFaculty.forEach(f => {
        if (!candidates.has(f.id)) {
            candidates.set(f.id, { faculty: f, reasons: new Set() });
        }
        candidates.get(f.id)!.reasons.add('Qualified to teach the original subject.');
    });

    // Rule 2: Add all faculty allocated to this batch for any subject
    const batchAllocations = facultyAllocations.filter(fa => fa.batchId === batchId);
    const allocatedFacultyIds = new Set(batchAllocations.flatMap(fa => fa.facultyIds));
    
    allocatedFacultyIds.forEach(facultyId => {
        const facultyMember = allFaculty.find(f => f.id === facultyId);
        if (facultyMember) {
            if (!candidates.has(facultyId)) {
                candidates.set(facultyId, { faculty: facultyMember, reasons: new Set() });
            }
            candidates.get(facultyId)!.reasons.add('Allocated to this batch.');
        }
    });

    // Filter out original faculty and unavailable faculty
    const finalCandidates = Array.from(candidates.values())
        .filter(({ faculty }) => !originalFacultyIds.includes(faculty.id))
        .filter(({ faculty }) => isFacultyAvailable(faculty.id, day, slot, allAssignments, facultyAvailabilities));

    // Map to RankedSubstitute format with simple scoring
    const rankedList: RankedSubstitute[] = finalCandidates.map(({ faculty, reasons }) => {
        const canTeachOriginal = reasons.has('Qualified to teach the original subject.');
        const isAllocated = reasons.has('Allocated to this batch.');
        
        let score = 0;
        if (canTeachOriginal && isAllocated) {
            score = 100;
        } else if (canTeachOriginal) {
            score = 75;
        } else if (isAllocated) {
            score = 50;
        }
        
        const suitableSubjects = faculty.subjectIds
            .map(subId => allSubjects.find(s => s.id === subId))
            .filter((s): s is Subject => s !== undefined);

        return {
            faculty,
            suitableSubjects,
            score,
            reasons: Array.from(reasons),
        };
    });

    // Sort by score descending, then by name
    rankedList.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        return a.faculty.name.localeCompare(b.faculty.name);
    });

    return rankedList;
};
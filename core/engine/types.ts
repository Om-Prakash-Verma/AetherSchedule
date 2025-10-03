import type { Batch, Subject, Faculty, Room, Constraints, TimetableGrid, GeneratedTimetable, GlobalConstraints, TimetableSettings, FacultyAllocation } from '../../types';

export interface SchedulerInput {
    batches: Batch[];
    allSubjects: Subject[];
    allFaculty: Faculty[];
    allRooms: Room[];
    approvedTimetables: GeneratedTimetable[];
    constraints: Constraints;
    facultyAllocations: FacultyAllocation[];
    globalConstraints: GlobalConstraints;
    days: string[];
    workingDaysIndices: number[];
    timetableSettings: TimetableSettings,
    candidateCount: number;
    baseTimetable?: TimetableGrid;
}

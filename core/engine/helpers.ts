import type { ClassAssignment, TimetableGrid, Batch, Subject, Faculty, Room, FacultyAllocation } from '../../types';
import { isRoomAvailable } from '../conflictChecker';

export const generateId = () => `asgn_${Math.random().toString(36).substr(2, 9)}`;

export const flattenTimetable = (timetable: TimetableGrid): ClassAssignment[] => {
    return Object.values(timetable).flatMap(batchGrid =>
        Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
    );
};

export const isAssignmentPinned = (assignment: ClassAssignment, pinnedLocations: Set<string>): boolean => {
    const key = `${assignment.day}-${assignment.slot}-${assignment.batchId}`;
    return pinnedLocations.has(key);
};

export const findFacultyForClass = (
    batchId: string,
    subjectId: string,
    allFaculty: Faculty[],
    allocations: FacultyAllocation[],
): Faculty[] => {
    const specificAllocation = allocations.find(a => a.batchId === batchId && a.subjectId === subjectId);
    if (specificAllocation && specificAllocation.facultyIds.length > 0) {
        return allFaculty.filter(f => specificAllocation.facultyIds.includes(f.id));
    }
    return allFaculty.filter(f => f.subjectIds.includes(subjectId));
};


export const findRoomForClass = (
    batch: Batch,
    subject: Subject,
    day: number,
    slot: number,
    allRooms: Room[],
    allAssignments: ClassAssignment[]
): Room | null => {
    const suitableRooms = allRooms.filter(room => {
        if (batch.allocatedRoomIds && batch.allocatedRoomIds.length > 0 && !batch.allocatedRoomIds.includes(room.id)) {
            return false;
        }
        return isRoomAvailable(room.id, day, slot, batch, subject, room, allAssignments);
    });
    return suitableRooms.length > 0 ? suitableRooms[Math.floor(Math.random() * suitableRooms.length)] : null;
};

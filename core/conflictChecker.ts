
import type { ClassAssignment, Faculty, Room, Subject, Batch, Conflict, FacultyAvailability } from '../types';

export const isFacultyAvailable = (
    facultyId: string,
    day: number,
    slot: number,
    allAssignments: ClassAssignment[],
    facultyAvailabilities: FacultyAvailability[] = []
): boolean => {
    // Check faculty's own preferred availability
    const customAvailability = facultyAvailabilities.find(fa => fa.facultyId === facultyId);
    if (customAvailability) {
        if (!customAvailability.availability[day]?.includes(slot)) {
            return false; // Faculty has explicitly marked this time as unavailable
        }
    }

    // Check for clashes with other assignments
    return !allAssignments.some(a => a.day === day && a.slot === slot && a.facultyIds.includes(facultyId));
};

export const isRoomAvailable = (
    roomId: string,
    day: number,
    slot: number,
    batch: Batch,
    subject: Subject,
    room: Room,
    allAssignments: ClassAssignment[]
): boolean => {
    // Check capacity
    if (room.capacity < batch.studentCount) {
        return false;
    }

    // Check room type suitability
    if (subject.type === 'Practical' && room.type !== 'Lab') {
        return false;
    }
    if (subject.type === 'Workshop' && room.type !== 'Workshop') {
        return false;
    }
    if (subject.type === 'Theory' && room.type !== 'Lecture Hall') {
        return false;
    }

    // Check for time clashes
    return !allAssignments.some(a => a.day === day && a.slot === slot && a.roomId === roomId);
};


export const isBatchAvailable = (
    batchId: string,
    day: number,
    slot: number,
    allAssignments: ClassAssignment[]
): boolean => {
    return !allAssignments.some(a => a.day === day && a.slot === slot && a.batchId === batchId);
};

export const checkConflicts = (
    assignmentsToCheck: ClassAssignment[],
    allFaculty: Faculty[],
    allRooms: Room[],
    allSubjects: Subject[],
    allBatches: Batch[],
    allOtherAssignments: ClassAssignment[]
): Map<string, Conflict[]> => {
    
    const conflictMap = new Map<string, Conflict[]>();
    const combinedAssignments = [...assignmentsToCheck, ...allOtherAssignments];

    for (const assignment of assignmentsToCheck) {
        const conflicts: Conflict[] = [];
        const otherAssignmentsInSlot = combinedAssignments.filter(a =>
            a.id !== assignment.id &&
            a.day === assignment.day &&
            a.slot === assignment.slot
        );

        // Faculty conflicts
        for (const facultyId of assignment.facultyIds) {
            const clashingAssignment = otherAssignmentsInSlot.find(a => a.facultyIds.includes(facultyId));
            if (clashingAssignment) {
                const faculty = allFaculty.find(f => f.id === facultyId);
                const clashingBatch = allBatches.find(b => b.id === clashingAssignment.batchId);
                conflicts.push({
                    type: 'Faculty',
                    message: `${faculty?.name || 'Faculty'} is double-booked with ${clashingBatch?.name || 'another class'}.`
                });
            }
        }

        // Room conflicts
        const roomClash = otherAssignmentsInSlot.find(a => a.roomId === assignment.roomId);
        if (roomClash) {
            const room = allRooms.find(r => r.id === assignment.roomId);
            const clashingBatch = allBatches.find(b => b.id === roomClash.batchId);
            conflicts.push({
                type: 'Room',
                message: `${room?.name || 'Room'} is double-booked with ${clashingBatch?.name || 'another class'}.`
            });
        }
        
        // Batch conflicts (shouldn't happen with own assignments, but good for checking against approved ones)
        const batchClash = otherAssignmentsInSlot.find(a => a.batchId === assignment.batchId);
        if (batchClash) {
             const batch = allBatches.find(b => b.id === assignment.batchId);
             conflicts.push({
                type: 'Batch',
                message: `${batch?.name || 'Batch'} has another class scheduled at this time.`
             });
        }
        
        if (conflicts.length > 0) {
            conflictMap.set(assignment.id, conflicts);
        }
    }

    return conflictMap;
};

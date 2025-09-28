import type { TimetableGrid, FacultyAvailability, Room, Batch, Subject, ClassAssignment, Conflict, Faculty, SingleBatchTimetableGrid } from '../types';

// Helper to flatten the new master timetable structure into a list of assignments
const flattenTimetable = (timetable: TimetableGrid): ClassAssignment[] => {
    return Object.values(timetable).flatMap(batchGrid => 
        Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
    );
};

export const isFacultyAvailable = (
    facultyId: string,
    day: number,
    slot: number,
    allAssignments: ClassAssignment[], // Now takes a flat list
    facultyAvailability: FacultyAvailability[]
): boolean => {
    const availability = facultyAvailability.find(a => a.facultyId === facultyId);
    if (availability && (!availability.availability[day] || !availability.availability[day].includes(slot))) {
        return false;
    }
    
    // Check against the provided list of assignments
    return !allAssignments.some(a => a.day === day && a.slot === slot && a.facultyId === facultyId);
};

export const isRoomAvailable = (
    roomId: string,
    day: number,
    slot: number,
    batch: Batch,
    subject: Subject,
    room: Room,
    allAssignments: ClassAssignment[] // Now takes a flat list
): boolean => {
    if (room.capacity < batch.studentCount) return false;
    const requiredType = subject.type === 'Practical' ? 'Lab' : subject.type === 'Workshop' ? 'Workshop' : 'Lecture Hall';
    if (room.type !== requiredType) return false;

    // Check against the provided list of assignments
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
  assignments: ClassAssignment[],
  allFaculty: Faculty[],
  allRooms: Room[]
): Map<string, Conflict[]> => {
  const conflictMap = new Map<string, Conflict[]>();
  const slots = new Map<string, ClassAssignment[]>();

  for (const assignment of assignments) {
    const key = `${assignment.day}-${assignment.slot}`;
    if (!slots.has(key)) slots.set(key, []);
    slots.get(key)!.push(assignment);
  }

  for (const group of slots.values()) {
    const facultyInSlot = new Map<string, string[]>(); // facultyId -> assignmentId[]
    const roomInSlot = new Map<string, string[]>(); // roomId -> assignmentId[]

    for (const assignment of group) {
      if (!facultyInSlot.has(assignment.facultyId)) facultyInSlot.set(assignment.facultyId, []);
      facultyInSlot.get(assignment.facultyId)!.push(assignment.id);

      if (!roomInSlot.has(assignment.roomId)) roomInSlot.set(assignment.roomId, []);
      roomInSlot.get(assignment.roomId)!.push(assignment.id);
    }

    for (const [facultyId, assignmentIds] of facultyInSlot.entries()) {
      if (assignmentIds.length > 1) {
        const facultyName = allFaculty.find(f => f.id === facultyId)?.name || 'Unknown Faculty';
        const message = `Faculty Conflict: ${facultyName} is double-booked.`;
        for (const assignmentId of assignmentIds) {
          if (!conflictMap.has(assignmentId)) conflictMap.set(assignmentId, []);
          conflictMap.get(assignmentId)!.push({ type: 'Faculty', message });
        }
      }
    }
    
    for (const [roomId, assignmentIds] of roomInSlot.entries()) {
        if (assignmentIds.length > 1) {
            const roomName = allRooms.find(r => r.id === roomId)?.name || 'Unknown Room';
            const message = `Room Conflict: ${roomName} is double-booked.`;
            for (const assignmentId of assignmentIds) {
                if (!conflictMap.has(assignmentId)) conflictMap.set(assignmentId, []);
                conflictMap.get(assignmentId)!.push({ type: 'Room', message });
            }
        }
    }
  }
  return conflictMap;
};
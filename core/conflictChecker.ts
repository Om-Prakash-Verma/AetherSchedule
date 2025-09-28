import type { TimetableGrid, FacultyAvailability, Room, Batch, Subject, ClassAssignment, Conflict, Faculty } from '../types';

// Helper to flatten the new master timetable structure into a list of assignments
const flattenTimetable = (timetable: TimetableGrid): ClassAssignment[] => {
    return Object.values(timetable).flatMap(batchGrid => 
        Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
    );
};

// This function checks if a specific faculty member is free at a given time slot.
// It considers their pre-set availability and any other classes they're teaching.
export const isFacultyAvailable = (
    facultyId: string,
    day: number,
    slot: number,
    allAssignments: ClassAssignment[], // A flat list of all existing class assignments to check against
    facultyAvailability: FacultyAvailability[]
): boolean => {
    // Check against the faculty's declared availability preferences.
    const availability = facultyAvailability.find(a => a.facultyId === facultyId);
    if (availability && (!availability.availability[day] || !availability.availability[day].includes(slot))) {
        return false; // The faculty member has marked themselves as unavailable.
    }
    
    // Check against all other assignments to see if they are already teaching at this exact time.
    return !allAssignments.some(a => a.day === day && a.slot === slot && a.facultyIds.includes(facultyId));
};

// This function checks if a specific room is free and suitable for a given class.
// It considers room capacity, type (lab/lecture hall), and any other classes scheduled in it.
export const isRoomAvailable = (
    roomId: string,
    day: number,
    slot: number,
    batch: Batch,
    subject: Subject,
    room: Room,
    allAssignments: ClassAssignment[] // A flat list of all existing class assignments to check against
): boolean => {
    // Rule 1: The room must be large enough for the batch.
    if (room.capacity < batch.studentCount) return false;

    // Rule 2: The room must be of the correct type for the subject.
    const requiredType = subject.type === 'Practical' ? 'Lab' : subject.type === 'Workshop' ? 'Workshop' : 'Lecture Hall';
    if (room.type !== requiredType) return false;

    // Rule 3: The room must not be occupied by another class at this exact time.
    return !allAssignments.some(a => a.day === day && a.slot === slot && a.roomId === roomId);
};

// This function checks if a specific batch of students is free at a given time slot.
export const isBatchAvailable = (
    batchId: string,
    day: number,
    slot: number,
    allAssignments: ClassAssignment[]
): boolean => {
    return !allAssignments.some(a => a.day === day && a.slot === slot && a.batchId === batchId);
};

// This is the main conflict checking function.
// It takes a list of new assignments (a draft) and checks for clashes,
// both within the draft itself and against a list of pre-existing external assignments (e.g., from approved timetables).
export const checkConflicts = (
  assignments: ClassAssignment[], // The new draft timetable assignments to validate.
  allFaculty: Faculty[],
  allRooms: Room[],
  externalAssignments: ClassAssignment[] = [] // Existing approved assignments and substitutions.
): Map<string, Conflict[]> => {
  const conflictMap = new Map<string, Conflict[]>();
  // Group all known assignments by their time slot for efficient checking.
  const slots = new Map<string, ClassAssignment[]>();
  
  const allKnownAssignments = [...assignments, ...externalAssignments];

  for (const assignment of allKnownAssignments) {
    const key = `${assignment.day}-${assignment.slot}`;
    if (!slots.has(key)) slots.set(key, []);
    slots.get(key)!.push(assignment);
  }

  // Iterate over each time slot that has at least one assignment.
  for (const group of slots.values()) {
    const facultyInSlot = new Map<string, string[]>(); // facultyId -> assignmentId[]
    const roomInSlot = new Map<string, string[]>(); // roomId -> assignmentId[]

    // Within each time slot, group assignments by faculty and room.
    for (const assignment of group) {
      // For each faculty member in the assignment, record their presence in this slot.
      for (const facultyId of assignment.facultyIds) {
          if (!facultyInSlot.has(facultyId)) facultyInSlot.set(facultyId, []);
          facultyInSlot.get(facultyId)!.push(assignment.id);
      }

      if (!roomInSlot.has(assignment.roomId)) roomInSlot.set(assignment.roomId, []);
      roomInSlot.get(assignment.roomId)!.push(assignment.id);
    }

    // Check for faculty conflicts (double-bookings).
    for (const [facultyId, assignmentIds] of facultyInSlot.entries()) {
      if (assignmentIds.length > 1) {
        const facultyName = allFaculty.find(f => f.id === facultyId)?.name || 'Unknown Faculty';
        const message = `Faculty Conflict: ${facultyName} is double-booked.`;
        for (const assignmentId of assignmentIds) {
          // IMPORTANT: Only report the conflict on the assignments that are part of the new draft.
          // We don't want to flag conflicts on pre-existing, approved timetables.
          if (assignments.some(a => a.id === assignmentId)) {
            if (!conflictMap.has(assignmentId)) conflictMap.set(assignmentId, []);
            conflictMap.get(assignmentId)!.push({ type: 'Faculty', message });
          }
        }
      }
    }
    
    // Check for room conflicts (double-bookings).
    for (const [roomId, assignmentIds] of roomInSlot.entries()) {
        if (assignmentIds.length > 1) {
            const roomName = allRooms.find(r => r.id === roomId)?.name || 'Unknown Room';
            const message = `Room Conflict: ${roomName} is double-booked.`;
            for (const assignmentId of assignmentIds) {
                // Similarly, only report conflicts on assignments in the current draft.
                if (assignments.some(a => a.id === assignmentId)) {
                    if (!conflictMap.has(assignmentId)) conflictMap.set(assignmentId, []);
                    conflictMap.get(assignmentId)!.push({ type: 'Room', message });
                }
            }
        }
    }
  }
  return conflictMap;
};
import type { ClassAssignment, Faculty, Room, Subject, Batch, Conflict, TimetableGrid, ValidationContext, PinnedAssignment, FacultyAvailability } from '../types';

const flattenTimetable = (timetable: TimetableGrid): ClassAssignment[] => {
    return Object.values(timetable).flatMap(batchGrid =>
        Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
    );
};

export class ConflictChecker {
    private subjects: Map<string, Subject>;
    private faculty: Map<string, Faculty>;
    private rooms: Map<string, Room>;
    private batches: Map<string, Batch>;
    private constraints: ValidationContext['constraints'];
    private facultyAllocations: Map<string, string[]>;
    private expandedPins: Map<string, { pin: PinnedAssignment, resource: 'faculty' | 'room' | 'batch' }>;

    constructor(context: ValidationContext) {
        this.subjects = new Map(context.subjects.map(s => [s.id, s]));
        this.faculty = new Map(context.faculty.map(f => [f.id, f]));
        this.rooms = new Map(context.rooms.map(r => [r.id, r]));
        this.batches = new Map(context.batches.map(b => [b.id, b]));
        this.constraints = context.constraints;
        this.facultyAllocations = new Map(context.facultyAllocations.map(fa => [`${fa.batchId}-${fa.subjectId}`, fa.facultyIds]));
        this.expandedPins = this.expandPinnedAssignments();
    }

    private expandPinnedAssignments() {
        const expanded = new Map<string, { pin: PinnedAssignment, resource: 'faculty' | 'room' | 'batch' }>();
        (this.constraints.pinnedAssignments || []).forEach(pin => {
            pin.days.forEach(day => {
                pin.startSlots.forEach(startSlot => {
                    for (let i = 0; i < pin.duration; i++) {
                        const slot = startSlot + i;
                        expanded.set(`${day}-${slot}-f-${pin.facultyId}`, { pin, resource: 'faculty' });
                        expanded.set(`${day}-${slot}-r-${pin.roomId}`, { pin, resource: 'room' });
                        expanded.set(`${day}-${slot}-b-${pin.batchId}`, { pin, resource: 'batch' });
                    }
                });
            });
        });
        return expanded;
    }

    public check(grid: TimetableGrid): Map<string, Conflict[]> {
        const conflictMap = new Map<string, Conflict[]>();
        const assignments = flattenTimetable(grid);
        const slots = this.groupAssignmentsBySlot(assignments);

        for (const assignment of assignments) {
            const conflicts: Conflict[] = [];
            const otherAssignmentsInSlot = (slots.get(`${assignment.day}-${assignment.slot}`) || []).filter(a => a.id !== assignment.id);

            conflicts.push(...this.checkDoubleBookings(assignment, otherAssignmentsInSlot));
            conflicts.push(...this.checkResourceSuitability(assignment));
            conflicts.push(...this.checkConstraintViolations(assignment));
            
            if (conflicts.length > 0) {
                conflictMap.set(assignment.id, conflicts);
            }
        }
        return conflictMap;
    }

    private groupAssignmentsBySlot(assignments: ClassAssignment[]): Map<string, ClassAssignment[]> {
        const map = new Map<string, ClassAssignment[]>();
        for (const assignment of assignments) {
            const key = `${assignment.day}-${assignment.slot}`;
            if (!map.has(key)) {
                map.set(key, []);
            }
            map.get(key)!.push(assignment);
        }
        return map;
    }

    private checkDoubleBookings(assignment: ClassAssignment, othersInSlot: ClassAssignment[]): Conflict[] {
        const conflicts: Conflict[] = [];

        // Faculty Double-Booking
        for (const facultyId of assignment.facultyIds) {
            const clashingAssignment = othersInSlot.find(a => a.facultyIds.includes(facultyId));
            if (clashingAssignment) {
                const facultyName = this.faculty.get(facultyId)?.name || 'Unknown Faculty';
                const clashingBatchName = this.batches.get(clashingAssignment.batchId)?.name || 'another batch';
                conflicts.push({
                    type: 'Faculty Double-Booking',
                    message: `${facultyName} is double-booked with ${clashingBatchName}.`
                });
            }
        }

        // Room Double-Booking
        if (othersInSlot.some(a => a.roomId === assignment.roomId)) {
            const roomName = this.rooms.get(assignment.roomId)?.name || 'This room';
            conflicts.push({ type: 'Room Double-Booking', message: `${roomName} is double-booked.` });
        }

        // Batch Double-Booking
        if (othersInSlot.some(a => a.batchId === assignment.batchId)) {
            const batchName = this.batches.get(assignment.batchId)?.name || 'This batch';
            conflicts.push({ type: 'Batch Double-Booking', message: `${batchName} has multiple classes scheduled.` });
        }

        return conflicts;
    }

    private checkResourceSuitability(assignment: ClassAssignment): Conflict[] {
        const conflicts: Conflict[] = [];
        const batch = this.batches.get(assignment.batchId);
        const room = this.rooms.get(assignment.roomId);
        const subject = this.subjects.get(assignment.subjectId);

        if (!batch || !room || !subject) return []; // Should not happen with valid data

        // Room Capacity
        if (room.capacity < batch.studentCount) {
            conflicts.push({ type: 'Room Capacity', message: `Room ${room.name} capacity (${room.capacity}) is less than batch size (${batch.studentCount}).` });
        }

        // Room Type
        if ((subject.type === 'Practical' && room.type !== 'Lab') || (subject.type === 'Workshop' && room.type !== 'Workshop') || (subject.type === 'Theory' && room.type !== 'Lecture Hall')) {
            conflicts.push({ type: 'Room Type Mismatch', message: `Room ${room.name} (${room.type}) is not suitable for a ${subject.type} class.` });
        }

        // Room Allocation
        if (batch.allocatedRoomIds && batch.allocatedRoomIds.length > 0 && !batch.allocatedRoomIds.includes(room.id)) {
            conflicts.push({ type: 'Room Allocation Mismatch', message: `Room ${room.name} is not in the list of allocated rooms for batch ${batch.name}.` });
        }

        // Faculty Allocation
        const allocationKey = `${batch.id}-${subject.id}`;
        const allocatedFaculty = this.facultyAllocations.get(allocationKey);
        if (allocatedFaculty && allocatedFaculty.length > 0) {
            for (const facultyId of assignment.facultyIds) {
                if (!allocatedFaculty.includes(facultyId)) {
                    const facultyName = this.faculty.get(facultyId)?.name || 'A faculty member';
                    conflicts.push({ type: 'Faculty Allocation Mismatch', message: `${facultyName} is not allocated to teach ${subject.code} for ${batch.name}.` });
                }
            }
        }

        return conflicts;
    }

    private checkConstraintViolations(assignment: ClassAssignment): Conflict[] {
        const conflicts: Conflict[] = [];

        // Faculty Availability
        const availabilityData = this.constraints.facultyAvailability || [];
        for (const facultyId of assignment.facultyIds) {
            const facultyAvailability = availabilityData.find(fa => fa.facultyId === facultyId);
            if (facultyAvailability && facultyAvailability.availability[assignment.day] && !facultyAvailability.availability[assignment.day].includes(assignment.slot)) {
                const facultyName = this.faculty.get(facultyId)?.name || 'A faculty member';
                conflicts.push({ type: 'Faculty Unavailability', message: `${facultyName} is marked as unavailable at this time.` });
            }
        }
        
        // Pinned Assignment Clash
        for (const facultyId of assignment.facultyIds) {
            const pinClash = this.expandedPins.get(`${assignment.day}-${assignment.slot}-f-${facultyId}`);
            if (pinClash) {
                 conflicts.push({ type: 'Pinned Assignment Clash', message: `Clashes with pinned event: '${pinClash.pin.name}' for faculty ${this.faculty.get(facultyId)?.name}.` });
            }
        }
        const roomPinClash = this.expandedPins.get(`${assignment.day}-${assignment.slot}-r-${assignment.roomId}`);
        if(roomPinClash) {
            conflicts.push({ type: 'Pinned Assignment Clash', message: `Clashes with pinned event: '${roomPinClash.pin.name}' for room ${this.rooms.get(assignment.roomId)?.name}.` });
        }
        const batchPinClash = this.expandedPins.get(`${assignment.day}-${assignment.slot}-b-${assignment.batchId}`);
        if (batchPinClash) {
            conflicts.push({ type: 'Pinned Assignment Clash', message: `Clashes with pinned event: '${batchPinClash.pin.name}' for batch ${this.batches.get(assignment.batchId)?.name}.` });
        }

        return conflicts;
    }
}

// FIX: Exported helper functions to check availability, resolving import errors in other modules.
export const isBatchAvailable = (
    batchId: string,
    day: number,
    slot: number,
    allAssignments: ClassAssignment[]
): boolean => {
    return !allAssignments.some(a => a.batchId === batchId && a.day === day && a.slot === slot);
};

export const isFacultyAvailable = (
    facultyId: string,
    day: number,
    slot: number,
    allAssignments: ClassAssignment[],
    facultyAvailabilities: FacultyAvailability[]
): boolean => {
    // Check for double-booking
    if (allAssignments.some(a => a.facultyIds.includes(facultyId) && a.day === day && a.slot === slot)) {
        return false;
    }

    // Check against explicit unavailability constraints
    const facultyAvailability = facultyAvailabilities.find(fa => fa.facultyId === facultyId);
    if (facultyAvailability) {
        // If availability is defined for the day, the slot must be in the list.
        if (facultyAvailability.availability[day] && !facultyAvailability.availability[day].includes(slot)) {
            return false;
        }
    }
    
    return true;
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
    // Check for double-booking
    if (allAssignments.some(a => a.roomId === roomId && a.day === day && a.slot === slot)) {
        return false;
    }

    // Check room capacity
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

    // Check against batch-specific room allocations
    if (batch.allocatedRoomIds && batch.allocatedRoomIds.length > 0 && !batch.allocatedRoomIds.includes(room.id)) {
        return false;
    }

    return true;
};

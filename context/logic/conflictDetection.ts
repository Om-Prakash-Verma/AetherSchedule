import { ScheduleEntry, ScheduleConflict, Faculty, Room, Batch } from "../../types";

export const detectConflicts = (
    schedule: ScheduleEntry[],
    faculty: Faculty[],
    rooms: Room[],
    batches: Batch[]
): ScheduleConflict[] => {
    const newConflicts: ScheduleConflict[] = [];

    // 1. Capacity Checks (Individual Entry)
    // Check if assigned room is large enough for the batch
    schedule.forEach(entry => {
        const batch = batches.find(b => b.id === entry.batchId);
        const room = rooms.find(r => r.id === entry.roomId);
        
        if (batch && room && batch.size > room.capacity) {
            newConflicts.push({
                type: 'CAPACITY',
                description: `Room Capacity Issue: ${room.name} (${room.capacity}) is too small for ${batch.name} (${batch.size} students)`,
                involvedIds: [entry.id]
            });
        }
    });

    // 2. Overlap Checks (Group by Day-Slot for O(N) efficiency instead of O(N^2))
    const slotMap = new Map<string, ScheduleEntry[]>();
    
    schedule.forEach(entry => {
        const key = `${entry.day}-${entry.slot}`;
        if (!slotMap.has(key)) slotMap.set(key, []);
        slotMap.get(key)?.push(entry);
    });

    slotMap.forEach((entriesInSlot, key) => {
        if (entriesInSlot.length < 2) return;

        // Compare every pair ONLY within this specific time slot
        for (let i = 0; i < entriesInSlot.length; i++) {
            for (let j = i + 1; j < entriesInSlot.length; j++) {
                const entry1 = entriesInSlot[i];
                const entry2 = entriesInSlot[j];

                // A. Room Conflict
                if (entry1.roomId === entry2.roomId) {
                    const roomName = rooms.find(r => r.id === entry1.roomId)?.name || 'Unknown Room';
                    const b1 = batches.find(b => b.id === entry1.batchId)?.name || 'Unknown';
                    const b2 = batches.find(b => b.id === entry2.batchId)?.name || 'Unknown';
                    
                    newConflicts.push({
                        type: 'ROOM',
                        description: `Room ${roomName} double booked (${b1} vs ${b2})`,
                        involvedIds: [entry1.id, entry2.id]
                    });
                }
                
                // B. Faculty Conflict (Intersection check for arrays)
                const f1s = entry1.facultyIds || [];
                const f2s = entry2.facultyIds || [];
                const overlappingFaculty = f1s.filter(fId => f2s.includes(fId));
                
                if (overlappingFaculty.length > 0) {
                    const fNames = overlappingFaculty.map(fid => faculty.find(f => f.id === fid)?.name).filter(Boolean).join(', ');
                    const b1 = batches.find(b => b.id === entry1.batchId)?.name || 'Unknown';
                    const b2 = batches.find(b => b.id === entry2.batchId)?.name || 'Unknown';

                    newConflicts.push({
                        type: 'FACULTY',
                        description: `Faculty ${fNames || 'Unknown'} double booked (${b1} vs ${b2})`,
                        involvedIds: [entry1.id, entry2.id]
                    });
                }

                // C. Batch Conflict (Batch cannot be in two places at once)
                if (entry1.batchId === entry2.batchId) {
                     const bName = batches.find(b => b.id === entry1.batchId)?.name || 'Unknown Batch';
                     newConflicts.push({
                        type: 'BATCH',
                        description: `Batch ${bName} has concurrent classes scheduled`,
                        involvedIds: [entry1.id, entry2.id]
                    });
                }
            }
        }
    });

    return newConflicts;
};
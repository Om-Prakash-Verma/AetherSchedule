import type { TimetableGrid, TimetableMetrics, Batch, Subject, Faculty, Room, Constraints, FacultyAllocation } from '../../types';
import { generateId, flattenTimetable, findFacultyForClass, findRoomForClass, isAssignmentPinned } from './helpers';
import { isBatchAvailable, isFacultyAvailable } from '../conflictChecker';

export const initializePopulation = (
    size: number,
    classes: { batchId: string, subjectId: string }[],
    batches: Batch[],
    allSubjects: Subject[],
    allFaculty: Faculty[],
    allRooms: Room[],
    constraints: Constraints,
    facultyAllocations: FacultyAllocation[],
    workingDaysIndices: number[],
    numSlots: number,
    baseTimetable?: TimetableGrid
): { timetable: TimetableGrid, metrics: TimetableMetrics }[] => {
    let population = [];
    for (let i = 0; i < size; i++) {
        if (i === 0 && baseTimetable) {
            population.push({ timetable: baseTimetable, metrics: { score: 0, hardConflicts: 0, studentGaps: 0, facultyGaps: 0, facultyWorkloadDistribution: 0, preferenceViolations: 0 } });
            continue;
        }

        let timetable: TimetableGrid = {};
        batches.forEach(b => {
            timetable[b.id] = {};
            for (const dayIndex of workingDaysIndices) {
                timetable[b.id][dayIndex] = {};
            }
        });

        const requiredClassesTally: { [key: string]: number } = {};
        classes.forEach(c => {
            const key = `${c.batchId}-${c.subjectId}`;
            requiredClassesTally[key] = (requiredClassesTally[key] || 0) + 1;
        });

        (constraints.pinnedAssignments || []).forEach(pin => {
            if (!timetable[pin.batchId]) timetable[pin.batchId] = {};
            pin.days.forEach(day => {
                if (!timetable[pin.batchId][day]) timetable[pin.batchId][day] = {};
                pin.startSlots.forEach(startSlot => {
                    for (let j = 0; j < pin.duration; j++) {
                        const slot = startSlot + j;
                        if (slot < numSlots) {
                            timetable[pin.batchId][day][slot] = {
                                id: generateId(), subjectId: pin.subjectId, facultyIds: [pin.facultyId],
                                roomId: pin.roomId, batchId: pin.batchId, day, slot,
                            };
                            const key = `${pin.batchId}-${pin.subjectId}`;
                            if (requiredClassesTally[key] > 0) {
                                requiredClassesTally[key]--;
                            }
                        }
                    }
                });
            });
        });

        const unplacedClasses: { batchId: string, subjectId: string }[] = [];
        for (const key in requiredClassesTally) {
            const count = requiredClassesTally[key];
            if (count > 0) {
                const [batchId, subjectId] = key.split(/-(.+)/s);
                for (let j = 0; j < count; j++) {
                    unplacedClasses.push({ batchId, subjectId });
                }
            }
        }
        
        for (let j = unplacedClasses.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [unplacedClasses[j], unplacedClasses[k]] = [unplacedClasses[k], unplacedClasses[j]];
        }

        const classesToPlaceRandomly = [...unplacedClasses];
        let attempts = 0;
        const maxAttempts = classesToPlaceRandomly.length * numSlots * workingDaysIndices.length;

        while (classesToPlaceRandomly.length > 0 && attempts < maxAttempts) {
            attempts++;
            const classToPlace = classesToPlaceRandomly.shift()!;
            const batch = batches.find(b => b.id === classToPlace.batchId)!;
            const subject = allSubjects.find(s => s.id === classToPlace.subjectId)!;

            const day = workingDaysIndices[Math.floor(Math.random() * workingDaysIndices.length)];
            const slot = Math.floor(Math.random() * numSlots);
            
            if (!isBatchAvailable(batch.id, day, slot, flattenTimetable(timetable))) {
                classesToPlaceRandomly.push(classToPlace); continue;
            }
            
            const facultyCandidates = findFacultyForClass(batch.id, subject.id, allFaculty, facultyAllocations);
            if (facultyCandidates.length === 0) {
                 classesToPlaceRandomly.push(classToPlace); continue;
            }
            
            const requiredFacultyCount = subject.type === 'Practical' ? 2 : 1;
            const selectedFaculty = [];
            for (const fac of facultyCandidates) {
                if (isFacultyAvailable(fac.id, day, slot, flattenTimetable(timetable), constraints.facultyAvailability)) {
                    selectedFaculty.push(fac);
                    if (selectedFaculty.length >= requiredFacultyCount) break;
                }
            }

            if (selectedFaculty.length < requiredFacultyCount) {
                 classesToPlaceRandomly.push(classToPlace); continue;
            }

            const room = findRoomForClass(batch, subject, day, slot, allRooms, flattenTimetable(timetable));
            if (!room) {
                 classesToPlaceRandomly.push(classToPlace); continue;
            }

            if (!timetable[batch.id][day]) timetable[batch.id][day] = {};
            timetable[batch.id][day][slot] = {
                id: generateId(), subjectId: subject.id, facultyIds: selectedFaculty.map(f => f.id),
                roomId: room.id, batchId: batch.id, day, slot
            };
        }

        population.push({ timetable, metrics: { score: 0, hardConflicts: 0, studentGaps: 0, facultyGaps: 0, facultyWorkloadDistribution: 0, preferenceViolations: 0 } });
    }
    return population;
};

export const greedyRepair = (
    individual: { timetable: TimetableGrid },
    batches: Batch[],
    allSubjects: Subject[],
    allFaculty: Faculty[],
    allRooms: Room[],
    constraints: Constraints,
    workingDaysIndices: number[],
    numSlots: number,
    facultyAllocations: FacultyAllocation[],
    pinnedLocations: Set<string>
) => {
    const timetable = individual.timetable;
    const currentAssignments = flattenTimetable(timetable);

    const pinnedAssignments = currentAssignments.filter(a => isAssignmentPinned(a, pinnedLocations));
    const movableAssignments = currentAssignments.filter(a => !isAssignmentPinned(a, pinnedLocations));
    
    const requiredClassCounts: Record<string, number> = {};
    batches.forEach(batch => {
        batch.subjectIds.forEach(subjectId => {
            const subject = allSubjects.find(s => s.id === subjectId);
            if (subject) {
                const key = `${batch.id}-${subjectId}`;
                requiredClassCounts[key] = subject.hoursPerWeek;
            }
        });
    });

    const assignmentsToRemove = new Set<any>();
    const placedCounts: Record<string, number> = {};
    const occupiedSlots = new Set<string>();

    pinnedAssignments.forEach(assignment => {
        const key = `${assignment.batchId}-${assignment.subjectId}`;
        placedCounts[key] = (placedCounts[key] || 0) + 1;
        occupiedSlots.add(`d${assignment.day}-s${assignment.slot}-b${assignment.batchId}`);
        occupiedSlots.add(`d${assignment.day}-s${assignment.slot}-r${assignment.roomId}`);
        assignment.facultyIds.forEach(fid => occupiedSlots.add(`d${assignment.day}-s${assignment.slot}-f${fid}`));
    });

    for (const assignment of movableAssignments) {
        const key = `${assignment.batchId}-${assignment.subjectId}`;
        
        if ((placedCounts[key] || 0) >= (requiredClassCounts[key] || 0)) {
            assignmentsToRemove.add(assignment);
            continue;
        }

        const batchSlotKey = `d${assignment.day}-s${assignment.slot}-b${assignment.batchId}`;
        const roomSlotKey = `d${assignment.day}-s${assignment.slot}-r${assignment.roomId}`;
        if (occupiedSlots.has(batchSlotKey) || occupiedSlots.has(roomSlotKey)) {
            assignmentsToRemove.add(assignment);
            continue;
        }
        let facultyConflict = false;
        for (const facultyId of assignment.facultyIds) {
            if (occupiedSlots.has(`d${assignment.day}-s${assignment.slot}-f${facultyId}`)) {
                facultyConflict = true;
                break;
            }
        }
        if (facultyConflict) {
            assignmentsToRemove.add(assignment);
            continue;
        }

        placedCounts[key] = (placedCounts[key] || 0) + 1;
        occupiedSlots.add(batchSlotKey);
        occupiedSlots.add(roomSlotKey);
        assignment.facultyIds.forEach(fid => occupiedSlots.add(`d${assignment.day}-s${assignment.slot}-f${fid}`));
    }
    

    assignmentsToRemove.forEach(assignment => {
        if (timetable[assignment.batchId]?.[assignment.day]?.[assignment.slot]?.id === assignment.id) {
            delete timetable[assignment.batchId][assignment.day][assignment.slot];
        }
    });

    const classesToPlace: { batchId: string, subjectId: string }[] = [];
    const finalPlacedCounts: Record<string, number> = {};
    flattenTimetable(timetable).forEach(a => {
        const key = `${a.batchId}-${a.subjectId}`;
        finalPlacedCounts[key] = (finalPlacedCounts[key] || 0) + 1;
    });

    for (const key in requiredClassCounts) {
        const required = requiredClassCounts[key];
        const placed = finalPlacedCounts[key] || 0;
        if (placed < required) {
            const [batchId, subjectId] = key.split(/-(.+)/s);
            for (let i = 0; i < required - placed; i++) {
                classesToPlace.push({ batchId, subjectId });
            }
        }
    }

    for (const classToPlace of classesToPlace) {
        const batch = batches.find(b => b.id === classToPlace.batchId)!;
        const subject = allSubjects.find(s => s.id === classToPlace.subjectId)!;
        
        for (let i = 0; i < 100; i++) {
            const day = workingDaysIndices[Math.floor(Math.random() * workingDaysIndices.length)];
            const slot = Math.floor(Math.random() * numSlots);
            
            if (!isBatchAvailable(batch.id, day, slot, flattenTimetable(timetable))) continue;
            
            const facultyCandidates = findFacultyForClass(batch.id, subject.id, allFaculty, facultyAllocations);
            const requiredFacultyCount = subject.type === 'Practical' ? 2 : 1;
            const selectedFaculty: Faculty[] = [];
             for (const fac of facultyCandidates) {
                if (isFacultyAvailable(fac.id, day, slot, flattenTimetable(timetable), constraints.facultyAvailability)) {
                    selectedFaculty.push(fac);
                    if (selectedFaculty.length >= requiredFacultyCount) break;
                }
            }
            if(selectedFaculty.length < requiredFacultyCount) continue;
            
            const room = findRoomForClass(batch, subject, day, slot, allRooms, flattenTimetable(timetable));
            if (room) {
                 if (!timetable[batch.id][day]) timetable[batch.id][day] = {};
                 timetable[batch.id][day][slot] = {
                    id: generateId(), subjectId: subject.id, batchId: batch.id,
                    facultyIds: selectedFaculty.map(f => f.id), roomId: room.id, day, slot
                 };
                 break;
            }
        }
    }
};

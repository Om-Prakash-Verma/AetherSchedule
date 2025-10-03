import type { TimetableGrid, TimetableMetrics, Batch, Faculty, GlobalConstraints, Constraints, Room, Subject } from '../../types';
import { flattenTimetable, isAssignmentPinned } from './helpers';
import { calculateMetrics } from './fitness';

// --- LOW-LEVEL HEURISTICS ---
export enum LowLevelHeuristic { SWAP_MUTATE, MOVE_MUTATE, SIMULATED_ANNEALING, DAY_WISE_CROSSOVER }

// --- SIMULATED ANNEALING CONFIGURATION ---
const SA_INITIAL_TEMPERATURE = 80.0;
const SA_COOLING_RATE = 0.98;
const SA_MIN_TEMPERATURE = 0.1;
const SA_ITERATIONS_PER_TEMP = 1;


export const selectParent = (population: { metrics: TimetableMetrics }[], tournamentSize: number) => {
    let best = null;
    for (let i = 0; i < tournamentSize; i++) {
        const individual = population[Math.floor(Math.random() * population.length)];
        if (best === null || individual.metrics.score > best.metrics.score) {
            best = individual;
        }
    }
    return best!;
};

export const dayWiseCrossover = (parent1: { timetable: TimetableGrid }, parent2: { timetable: TimetableGrid }) => {
    const child: TimetableGrid = {};
    const batchIds = Object.keys(parent1.timetable);
    const crossoverDay = Math.floor(Math.random() * 6);

    for (const batchId of batchIds) {
        child[batchId] = {};
        for (let day = 0; day < 6; day++) {
            if (day < crossoverDay) {
                child[batchId][day] = { ...(parent1.timetable[batchId]?.[day] || {}) };
            } else {
                child[batchId][day] = { ...(parent2.timetable[batchId]?.[day] || {}) };
            }
        }
    }
    return { timetable: child, metrics: { score: 0, hardConflicts: 1, studentGaps: 0, facultyGaps: 0, facultyWorkloadDistribution: 0, preferenceViolations: 0 }};
};


export const swapMutate = (individual: { timetable: TimetableGrid }, mutationRate: number, pinnedLocations: Set<string>) => {
    if (Math.random() > mutationRate) return individual;
    const timetable = JSON.parse(JSON.stringify(individual.timetable));
    const assignments = flattenTimetable(timetable);
    if (assignments.length < 2) return individual;
    
    const as1 = assignments[Math.floor(Math.random() * assignments.length)];
    const as2 = assignments[Math.floor(Math.random() * assignments.length)];

    if (isAssignmentPinned(as1, pinnedLocations) || isAssignmentPinned(as2, pinnedLocations)) {
        return individual;
    }

    const tempDay = as1.day, tempSlot = as1.slot;
    as1.day = as2.day; as1.slot = as2.slot;
    as2.day = tempDay; as2.slot = tempSlot;

    const batchGrid1 = timetable[as1.batchId];
    const batchGrid2 = timetable[as2.batchId];
    if (batchGrid1 && batchGrid2) {
        if (as1.batchId === as2.batchId) {
            delete batchGrid1[as2.day][as2.slot];
            batchGrid1[as1.day][as1.slot] = as1;
            batchGrid1[as2.day][as2.slot] = as2;
        } else {
            delete batchGrid1[as2.day][as2.slot];
            delete batchGrid2[as1.day][as1.slot];
            batchGrid1[as1.day][as1.slot] = as1;
            batchGrid2[as2.day][as2.slot] = as2;
        }
    }
    
    return { ...individual, timetable };
};

export const moveMutate = (
    individual: { timetable: TimetableGrid }, 
    mutationRate: number, 
    batches: Batch[], 
    allSubjects: Subject[],
    allFaculty: Faculty[],
    allRooms: Room[],
    constraints: Constraints,
    workingDaysIndices: number[],
    numSlots: number,
    pinnedLocations: Set<string>
) => {
    if (Math.random() > mutationRate) return individual;
    const timetable = JSON.parse(JSON.stringify(individual.timetable));
    const assignments = flattenTimetable(timetable);
    if (assignments.length === 0) return individual;

    const assignmentToMove = assignments[Math.floor(Math.random() * assignments.length)];

    if (isAssignmentPinned(assignmentToMove, pinnedLocations)) return individual;

    const batchGrid = timetable[assignmentToMove.batchId];
    if (batchGrid?.[assignmentToMove.day]?.[assignmentToMove.slot]) {
        delete batchGrid[assignmentToMove.day][assignmentToMove.slot];
    }
    
    const batch = batches.find(b => b.id === assignmentToMove.batchId)!;
    const subject = allSubjects.find(s => s.id === assignmentToMove.subjectId)!;

    for (let i=0; i < 50; i++) {
        const day = workingDaysIndices[Math.floor(Math.random() * workingDaysIndices.length)];
        const slot = Math.floor(Math.random() * numSlots);
        if (isBatchAvailable(batch.id, day, slot, flattenTimetable(timetable))) {
            const facultyAreAvailable = assignmentToMove.facultyIds.every(fid => isFacultyAvailable(fid, day, slot, flattenTimetable(timetable), constraints.facultyAvailability));
            const room = findRoomForClass(batch, subject, day, slot, allRooms, flattenTimetable(timetable));
            if (facultyAreAvailable && room) {
                assignmentToMove.day = day;
                assignmentToMove.slot = slot;
                assignmentToMove.roomId = room.id;
                if (!batchGrid[day]) batchGrid[day] = {};
                batchGrid[day][slot] = assignmentToMove;
                return { ...individual, timetable };
            }
        }
    }
    
    if (!batchGrid[assignmentToMove.day]) batchGrid[assignmentToMove.day] = {};
    batchGrid[assignmentToMove.day][assignmentToMove.slot] = assignmentToMove;
    return individual;
};


export const simulatedAnnealing = (
    individual: { timetable: TimetableGrid, metrics: TimetableMetrics },
    batches: Batch[],
    allFaculty: Faculty[],
    globalConstraints: GlobalConstraints,
    pinnedLocations: Set<string>
) => {
    let currentTimetable = JSON.parse(JSON.stringify(individual.timetable));
    let currentMetrics = calculateMetrics(currentTimetable, batches, allFaculty, globalConstraints);
    let temperature = SA_INITIAL_TEMPERATURE;

    while (temperature > SA_MIN_TEMPERATURE) {
        for (let i = 0; i < SA_ITERATIONS_PER_TEMP; i++) {
            const newTimetable = JSON.parse(JSON.stringify(currentTimetable));
            const assignments = flattenTimetable(newTimetable);
            if (assignments.length < 2) continue;
            
            const as1 = assignments[Math.floor(Math.random() * assignments.length)];
            const as2 = assignments[Math.floor(Math.random() * assignments.length)];

            if (isAssignmentPinned(as1, pinnedLocations) || isAssignmentPinned(as2, pinnedLocations)) continue;

            const tempDay = as1.day, tempSlot = as1.slot;
            as1.day = as2.day; as1.slot = as2.slot;
            as2.day = tempDay; as2.slot = tempSlot;

            const batchGrid1 = newTimetable[as1.batchId];
            const batchGrid2 = newTimetable[as2.batchId];
             if (batchGrid1 && batchGrid2) {
                delete batchGrid2[as2.day][as2.slot];
                delete batchGrid1[as1.day][as1.slot];
                batchGrid1[as1.day][as1.slot] = as1;
                batchGrid2[as2.day][as2.slot] = as2;
            }

            const newMetrics = calculateMetrics(newTimetable, batches, allFaculty, globalConstraints);
            const delta = newMetrics.score - currentMetrics.score;

            if (delta > 0 || Math.exp(delta / temperature) > Math.random()) {
                currentTimetable = newTimetable;
                currentMetrics = newMetrics;
            }
        }
        temperature *= SA_COOLING_RATE;
    }

    return { timetable: currentTimetable, metrics: currentMetrics };
};

export const selectHeuristic = (heuristicMap: Map<number, number>): number => {
    const rand = Math.random();
    let cumulative = 0;
    for (const [heuristic, probability] of heuristicMap.entries()) {
        cumulative += probability;
        if (rand <= cumulative) {
            return heuristic;
        }
    }
    return 0; // Fallback to SWAP_MUTATE
};

// Re-importing these here to avoid circular dependency issues if operators needed them
import { isBatchAvailable, isFacultyAvailable } from '../conflictChecker';
import { findRoomForClass } from './helpers';

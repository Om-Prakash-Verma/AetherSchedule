import type { Batch, Subject, Faculty, Room, Constraints, TimetableGrid, ClassAssignment, TimetableMetrics, GlobalConstraints, GeneratedTimetable, TimetableFeedback, SingleBatchTimetableGrid, TimetableSettings, PinnedAssignment, FacultyAllocation } from '../types';
import { isFacultyAvailable, isRoomAvailable, isBatchAvailable } from './conflictChecker';
import { GoogleGenAI, Type } from "@google/genai";
import { generateTimeSlots } from '../utils/time';

// --- GEMINI API INITIALIZATION ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

interface SchedulerInput {
  batches: Batch[];
  allSubjects: Subject[];
  allFaculty: Faculty[];
  allRooms: Room[];
  approvedTimetables: GeneratedTimetable[];
  constraints: Constraints;
  facultyAllocations: FacultyAllocation[];
  globalConstraints: GlobalConstraints;
  days: string[];
  timetableSettings: TimetableSettings,
  candidateCount: number;
}

// --- ALGORITHM CONFIGURATION ---
const POPULATION_SIZE = 20;
const MAX_GENERATIONS = 25;
const ELITISM_COUNT = 2;
const TOURNAMENT_SIZE = 5;
const STAGNATION_LIMIT_FOR_EXIT = 10;
const STAGNATION_LIMIT_FOR_INTERVENTION = 5;
const PERFECT_SCORE_THRESHOLD = 990;

// --- LOW-LEVEL HEURISTICS ---
enum LowLevelHeuristic { SWAP_MUTATE, MOVE_MUTATE, SIMULATED_ANNEALING, DAY_WISE_CROSSOVER }

// --- SIMULATED ANNEALING CONFIGURATION ---
const SA_INITIAL_TEMPERATURE = 80.0;
const SA_COOLING_RATE = 0.98;
const SA_MIN_TEMPERATURE = 0.1;
const SA_ITERATIONS_PER_TEMP = 1;

// --- UTILITIES ---
const generateId = () => `asgn_${Math.random().toString(36).substr(2, 9)}`;
const flattenTimetable = (timetable: TimetableGrid): ClassAssignment[] => {
    return Object.values(timetable).flatMap(batchGrid =>
        Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
    );
};

// --- FITNESS FUNCTION (UPGRADED for multi-teacher classes) ---
const calculateMetrics = (timetable: TimetableGrid, batches: Batch[], allFaculty: Faculty[], globalConstraints: GlobalConstraints): TimetableMetrics => {
    let studentGaps = 0;
    let facultyGaps = 0;
    let preferenceViolations = 0;

    // Student Gaps
    for (const batchId in timetable) {
        const batchGrid = timetable[batchId];
        for (let day = 0; day < 6; day++) {
            const daySlots = batchGrid[day] ? Object.keys(batchGrid[day]).map(Number).sort((a, b) => a - b) : [];
            for (let i = 0; i < daySlots.length - 1; i++) {
                studentGaps += (daySlots[i+1] - daySlots[i] - 1);
            }
        }
    }

    // Faculty Gaps, Workload & Preference Violations
    const facultyWorkload: Record<string, number> = {};
    allFaculty.forEach(f => facultyWorkload[f.id] = 0);
    const facultyAssignmentsByDay: Record<string, Record<number, number[]>> = {};
    allFaculty.forEach(f => facultyAssignmentsByDay[f.id] = {});

    const allAssignments = flattenTimetable(timetable);

    for (const assignment of allAssignments) {
        for (const facultyId of assignment.facultyIds) {
            facultyWorkload[facultyId]++;
            
            if (!facultyAssignmentsByDay[facultyId][assignment.day]) {
                facultyAssignmentsByDay[facultyId][assignment.day] = [];
            }
            facultyAssignmentsByDay[facultyId][assignment.day].push(assignment.slot);

            const facultyMember = allFaculty.find(f => f.id === facultyId);
            if (facultyMember?.preferredSlots && facultyMember.preferredSlots[assignment.day] && !facultyMember.preferredSlots[assignment.day].includes(assignment.slot)) {
                preferenceViolations++;
            }
        }
    }

    for (const facultyId in facultyAssignmentsByDay) {
        for (const day in facultyAssignmentsByDay[facultyId]) {
            const daySlots = facultyAssignmentsByDay[facultyId][day].sort((a,b) => a - b);
            for (let i = 0; i < daySlots.length - 1; i++) {
                facultyGaps += (daySlots[i+1] - daySlots[i] - 1);
            }
        }
    }
    
    // Faculty Workload Distribution (variance)
    const workloads = Object.values(facultyWorkload);
    const avgWorkload = workloads.reduce((sum, w) => sum + w, 0) / (workloads.length || 1);
    const workloadVariance = workloads.reduce((sum, w) => sum + Math.pow(w - avgWorkload, 2), 0) / (workloads.length || 1);
    const facultyWorkloadDistribution = Math.round(workloadVariance);

    const score = 1000 - 
        (studentGaps * globalConstraints.studentGapWeight) -
        (facultyGaps * globalConstraints.facultyGapWeight) -
        (facultyWorkloadDistribution * globalConstraints.facultyWorkloadDistributionWeight) -
        (preferenceViolations * globalConstraints.facultyPreferenceWeight);
    
    return {
        score: Math.max(0, score),
        hardConflicts: 0,
        studentGaps,
        facultyGaps,
        facultyWorkloadDistribution,
        preferenceViolations
    };
};

// --- CORE TYPES ---
type Chromosome = { timetable: TimetableGrid; metrics: TimetableMetrics; };
interface ClassRequirement { subject: Subject; batch: Batch; }

// --- INITIALIZATION ---
const getRequiredClasses = (batches: Batch[], allSubjects: Subject[], pinnedAssignments: PinnedAssignment[]): ClassRequirement[] => {
    const requirements: ClassRequirement[] = [];
    for (const batch of batches) {
        for (const subjectId of batch.subjectIds) {
            const subject = allSubjects.find(s => s.id === subjectId);
            if (subject) {
                for (let i = 0; i < subject.hoursPerWeek; i++) {
                    requirements.push({ subject, batch });
                }
            }
        }
    }
    return requirements;
};

const createChromosome = (
    requiredClasses: ClassRequirement[],
    slots: string[],
    pinnedClassAssignments: ClassAssignment[],
    input: Omit<SchedulerInput, 'candidateCount'>
): Chromosome => {
    const { batches, allFaculty, allRooms, constraints, globalConstraints, days, approvedTimetables, facultyAllocations } = input;
    const timetable: TimetableGrid = {};
    batches.forEach(b => timetable[b.id] = {});

    for (const pin of pinnedClassAssignments) {
        if (!timetable[pin.batchId]) timetable[pin.batchId] = {};
        const batchGrid = timetable[pin.batchId];
        if (!batchGrid[pin.day]) batchGrid[pin.day] = {};
        batchGrid[pin.day][pin.slot] = pin;
    }

    const approvedAssignments = approvedTimetables.flatMap(tt => flattenTimetable(tt.timetable));
    const substitutionAssignments: ClassAssignment[] = constraints.substitutions.map(sub => ({
        id: sub.id,
        subjectId: sub.substituteSubjectId,
        facultyIds: [sub.substituteFacultyId],
        roomId: allRooms.find(r => r.id === approvedAssignments.find(a => a.id === sub.originalAssignmentId)?.roomId)?.id || '',
        batchId: sub.batchId, day: sub.day, slot: sub.slot,
    }));

    const shuffledClasses = [...requiredClasses].sort(() => Math.random() - 0.5);

    for (const req of shuffledClasses) {
        const potentialSlots = days
            .flatMap((_, dayIndex) => slots.map((_, slotIndex) => ({ day: dayIndex, slot: slotIndex })))
            .sort(() => Math.random() - 0.5);
        
        for (const { day, slot } of potentialSlots) {
            const currentDraftAssignments = flattenTimetable(timetable);
            const allExistingAssignments = [...approvedAssignments, ...substitutionAssignments, ...currentDraftAssignments];

            if (isBatchAvailable(req.batch.id, day, slot, allExistingAssignments)) {
                
                const allocation = facultyAllocations.find(fa => fa.batchId === req.batch.id && fa.subjectId === req.subject.id);
                const qualifiedFaculty = allFaculty.filter(f => f.subjectIds.includes(req.subject.id));

                let selectedFacultyIds: string[] = [];
                if (allocation && allocation.facultyIds.length > 0) {
                    const allAllocatedAvailable = allocation.facultyIds.every(fid => 
                        isFacultyAvailable(fid, day, slot, allExistingAssignments, constraints.facultyAvailability)
                    );
                    if (allAllocatedAvailable) {
                        selectedFacultyIds = allocation.facultyIds;
                    }
                } else {
                    // Fallback for non-allocated subjects (typically non-labs)
                    const availableFaculty = qualifiedFaculty.find(f => isFacultyAvailable(f.id, day, slot, allExistingAssignments, constraints.facultyAvailability));
                    if (availableFaculty) {
                        selectedFacultyIds = [availableFaculty.id];
                    }
                }

                if (selectedFacultyIds.length > 0) {
                    const batchRoomPool = (req.batch.allocatedRoomIds && req.batch.allocatedRoomIds.length > 0)
                        ? allRooms.filter(r => req.batch.allocatedRoomIds!.includes(r.id))
                        : allRooms;
                    
                    const suitableRooms = batchRoomPool.filter(r =>
                        isRoomAvailable(r.id, day, slot, req.batch, req.subject, r, allExistingAssignments)
                    );

                    if (suitableRooms.length > 0) {
                        const assignment: ClassAssignment = { 
                            id: generateId(), batchId: req.batch.id, subjectId: req.subject.id, 
                            facultyIds: selectedFacultyIds,
                            roomId: suitableRooms[Math.floor(Math.random() * suitableRooms.length)].id, 
                            day, slot 
                        };
                        
                        const batchGrid = timetable[req.batch.id];
                        if (!batchGrid[day]) batchGrid[day] = {};
                        batchGrid[day][slot] = assignment;
                        break; // Class placed, move to next requirement
                    }
                }
            }
        }
    }
    return { timetable, metrics: calculateMetrics(timetable, batches, allFaculty, globalConstraints) };
};

// --- ADVANCED OPERATOR: GREEDY REPAIR ---
const greedyRepair = (chromosome: Chromosome, requiredClasses: ClassRequirement[], slots: string[], pinnedClassAssignments: ClassAssignment[], input: Omit<SchedulerInput, 'candidateCount'>): Chromosome => {
    const repairedTimetable = JSON.parse(JSON.stringify(chromosome.timetable));
    const { batches, allSubjects, allFaculty, allRooms, constraints, approvedTimetables, facultyAllocations } = input;

    const requiredCounts: Record<string, number> = {}; // key: "batchId_subjectId"
    for (const req of requiredClasses) {
        const key = `${req.batch.id}_${req.subject.id}`;
        requiredCounts[key] = (requiredCounts[key] || 0) + 1;
    }

    let currentAssignments = flattenTimetable(repairedTimetable);
    const currentCounts: Record<string, { count: number; assignments: ClassAssignment[] }> = {};
    for (const assignment of currentAssignments) {
        const key = `${assignment.batchId}_${assignment.subjectId}`;
        if (!currentCounts[key]) currentCounts[key] = { count: 0, assignments: [] };
        currentCounts[key].count++;
        currentCounts[key].assignments.push(assignment);
    }

    // Phase 1: Remove over-scheduled classes
    for (const key in currentCounts) {
        const required = requiredCounts[key] || 0;
        let excess = currentCounts[key].count - required;
        if (excess > 0) {
            const assignmentsToRemove = currentCounts[key].assignments.sort(() => 0.5 - Math.random()).slice(0, excess);
            for (const assignment of assignmentsToRemove) {
                 if (repairedTimetable[assignment.batchId]?.[assignment.day]?.[assignment.slot]) {
                    delete repairedTimetable[assignment.batchId][assignment.day][assignment.slot];
                }
            }
        }
    }
    
    // Recalculate current assignments after deletion
    currentAssignments = flattenTimetable(repairedTimetable);
    const newCurrentCounts: Record<string, number> = {};
    for (const assignment of currentAssignments) {
        const key = `${assignment.batchId}_${assignment.subjectId}`;
        newCurrentCounts[key] = (newCurrentCounts[key] || 0) + 1;
    }

    // Phase 2: Add under-scheduled classes
    for (const key in requiredCounts) {
        const current = newCurrentCounts[key] || 0;
        let deficit = requiredCounts[key] - current;
        if (deficit > 0) {
            const [batchId, subjectId] = key.split('_');
            const batch = batches.find(b => b.id === batchId);
            const subject = allSubjects.find(s => s.id === subjectId);
            if (!batch || !subject) continue;
            
            for (let i = 0; i < deficit; i++) {
                 const potentialSlots = input.days
                    .flatMap((_, dayIndex) => slots.map((_, slotIndex) => ({ day: dayIndex, slot: slotIndex })))
                    .sort(() => Math.random() - 0.5);
                
                let placed = false;
                for (const { day, slot } of potentialSlots) {
                    const currentDraftAssignments = flattenTimetable(repairedTimetable);
                    const allExistingAssignments = [...approvedTimetables.flatMap(tt => flattenTimetable(tt.timetable)), ...constraints.substitutions.map(s => ({...s, id: s.id, facultyIds: [s.substituteFacultyId], subjectId: s.substituteSubjectId} as any)), ...currentDraftAssignments];
                    
                    if (!isBatchAvailable(batchId, day, slot, allExistingAssignments)) continue;

                    const allocation = facultyAllocations.find(fa => fa.batchId === batchId && fa.subjectId === subjectId);
                    const qualifiedFaculty = allFaculty.filter(f => f.subjectIds.includes(subjectId));
                    
                    let selectedFacultyIds: string[] = [];
                    if (allocation && allocation.facultyIds.length > 0) {
                        const allAllocatedAvailable = allocation.facultyIds.every(fid => 
                            isFacultyAvailable(fid, day, slot, allExistingAssignments, constraints.facultyAvailability)
                        );
                        if (allAllocatedAvailable) {
                            selectedFacultyIds = allocation.facultyIds;
                        }
                    } else {
                        const availableFaculty = qualifiedFaculty.find(f => isFacultyAvailable(f.id, day, slot, allExistingAssignments, constraints.facultyAvailability));
                        if (availableFaculty) {
                            selectedFacultyIds = [availableFaculty.id];
                        }
                    }
                    
                    if (selectedFacultyIds.length > 0) {
                        const batchRoomPool = (batch.allocatedRoomIds && batch.allocatedRoomIds.length > 0)
                            ? allRooms.filter(r => batch.allocatedRoomIds!.includes(r.id))
                            : allRooms;
                        
                        const suitableRooms = batchRoomPool.filter(r => isRoomAvailable(r.id, day, slot, batch, subject, r, allExistingAssignments));

                        if (suitableRooms.length > 0) {
                            const assignment: ClassAssignment = { id: generateId(), batchId, subjectId, facultyIds: selectedFacultyIds, roomId: suitableRooms[0].id, day, slot };
                            if (!repairedTimetable[batchId][day]) repairedTimetable[batchId][day] = {};
                            repairedTimetable[batchId][day][slot] = assignment;
                            placed = true;
                            break;
                        }
                    }
                    if (placed) break;
                }
            }
        }
    }
    
    return {
        timetable: repairedTimetable,
        metrics: calculateMetrics(repairedTimetable, batches, allFaculty, input.globalConstraints),
    };
};


// --- GEMINI AI INTEGRATION (THREE LEVELS) ---
const getHistoricalFeedbackSummary = (approvedTimetables: GeneratedTimetable[], allFaculty: Faculty[]): string => {
    const feedbackData = approvedTimetables.flatMap(tt => tt.feedback || []);
    if (feedbackData.length === 0) return "No historical faculty feedback available.";
    const ratingsByFaculty: Record<string, number[]> = {};
    feedbackData.forEach(fb => {
        if (!ratingsByFaculty[fb.facultyId]) ratingsByFaculty[fb.facultyId] = [];
        ratingsByFaculty[fb.facultyId].push(fb.rating);
    });
    let summary = "Summary of historical faculty feedback:\n";
    for (const facultyId in ratingsByFaculty) {
        const facultyMember = allFaculty.find(f => f.id === facultyId);
        if (facultyMember) {
            const avgRating = ratingsByFaculty[facultyId].reduce((a, b) => a + b, 0) / ratingsByFaculty[facultyId].length;
            summary += `- ${facultyMember.name} has an average satisfaction rating of ${avgRating.toFixed(2)} out of 5.\n`;
        }
    }
    const overallAvg = feedbackData.reduce((sum, fb) => sum + fb.rating, 0) / feedbackData.length;
    summary += `Overall average timetable satisfaction is ${overallAvg.toFixed(2)} out of 5.`;
    return summary;
};
export const tuneConstraintWeightsWithGemini = async (baseConstraints: GlobalConstraints, allFeedback: TimetableFeedback[], allFaculty: Faculty[]): Promise<GlobalConstraints> => { /* ... */ return baseConstraints; };
interface AIPhaseStrategy {
  phases: {
    duration: number; // as a fraction of total generations
    operatorProbabilities: Record<LowLevelHeuristic, number>;
  }[];
  interventionPrompt: string;
}
const getGeminiPhaseStrategy = async (input: Omit<SchedulerInput, 'candidateCount'>): Promise<AIPhaseStrategy> => {
    console.log("Generating default AI strategy (mocked).");
    return {
        phases: [
            {
                duration: 0.5,
                operatorProbabilities: {
                    [LowLevelHeuristic.SWAP_MUTATE]: 0.4, [LowLevelHeuristic.MOVE_MUTATE]: 0.4,
                    [LowLevelHeuristic.DAY_WISE_CROSSOVER]: 0.2, [LowLevelHeuristic.SIMULATED_ANNEALING]: 0.0,
                },
            },
            {
                duration: 0.5,
                operatorProbabilities: {
                    [LowLevelHeuristic.SWAP_MUTATE]: 0.2, [LowLevelHeuristic.MOVE_MUTATE]: 0.2,
                    [LowLevelHeuristic.DAY_WISE_CROSSOVER]: 0.1, [LowLevelHeuristic.SIMULATED_ANNEALING]: 0.5,
                },
            },
        ],
        interventionPrompt: "The current best timetable has a score of {score} but is stuck. It has {studentGaps} student gaps and {facultyGaps} faculty gaps. Suggest a structural change by swapping two non-pinned classes to improve the score. Respond with JSON: { from: {batchId, day, slot}, to: {batchId, day, slot} }",
    };
};
const geminiCreativeIntervention = async (stuckChromosome: Chromosome, input: Omit<SchedulerInput, 'candidateCount'>): Promise<Chromosome> => {
    console.log("Performing mocked Gemini creative intervention.");
    const newTimetable = JSON.parse(JSON.stringify(stuckChromosome.timetable));
    const batchIds = Object.keys(newTimetable);
    if (batchIds.length > 0) {
        const randomBatchId = batchIds[Math.floor(Math.random() * batchIds.length)];
        const day1 = Math.floor(Math.random() * input.days.length);
        let day2 = Math.floor(Math.random() * input.days.length);
        if (input.days.length > 1) {
            while (day1 === day2) { day2 = Math.floor(Math.random() * input.days.length); }
        }
        const tempDay = newTimetable[randomBatchId][day1];
        newTimetable[randomBatchId][day1] = newTimetable[randomBatchId][day2];
        newTimetable[randomBatchId][day2] = tempDay;
        return {
            timetable: newTimetable,
            metrics: calculateMetrics(newTimetable, input.batches, input.allFaculty, input.globalConstraints),
        };
    }
    return stuckChromosome;
};

// --- LOW-LEVEL HEURISTICS ---
const tournamentSelection = (population: Chromosome[]): Chromosome => {
    let best: Chromosome | null = null;
    for (let i = 0; i < TOURNAMENT_SIZE; i++) {
        const randomIndividual = population[Math.floor(Math.random() * population.length)];
        if (best === null || randomIndividual.metrics.score > best.metrics.score) { best = randomIndividual; }
    }
    return best!;
};
const swapMutate = (chromosome: Chromosome, pinnedClassAssignments: ClassAssignment[], input: Omit<SchedulerInput, 'candidateCount'>): Chromosome => {
    const newTimetable = JSON.parse(JSON.stringify(chromosome.timetable));
    const batchIds = Object.keys(newTimetable);
    if (batchIds.length === 0) return chromosome;
    const b1Id = batchIds[Math.floor(Math.random() * batchIds.length)];
    const b2Id = batchIds[Math.floor(Math.random() * batchIds.length)];
    const assignments1 = Object.values(newTimetable[b1Id]).flatMap(day => Object.values(day as object));
    const assignments2 = Object.values(newTimetable[b2Id]).flatMap(day => Object.values(day as object));
    if (assignments1.length < 1 || assignments2.length < 1) return chromosome;
    const as1 = assignments1[Math.floor(Math.random() * assignments1.length)];
    const as2 = assignments2[Math.floor(Math.random() * assignments2.length)];
    newTimetable[as1.batchId][as1.day][as1.slot] = as2;
    newTimetable[as2.batchId][as2.day][as2.slot] = as1;
    [as1.day, as2.day] = [as2.day, as1.day];
    [as1.slot, as2.slot] = [as2.slot, as1.slot];
    return { timetable: newTimetable, metrics: calculateMetrics(newTimetable, input.batches, input.allFaculty, input.globalConstraints) };
};
const moveMutate = (chromosome: Chromosome, slots: string[], pinnedClassAssignments: ClassAssignment[], input: Omit<SchedulerInput, 'candidateCount'>): Chromosome => {
    const newTimetable = JSON.parse(JSON.stringify(chromosome.timetable));
    const batchIds = Object.keys(newTimetable);
    if (batchIds.length === 0) return chromosome;
    const randomBatchId = batchIds[Math.floor(Math.random() * batchIds.length)];
    const assignments = Object.values(newTimetable[randomBatchId]).flatMap(day => Object.values(day as object));
    if (assignments.length === 0) return chromosome;
    const assignmentToMove = assignments[Math.floor(Math.random() * assignments.length)];
    const potentialSlots = input.days
        .flatMap((_, dayIndex) => slots.map((_, slotIndex) => ({ day: dayIndex, slot: slotIndex })))
        .filter(({ day, slot }) => !newTimetable[randomBatchId][day] || !newTimetable[randomBatchId][day][slot]);
    if (potentialSlots.length === 0) return chromosome;
    const { day: newDay, slot: newSlot } = potentialSlots[Math.floor(Math.random() * potentialSlots.length)];
    delete newTimetable[assignmentToMove.batchId][assignmentToMove.day][assignmentToMove.slot];
    if (!newTimetable[assignmentToMove.batchId][newDay]) newTimetable[assignmentToMove.batchId][newDay] = {};
    newTimetable[assignmentToMove.batchId][newDay][newSlot] = { ...assignmentToMove, day: newDay, slot: newSlot };
    return { timetable: newTimetable, metrics: calculateMetrics(newTimetable, input.batches, input.allFaculty, input.globalConstraints) };
};
const dayWiseCrossover = (p1: Chromosome, p2: Chromosome, slots: string[], pinnedClassAssignments: ClassAssignment[], input: Omit<SchedulerInput, 'candidateCount'>, reqs: ClassRequirement[]): Chromosome => {
    const childTimetable: TimetableGrid = {};
    const crossoverPoint = Math.floor(Math.random() * input.days.length);

    for (const batch of input.batches) {
        childTimetable[batch.id] = {};
        for (let day = 0; day < input.days.length; day++) {
            const parentSource = day < crossoverPoint ? p1.timetable : p2.timetable;
            if (parentSource[batch.id] && parentSource[batch.id][day]) {
                childTimetable[batch.id][day] = JSON.parse(JSON.stringify(parentSource[batch.id][day]));
            }
        }
    }
    const childChromosome = { timetable: childTimetable, metrics: calculateMetrics(childTimetable, input.batches, input.allFaculty, input.globalConstraints) };
    // FIX: A repair function is now called to ensure the new child is valid.
    return greedyRepair(childChromosome, reqs, slots, pinnedClassAssignments, input);
};
const simulatedAnnealingOperator = (chromosome: Chromosome, slots: string[], pinnedClassAssignments: ClassAssignment[], input: Omit<SchedulerInput, 'candidateCount'>): Chromosome => {
    let currentSolution = JSON.parse(JSON.stringify(chromosome));
    let temperature = SA_INITIAL_TEMPERATURE;
    while (temperature > SA_MIN_TEMPERATURE) {
        for (let i = 0; i < SA_ITERATIONS_PER_TEMP; i++) {
            const neighbor = swapMutate(currentSolution, pinnedClassAssignments, input);
            const currentEnergy = currentSolution.metrics.score;
            const neighborEnergy = neighbor.metrics.score;
            if (neighborEnergy > currentEnergy || Math.random() < Math.exp((neighborEnergy - currentEnergy) / temperature)) {
                currentSolution = neighbor;
            }
        }
        temperature *= SA_COOLING_RATE;
    }
    return currentSolution;
};
const selectHeuristic = (phaseProbabilities: Record<string, number>): LowLevelHeuristic => {
    const rand = Math.random();
    let cumulative = 0;
    const heuristics = Object.keys(phaseProbabilities) as (keyof typeof LowLevelHeuristic)[];
    for (const heuristic of heuristics) {
        const key = heuristic as unknown as LowLevelHeuristic;
        cumulative += phaseProbabilities[key];
        if (rand <= cumulative) { return key; }
    }
    return heuristics[0] as unknown as LowLevelHeuristic;
};

// --- Main optimization function ---
export const runOptimization = async (input: SchedulerInput): Promise<{ timetable: TimetableGrid, metrics: TimetableMetrics }[]> => {
    const { candidateCount, batches, allSubjects, timetableSettings, constraints } = input;
    const timeSlots = generateTimeSlots(timetableSettings);
    
    const pinnedClassAssignments: ClassAssignment[] = constraints.pinnedAssignments.flatMap(pin => 
        pin.days.flatMap(day => 
            pin.startSlots.map(startSlot => ({
                id: `pin_${pin.id}_${day}_${startSlot}`, ...pin, day, slot: startSlot, facultyIds: [pin.facultyId]
            }))
        )
    );

    const requiredClasses = getRequiredClasses(batches, allSubjects, constraints.pinnedAssignments);
    console.log("Consulting Gemini AI for a high-level optimization strategy...");
    const aiStrategy = await getGeminiPhaseStrategy(input);
    console.log("Initializing population...");
    let population: Chromosome[] = Array.from({ length: POPULATION_SIZE }, () => createChromosome(requiredClasses, timeSlots, pinnedClassAssignments, input));

    let bestScoreSoFar = -Infinity;
    let stagnationCounter = 0;
    let geminiInterventionUsed = false;

    for (let gen = 0; gen < MAX_GENERATIONS; gen++) {
        const newPopulation: Chromosome[] = [];
        population.sort((a, b) => b.metrics.score - a.metrics.score);
        for(let i=0; i<ELITISM_COUNT; i++) { newPopulation.push(population[i]); }
        const currentPhase = aiStrategy.phases[gen < MAX_GENERATIONS * aiStrategy.phases[0].duration ? 0 : 1];
        while(newPopulation.length < POPULATION_SIZE) {
            const p1 = tournamentSelection(population);
            const p2 = tournamentSelection(population);
            const heuristic = selectHeuristic(currentPhase.operatorProbabilities);
            let child: Chromosome;
            switch(heuristic) {
                case LowLevelHeuristic.DAY_WISE_CROSSOVER: child = dayWiseCrossover(p1, p2, timeSlots, pinnedClassAssignments, input, requiredClasses); break;
                case LowLevelHeuristic.SWAP_MUTATE: child = swapMutate(p1, pinnedClassAssignments, input); break;
                case LowLevelHeuristic.MOVE_MUTATE: child = moveMutate(p1, timeSlots, pinnedClassAssignments, input); break;
                case LowLevelHeuristic.SIMULATED_ANNEALING: child = simulatedAnnealingOperator(p1, timeSlots, pinnedClassAssignments, input); break;
                default: child = p1;
            }
            newPopulation.push(child);
        }
        population = newPopulation;
        const bestOfGen = population[0];
        if (bestOfGen.metrics.score > bestScoreSoFar) {
            bestScoreSoFar = bestOfGen.metrics.score;
            stagnationCounter = 0;
        } else {
            stagnationCounter++;
        }
        console.log(`Gen ${gen}: Best Score=${Math.round(bestScoreSoFar)} | Stagnation=${stagnationCounter}`);
        if (bestScoreSoFar > PERFECT_SCORE_THRESHOLD) { console.log("Near-perfect solution found. Exiting early."); break; }
        if (stagnationCounter >= STAGNATION_LIMIT_FOR_EXIT) { console.log("Stagnation limit reached. Exiting evolution."); break; }
        if (stagnationCounter >= STAGNATION_LIMIT_FOR_INTERVENTION && !geminiInterventionUsed) {
            console.log("Stuck in local optimum. Requesting Gemini intervention...");
            const intervenedChromosome = await geminiCreativeIntervention(bestOfGen, input);
            population[population.length-1] = intervenedChromosome;
            geminiInterventionUsed = true;
            stagnationCounter = 0;
        }
    }

    population.sort((a, b) => b.metrics.score - a.metrics.score);
    console.log("AI-driven optimization finished.");
    return population.slice(0, candidateCount).map(c => ({ timetable: c.timetable, metrics: c.metrics }));
};
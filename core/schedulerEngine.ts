import type { Batch, Subject, Faculty, Room, Constraints, TimetableGrid, ClassAssignment, TimetableMetrics, GlobalConstraints, GeneratedTimetable, TimetableFeedback, SingleBatchTimetableGrid } from '../types';
import { isFacultyAvailable, isRoomAvailable, isBatchAvailable } from './conflictChecker';
import { GoogleGenAI, Type } from "@google/genai";

// --- GEMINI API INITIALIZATION ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

interface SchedulerInput {
  batches: Batch[];
  allSubjects: Subject[];
  allFaculty: Faculty[];
  allRooms: Room[];
  approvedTimetables: GeneratedTimetable[];
  constraints: Constraints;
  globalConstraints: GlobalConstraints;
  days: string[];
  slots: string[];
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
enum LowLevelHeuristic {
    SWAP_MUTATE, MOVE_MUTATE, SIMULATED_ANNEALING, DAY_WISE_CROSSOVER,
}

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

// --- FITNESS FUNCTION ---
const calculateMetrics = (
    timetable: TimetableGrid,
    batches: Batch[],
    allFaculty: Faculty[],
    globalConstraints: GlobalConstraints
): TimetableMetrics => {
    let studentGaps = 0;
    let facultyGaps = 0;
    let facultyWorkload: Record<string, number> = {};
    let preferenceViolations = 0;

    const { aiStudentGapWeight, aiFacultyGapWeight, aiFacultyWorkloadDistributionWeight, aiFacultyPreferenceWeight } = globalConstraints;
    const assignments = flattenTimetable(timetable);
    
    for (const batch of batches) {
        for (let day = 0; day < 6; day++) {
            const daySlots = assignments.filter(a => a.batchId === batch.id && a.day === day).map(a => a.slot).sort((a,b) => a - b);
            for (let i = 1; i < daySlots.length; i++) {
                const gap = daySlots[i] - daySlots[i-1] - 1;
                if (gap > 0) studentGaps += gap;
            }
        }
    }
    
    const facultyAssignments: Record<string, ClassAssignment[]> = {};
    for (const assignment of assignments) {
        if (!facultyAssignments[assignment.facultyId]) facultyAssignments[assignment.facultyId] = [];
        facultyAssignments[assignment.facultyId].push(assignment);
        facultyWorkload[assignment.facultyId] = (facultyWorkload[assignment.facultyId] || 0) + 1;
    }

    for (const facId in facultyAssignments) {
        for (let day = 0; day < 6; day++) {
            const daySlots = facultyAssignments[facId].filter(a => a.day === day).map(a => a.slot).sort((a,b) => a - b);
            for (let i = 1; i < daySlots.length; i++) {
                const gap = daySlots[i] - daySlots[i-1] - 1;
                if (gap > 0) facultyGaps += gap;
            }
        }
        const facultyMember = allFaculty.find(f => f.id === facId);
        if (facultyMember?.preferredSlots) {
             for (const assignment of facultyAssignments[facId]) {
                 if (!facultyMember.preferredSlots[assignment.day]?.includes(assignment.slot)) {
                     preferenceViolations++;
                 }
             }
        }
    }

    const loads = Object.values(facultyWorkload);
    const meanLoad = loads.reduce((a, b) => a + b, 0) / (loads.length || 1);
    const facultyWorkloadDistribution = loads.reduce((a, b) => a + Math.pow(b - meanLoad, 2), 0) / (loads.length || 1);

    const score = 1000
        - (studentGaps * aiStudentGapWeight)
        - (facultyGaps * aiFacultyGapWeight)
        - (facultyWorkloadDistribution * aiFacultyWorkloadDistributionWeight)
        - (preferenceViolations * aiFacultyPreferenceWeight);

    return {
        score: Math.round(Math.max(0, score)), hardConflicts: 0, studentGaps, facultyGaps,
        facultyWorkloadDistribution: parseFloat(facultyWorkloadDistribution.toFixed(2)),
        preferenceViolations
    };
};

// --- CORE TYPES ---
type Chromosome = {
    timetable: TimetableGrid;
    metrics: TimetableMetrics;
};
interface ClassRequirement {
    subject: Subject;
    batch: Batch;
}

// --- INITIALIZATION ---
const getRequiredClasses = (batches: Batch[], allSubjects: Subject[]): ClassRequirement[] => {
    return batches.flatMap(batch => 
        allSubjects
            .filter(s => batch.subjectIds.includes(s.id))
            .flatMap(subject => Array(subject.hoursPerWeek).fill({ subject, batch }))
    );
};

const createChromosome = (
    requiredClasses: ClassRequirement[],
    input: Omit<SchedulerInput, 'candidateCount'>
): Chromosome => {
    const { batches, allFaculty, allRooms, constraints, globalConstraints, days, slots, approvedTimetables } = input;
    const timetable: TimetableGrid = {};
    batches.forEach(b => timetable[b.id] = {}); // Initialize grids for all batches
    
    const approvedAssignments = approvedTimetables.flatMap(tt => flattenTimetable(tt.timetable));
    const shuffledClasses = [...requiredClasses].sort(() => Math.random() - 0.5);

    for (const req of shuffledClasses) {
        const potentialSlots = days
            .flatMap((_, dayIndex) => slots.map((_, slotIndex) => ({ day: dayIndex, slot: slotIndex })))
            .sort(() => Math.random() - 0.5);
        
        for (const { day, slot } of potentialSlots) {
            const currentDraftAssignments = flattenTimetable(timetable);
            const allExistingAssignments = [...approvedAssignments, ...currentDraftAssignments];

            // Check if THIS BATCH is available
            if (isBatchAvailable(timetable[req.batch.id], day, slot)) {
                
                const batchFacultyPool = (req.batch.allocatedFacultyIds && req.batch.allocatedFacultyIds.length > 0)
                    ? allFaculty.filter(f => req.batch.allocatedFacultyIds!.includes(f.id))
                    : allFaculty;

                const batchRoomPool = (req.batch.allocatedRoomIds && req.batch.allocatedRoomIds.length > 0)
                    ? allRooms.filter(r => req.batch.allocatedRoomIds!.includes(r.id))
                    : allRooms;
                
                const suitableFaculty = batchFacultyPool.filter(f => 
                    f.subjectIds.includes(req.subject.id) &&
                    isFacultyAvailable(f.id, day, slot, allExistingAssignments, constraints.facultyAvailability)
                );
                const suitableRooms = batchRoomPool.filter(r =>
                    isRoomAvailable(r.id, day, slot, req.batch, req.subject, r, allExistingAssignments)
                );

                if (suitableFaculty.length > 0 && suitableRooms.length > 0) {
                    const assignment: ClassAssignment = { 
                        id: generateId(), batchId: req.batch.id, subjectId: req.subject.id, 
                        facultyId: suitableFaculty[Math.floor(Math.random() * suitableFaculty.length)].id, 
                        roomId: suitableRooms[Math.floor(Math.random() * suitableRooms.length)].id, 
                        day, slot 
                    };
                    
                    const batchGrid = timetable[req.batch.id];
                    if (!batchGrid[day]) batchGrid[day] = {};
                    batchGrid[day][slot] = assignment;
                    break;
                }
            }
        }
    }
    return { timetable, metrics: calculateMetrics(timetable, batches, allFaculty, globalConstraints) };
};


// --- ADVANCED OPERATOR: GREEDY REPAIR ---
const greedyRepair = (
    chromosome: Chromosome, 
    requiredClasses: ClassRequirement[], 
    input: Omit<SchedulerInput, 'candidateCount'>
): Chromosome => {
    const { batches, allFaculty, allRooms, constraints, globalConstraints, days, slots, approvedTimetables } = input;
    let timetable: TimetableGrid = JSON.parse(JSON.stringify(chromosome.timetable));
    const approvedAssignments = approvedTimetables.flatMap(tt => flattenTimetable(tt.timetable));

    const classCounts: Record<string, number> = {};
    flattenTimetable(timetable).forEach(a => {
        const key = `${a.batchId}-${a.subjectId}`;
        classCounts[key] = (classCounts[key] || 0) + 1;
    });

    const requiredCounts: Record<string, number> = {};
    requiredClasses.forEach(r => {
        const key = `${r.batch.id}-${r.subject.id}`;
        requiredCounts[key] = (requiredCounts[key] || 0) + 1;
    });

    const missingClasses: ClassRequirement[] = [];
    for (const key in requiredCounts) {
        const missingCount = requiredCounts[key] - (classCounts[key] || 0);
        if (missingCount > 0) {
            const [batchId, subjectId] = key.split('-');
            const batch = batches.find(b => b.id === batchId)!;
            const subject = input.allSubjects.find(s => s.id === subjectId)!;
            for (let i = 0; i < missingCount; i++) {
                missingClasses.push({ batch, subject });
            }
        }
    }

    if (missingClasses.length === 0) return chromosome;

    // Intelligent placement for missing classes
    for (const req of missingClasses) {
        const potentialSlots = days
            .flatMap((_, dayIndex) => slots.map((_, slotIndex) => ({ day: dayIndex, slot: slotIndex })))
            .filter(({ day, slot }) => isBatchAvailable(timetable[req.batch.id], day, slot));
            
        let bestSlot: { day: number; slot: number } | null = null;
        
        const batchFacultyPool = (req.batch.allocatedFacultyIds && req.batch.allocatedFacultyIds.length > 0)
            ? allFaculty.filter(f => req.batch.allocatedFacultyIds!.includes(f.id))
            : allFaculty;

        const batchRoomPool = (req.batch.allocatedRoomIds && req.batch.allocatedRoomIds.length > 0)
            ? allRooms.filter(r => req.batch.allocatedRoomIds!.includes(r.id))
            : allRooms;
       
        for (const { day, slot } of potentialSlots) {
             const allAssignments = [...approvedAssignments, ...flattenTimetable(timetable)];
            const suitableFaculty = batchFacultyPool.filter(f => f.subjectIds.includes(req.subject.id) && isFacultyAvailable(f.id, day, slot, allAssignments, constraints.facultyAvailability));
            const suitableRooms = batchRoomPool.filter(r => isRoomAvailable(r.id, day, slot, req.batch, req.subject, r, allAssignments));
            
            if (suitableFaculty.length > 0 && suitableRooms.length > 0) {
                bestSlot = { day, slot };
                break;
            }
        }

        if (bestSlot) {
            const { day, slot } = bestSlot;
            const allAssignments = [...approvedAssignments, ...flattenTimetable(timetable)];
            const suitableFaculty = batchFacultyPool.filter(f => f.subjectIds.includes(req.subject.id) && isFacultyAvailable(f.id, day, slot, allAssignments, constraints.facultyAvailability));
            const suitableRooms = batchRoomPool.filter(r => isRoomAvailable(r.id, day, slot, req.batch, req.subject, r, allAssignments));
            
            const assignment: ClassAssignment = { 
                id: generateId(), batchId: req.batch.id, subjectId: req.subject.id, 
                facultyId: suitableFaculty[0].id, roomId: suitableRooms[0].id, day, slot
            };
            const batchGrid = timetable[req.batch.id];
            if (!batchGrid[day]) batchGrid[day] = {};
            batchGrid[day][slot] = assignment;
        }
    }

    return { timetable, metrics: calculateMetrics(timetable, batches, allFaculty, globalConstraints) };
};


// --- GEMINI AI INTEGRATION (THREE LEVELS) ---

const getHistoricalFeedbackSummary = (approvedTimetables: GeneratedTimetable[], allFaculty: Faculty[]): string => { /* ... (no changes) ... */ return ""; };

export const tuneConstraintWeightsWithGemini = async (baseConstraints: GlobalConstraints, allFeedback: TimetableFeedback[], allFaculty: Faculty[]): Promise<GlobalConstraints> => { /* ... (no changes) ... */ return baseConstraints; };

/**
 * NEW LEVEL 2: AI Phase Strategist (Single, Fast API Call)
 * Devises a complete multi-phase strategy for the entire optimization run.
 */
interface AIPhaseStrategy {
    exploration: Record<keyof typeof LowLevelHeuristic, number>;
    exploitation: Record<keyof typeof LowLevelHeuristic, number>;
    refinement: Record<keyof typeof LowLevelHeuristic, number>;
}
const getGeminiPhaseStrategy = async (input: Omit<SchedulerInput, 'candidateCount'>): Promise<AIPhaseStrategy> => {
    const problemSummary = `The problem involves scheduling for ${input.batches.length} batches. Key metrics to optimize are minimizing student/faculty gaps and balancing faculty workload.`;
    const feedbackSummary = getHistoricalFeedbackSummary(input.approvedTimetables, input.allFaculty);

    const prompt = `
You are a master AI strategist for a genetic algorithm that optimizes university timetables. Your task is to devise a high-level, three-phase strategy for the entire run. The algorithm has ${MAX_GENERATIONS} generations.

The available genetic operators are:
- DAY_WISE_CROSSOVER: Good for large-scale exploration by mixing timetables.
- MOVE_MUTATE: Good for small adjustments and exploring new possibilities.
- SWAP_MUTATE: Good for fine-tuning existing structures.
- SIMULATED_ANNEALING: A powerful but computationally expensive operator for deep refinement and escaping local optima.

Define the operator probability distribution (summing to 100) for each of the three phases:
1.  **Exploration (Generations 1-5):** Focus on broad search. Prioritize Crossover and Move Mutate.
2.  **Exploitation (Generations 6-15):** Focus on improving the best solutions. Increase Simulated Annealing and Swap Mutate.
3.  **Refinement (Generations 16-25):** Focus on fine-tuning the elite solutions. Heavily prioritize Simulated Annealing.

Here is the context: ${problemSummary}. ${feedbackSummary}.

Based on this, provide the optimal probability distribution for each phase.
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: "You are an expert meta-heuristic strategist. Respond ONLY with the JSON object defining the strategy.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT, properties: {
                        exploration: { type: Type.OBJECT, properties: { DAY_WISE_CROSSOVER: { type: Type.INTEGER }, MOVE_MUTATE: { type: Type.INTEGER }, SWAP_MUTATE: { type: Type.INTEGER }, SIMULATED_ANNEALING: { type: Type.INTEGER } } },
                        exploitation: { type: Type.OBJECT, properties: { DAY_WISE_CROSSOVER: { type: Type.INTEGER }, MOVE_MUTATE: { type: Type.INTEGER }, SWAP_MUTATE: { type: Type.INTEGER }, SIMULATED_ANNEALING: { type: Type.INTEGER } } },
                        refinement: { type: Type.OBJECT, properties: { DAY_WISE_CROSSOVER: { type: Type.INTEGER }, MOVE_MUTATE: { type: Type.INTEGER }, SWAP_MUTATE: { type: Type.INTEGER }, SIMULATED_ANNEALING: { type: Type.INTEGER } } },
                    }, required: ["exploration", "exploitation", "refinement"]
                }
            }
        });
        const strategy = JSON.parse(response.text.trim());
        console.log("Gemini AI has devised a multi-phase strategy:", strategy);
        return strategy;
    } catch (error) {
        console.error("Error getting Gemini strategy, falling back to default:", error);
        return { // Default strategy on error
            exploration: { DAY_WISE_CROSSOVER: 50, MOVE_MUTATE: 40, SWAP_MUTATE: 10, SIMULATED_ANNEALING: 0 },
            exploitation: { DAY_WISE_CROSSOVER: 20, MOVE_MUTATE: 20, SWAP_MUTATE: 30, SIMULATED_ANNEALING: 30 },
            refinement: { DAY_WISE_CROSSOVER: 5, MOVE_MUTATE: 5, SWAP_MUTATE: 20, SIMULATED_ANNEALING: 70 },
        };
    }
};

/**
 * LEVEL 3: Creative Intervention (Unchanged)
 */
const geminiCreativeIntervention = async (stuckChromosome: Chromosome, input: Omit<SchedulerInput, 'candidateCount'>): Promise<Chromosome> => { /* ... (no changes) ... */ return stuckChromosome; };


// --- LOW-LEVEL HEURISTICS ---
const tournamentSelection = (population: Chromosome[]): Chromosome => { /* ... (no changes) ... */ let best: Chromosome | null = null; for (let i = 0; i < TOURNAMENT_SIZE; i++) { const ind = population[Math.floor(Math.random() * population.length)]; if (best === null || ind.metrics.score > best.metrics.score) best = ind; } return best!; };

const swapMutate = (chromosome: Chromosome, input: Omit<SchedulerInput, 'candidateCount'>): Chromosome => {
    const { batches, allFaculty, globalConstraints } = input;
    const timetable = JSON.parse(JSON.stringify(chromosome.timetable)) as TimetableGrid;
    
    // Select a random batch that has at least two classes to swap
    const batchIdsWithClasses = Object.keys(timetable).filter(bId => flattenTimetable({[bId]: timetable[bId]}).length >= 2);
    if (batchIdsWithClasses.length === 0) return chromosome;
    const batchIdToMutate = batchIdsWithClasses[Math.floor(Math.random() * batchIdsWithClasses.length)];
    const batchGrid = timetable[batchIdToMutate];

    const assignments = Object.values(batchGrid).flatMap(d => Object.values(d));
    const as1 = assignments[Math.floor(Math.random() * assignments.length)];
    const as2 = assignments[Math.floor(Math.random() * assignments.length)];

    if (as1.id === as2.id) return chromosome;

    // Swap positions
    const tempDay = as1.day, tempSlot = as1.slot;
    batchGrid[as1.day][as1.slot] = { ...as2, day: as1.day, slot: as1.slot };
    batchGrid[as2.day][as2.slot] = { ...as1, day: as2.day, slot: as2.slot };

    return { timetable, metrics: calculateMetrics(timetable, batches, allFaculty, globalConstraints) };
};

const moveMutate = (chromosome: Chromosome, input: Omit<SchedulerInput, 'candidateCount'>): Chromosome => {
    const { batches, allFaculty, globalConstraints, days, slots } = input;
    const timetable = JSON.parse(JSON.stringify(chromosome.timetable)) as TimetableGrid;

    const batchIdsWithClasses = Object.keys(timetable).filter(bId => flattenTimetable({[bId]: timetable[bId]}).length > 0);
    if (batchIdsWithClasses.length === 0) return chromosome;
    const batchIdToMutate = batchIdsWithClasses[Math.floor(Math.random() * batchIdsWithClasses.length)];
    const batchGrid = timetable[batchIdToMutate];

    const assignments = Object.values(batchGrid).flatMap(d => Object.values(d));
    const toMove = assignments[Math.floor(Math.random() * assignments.length)];
    
    const potentialSlots = days.flatMap((_, d) => slots.map((_, s) => ({ day: d, slot: s })))
        .filter(p => !batchGrid[p.day] || !batchGrid[p.day][p.slot]);

    if (potentialSlots.length === 0) return chromosome;

    const { day: newDay, slot: newSlot } = potentialSlots[Math.floor(Math.random() * potentialSlots.length)];
    
    delete batchGrid[toMove.day][toMove.slot];
    toMove.day = newDay;
    toMove.slot = newSlot;

    if (!batchGrid[newDay]) batchGrid[newDay] = {};
    batchGrid[newDay][newSlot] = toMove;

    return { timetable, metrics: calculateMetrics(timetable, batches, allFaculty, globalConstraints) };
};

const dayWiseCrossover = (p1: Chromosome, p2: Chromosome, input: Omit<SchedulerInput, 'candidateCount'>, reqs: ClassRequirement[]): Chromosome => {
    const { batches, days } = input;
    const offspringTimetable: TimetableGrid = {};
    batches.forEach(b => offspringTimetable[b.id] = {});

    for (const batch of batches) {
        const batchId = batch.id;
        const p1Grid = p1.timetable[batchId] || {};
        const p2Grid = p2.timetable[batchId] || {};
        const offspringBatchGrid: SingleBatchTimetableGrid = {};

        for (let day = 0; day < days.length; day++) {
            if (Math.random() < 0.5) {
                if (p1Grid[day]) offspringBatchGrid[day] = JSON.parse(JSON.stringify(p1Grid[day]));
            } else {
                if (p2Grid[day]) offspringBatchGrid[day] = JSON.parse(JSON.stringify(p2Grid[day]));
            }
        }
        offspringTimetable[batchId] = offspringBatchGrid;
    }

    const child = { timetable: offspringTimetable, metrics: { score: -1 } as any };
    return greedyRepair(child, reqs, input);
};

const simulatedAnnealingOperator = (chromosome: Chromosome, input: Omit<SchedulerInput, 'candidateCount'>): Chromosome => { /* ... (no changes) ... */ let current = JSON.parse(JSON.stringify(chromosome)); let best = JSON.parse(JSON.stringify(chromosome)); let temp = SA_INITIAL_TEMPERATURE; while (temp > SA_MIN_TEMPERATURE) { for (let i = 0; i < SA_ITERATIONS_PER_TEMP; i++) { const neighbor = moveMutate(current, input); if (neighbor.metrics.score > current.metrics.score || Math.random() < Math.exp((neighbor.metrics.score - current.metrics.score) / temp)) { current = neighbor; if (neighbor.metrics.score > best.metrics.score) best = neighbor; } } temp *= SA_COOLING_RATE; } return best; };

// Helper to select a heuristic based on weighted probabilities
const selectHeuristic = (phaseProbabilities: Record<string, number>): LowLevelHeuristic => {
    const rand = Math.random() * 100;
    let cumulative = 0;
    for (const key in phaseProbabilities) {
        cumulative += phaseProbabilities[key];
        if (rand < cumulative) {
            return LowLevelHeuristic[key as keyof typeof LowLevelHeuristic];
        }
    }
    return LowLevelHeuristic.MOVE_MUTATE; // Fallback
};

/**
 * Main optimization function, now using a pre-emptive AI strategy for speed.
 */
export const runOptimization = async (input: SchedulerInput): Promise<{ timetable: TimetableGrid, metrics: TimetableMetrics }[]> => {
    const { candidateCount, batches, allSubjects } = input;
    const requiredClasses = getRequiredClasses(batches, allSubjects);
    
    // --- SINGLE, UPFRONT AI STRATEGY CALL ---
    console.log("Consulting Gemini AI for a high-level optimization strategy...");
    const aiStrategy = await getGeminiPhaseStrategy(input);
    
    console.log("Initializing population...");
    let population: Chromosome[] = Array.from({ length: POPULATION_SIZE }, () => createChromosome(requiredClasses, input));

    let bestScoreSoFar = -Infinity;
    let stagnationCounter = 0;
    let geminiInterventionUsed = false;

    for (let gen = 0; gen < MAX_GENERATIONS; gen++) {
        population.sort((a, b) => b.metrics.score - a.metrics.score);
        const bestCurrentScore = population[0].metrics.score;
        console.log(`Evolving Gen ${gen + 1}/${MAX_GENERATIONS} | Best Score: ${bestCurrentScore} | Stagnation: ${stagnationCounter}/${STAGNATION_LIMIT_FOR_EXIT}`);
        
        if (bestCurrentScore >= PERFECT_SCORE_THRESHOLD) { break; }
        if (bestCurrentScore > bestScoreSoFar) { bestScoreSoFar = bestCurrentScore; stagnationCounter = 0; } else { stagnationCounter++; }
        if (stagnationCounter >= STAGNATION_LIMIT_FOR_EXIT) { break; }

        if (!geminiInterventionUsed && stagnationCounter >= STAGNATION_LIMIT_FOR_INTERVENTION) {
            console.log("Stagnation detected! Requesting Gemini creative intervention...");
            geminiInterventionUsed = true;
            const perturbedIndividual = await geminiCreativeIntervention(population[0], input);
            population[population.length - 1] = perturbedIndividual;
            stagnationCounter = 0;
        }
        
        // --- EXECUTE THE PRE-DEFINED AI STRATEGY ---
        let currentPhaseProbabilities;
        if (gen < 5) currentPhaseProbabilities = aiStrategy.exploration;
        else if (gen < 15) currentPhaseProbabilities = aiStrategy.exploitation;
        else currentPhaseProbabilities = aiStrategy.refinement;

        const newPopulation: Chromosome[] = population.slice(0, ELITISM_COUNT);
        
        while (newPopulation.length < POPULATION_SIZE) {
            const heuristicToUse = selectHeuristic(currentPhaseProbabilities);
            let newIndividual: Chromosome;
            switch (heuristicToUse) {
                case LowLevelHeuristic.DAY_WISE_CROSSOVER: newIndividual = dayWiseCrossover(tournamentSelection(population), tournamentSelection(population), input, requiredClasses); break;
                case LowLevelHeuristic.SWAP_MUTATE: newIndividual = swapMutate(tournamentSelection(population), input); break;
                case LowLevelHeuristic.MOVE_MUTATE: newIndividual = moveMutate(tournamentSelection(population), input); break;
                case LowLevelHeuristic.SIMULATED_ANNEALING: newIndividual = simulatedAnnealingOperator(tournamentSelection(population), input); break;
            }
            newPopulation.push(newIndividual);
        }
        population = newPopulation;
    }

    population.sort((a, b) => b.metrics.score - a.metrics.score);
    console.log("AI-driven optimization finished.");
    return population.slice(0, candidateCount).map(c => ({ timetable: c.timetable, metrics: c.metrics }));
};
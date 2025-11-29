

import type { Batch, Subject, Faculty, Room, Constraints, TimetableGrid, ClassAssignment, TimetableMetrics, GlobalConstraints, GeneratedTimetable, TimetableFeedback, SingleBatchTimetableGrid, TimetableSettings, PinnedAssignment, FacultyAllocation, DiagnosticIssue } from '../types';
import { isFacultyAvailable, isRoomAvailable, isBatchAvailable } from './conflictChecker';
import { GoogleGenAI, Type, type GenerateContentResponse } from "@google/genai";
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
  // FIX: Added optional baseTimetable property to satisfy the API call.
  baseTimetable?: TimetableGrid;
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
            const daySlots = batchGrid[day] ? Object.keys(batchGrid[day]).map(Number).sort((a,b)=>a-b) : [];
            if (daySlots.length > 1) {
                for (let i = 0; i < daySlots.length - 1; i++) {
                    studentGaps += (daySlots[i+1] - daySlots[i] - 1);
                }
            }
        }
    }

    // Faculty Gaps & Workload
    const facultyWorkload: Record<string, number> = {};
    const allAssignments = flattenTimetable(timetable);
    for(const facultyMember of allFaculty) {
        facultyWorkload[facultyMember.id] = 0;
        for (let day = 0; day < 6; day++) {
            const daySlots = allAssignments
                .filter(a => a.day === day && a.facultyIds.includes(facultyMember.id))
                .map(a => a.slot)
                .sort((a,b) => a-b);
            
            facultyWorkload[facultyMember.id] += daySlots.length;
            
            if (daySlots.length > 1) {
                for (let i = 0; i < daySlots.length - 1; i++) {
                    facultyGaps += (daySlots[i+1] - daySlots[i] - 1);
                }
            }
            
            if (facultyMember.preferredSlots) {
                for (const slot of daySlots) {
                    if (!facultyMember.preferredSlots[day]?.includes(slot)) {
                        preferenceViolations++;
                    }
                }
            }
        }
    }

    // Faculty Workload Distribution
    const workloads = Object.values(facultyWorkload);
    if (workloads.length > 1) {
        const mean = workloads.reduce((a, b) => a + b, 0) / workloads.length;
        const variance = workloads.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / workloads.length;
        var facultyWorkloadDistribution = Math.sqrt(variance);
    } else {
        var facultyWorkloadDistribution = 0;
    }
    
    const gc = globalConstraints;
    // Calculate score (higher is better)
    const score = 1000 
        - (studentGaps * gc.aiStudentGapWeight)
        - (facultyGaps * gc.aiFacultyGapWeight)
        - (facultyWorkloadDistribution * gc.aiFacultyWorkloadDistributionWeight)
        - (preferenceViolations * gc.aiFacultyPreferenceWeight);

    return {
        score: Math.max(0, score),
        hardConflicts: 0, // Hard conflicts are resolved during generation, so this is 0
        studentGaps,
        facultyGaps,
        facultyWorkloadDistribution,
        preferenceViolations,
    };
};


// --- GEMINI-POWERED FUNCTIONS ---

/**
 * [NEW] Checks for common data integrity issues before running the scheduler.
 */
export const runPreflightDiagnostics = async (input: {
    batches: Batch[];
    allSubjects: Subject[];
    allFaculty: Faculty[];
    allRooms: Room[];
    facultyAllocations: FacultyAllocation[];
}): Promise<DiagnosticIssue[]> => {
    const { batches, allSubjects, allFaculty, facultyAllocations } = input;
    const issues: DiagnosticIssue[] = [];

    // Check 1: Subjects without teachers
    const facultySubjectIds = new Set(allFaculty.flatMap(f => f.subjectIds));
    allSubjects.forEach(subject => {
        if (!facultySubjectIds.has(subject.id)) {
            issues.push({
                severity: 'warning',
                title: 'Unassigned Subject',
                description: `The subject "${subject.name}" (${subject.code}) is not assigned to any faculty member.`,
                suggestion: `Go to Data Management > Faculty and assign this subject to at least one faculty member.`
            });
        }
    });

    // Check 2: Batches with subjects that have no qualified teachers
    batches.forEach(batch => {
        batch.subjectIds.forEach(subjectId => {
            const subject = allSubjects.find(s => s.id === subjectId);
            if (!subject) return;

            const specificAllocation = facultyAllocations.find(fa => fa.batchId === batch.id && fa.subjectId === subjectId);
            if (specificAllocation && specificAllocation.facultyIds.length > 0) {
                return; // Has a specific teacher, so it's fine.
            }

            const hasQualifiedFaculty = allFaculty.some(f => f.subjectIds.includes(subjectId));
            if (!hasQualifiedFaculty) {
                 issues.push({
                    severity: 'critical',
                    title: 'No Qualified Faculty',
                    description: `The subject "${subject.name}" required by batch "${batch.name}" has no faculty qualified to teach it.`,
                    suggestion: `Assign a faculty member to teach "${subject.code}" or remove it from the batch's curriculum.`
                });
            }
        });
    });

    // Check 3: Faculty without subjects
    allFaculty.forEach(faculty => {
        if (faculty.subjectIds.length === 0) {
            issues.push({
                severity: 'warning',
                title: 'Faculty Without Subjects',
                description: `Faculty member "${faculty.name}" is not assigned to teach any subjects.`,
                suggestion: `Assign subjects to this faculty member or remove them if they are no longer active.`
            });
        }
    });

    return issues;
};

/**
 * [GEMINI] Analyzes faculty feedback to tune the weights of soft constraints.
 */
export const tuneConstraintWeightsWithGemini = async (
    baseConstraints: GlobalConstraints,
    feedback: TimetableFeedback[],
    allFaculty: Faculty[]
): Promise<GlobalConstraints> => {
    if (feedback.length < 3) { // Not enough data to tune
        return { ...baseConstraints };
    }

    try {
        const feedbackSummary = feedback.map(f => {
            const facultyName = allFaculty.find(fac => fac.id === f.facultyId)?.name || 'Unknown Faculty';
            return `- Faculty ${facultyName} gave a rating of ${f.rating}/5. Comment: ${f.comment || 'N/A'}`;
        }).join('\n');

        const prompt = `
            You are an expert university administrator tuning a timetable scheduling algorithm.
            The algorithm uses weighted constraints to score timetables. Higher weights mean a higher penalty.
            
            Current Base Weights:
            - Student Gap Weight: ${baseConstraints.studentGapWeight}
            - Faculty Gap Weight: ${baseConstraints.facultyGapWeight}
            - Faculty Workload Variance Weight: ${baseConstraints.facultyWorkloadDistributionWeight}
            - Faculty Preference Violation Weight: ${baseConstraints.facultyPreferenceWeight}

            Recent feedback from faculty on approved timetables:
            ${feedbackSummary}

            Based on this feedback, suggest adjusted weights to improve faculty satisfaction in the future.
            For example, if faculty complain about gaps, increase the faculty gap weight. If they seem generally happy, you can keep the weights stable.
            Provide your response as a JSON object with the keys "studentGapWeight", "facultyGapWeight", "facultyWorkloadDistributionWeight", and "facultyPreferenceWeight".
            Do not change weights drastically. Make subtle adjustments.
        `;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        studentGapWeight: { type: Type.INTEGER },
                        facultyGapWeight: { type: Type.INTEGER },
                        facultyWorkloadDistributionWeight: { type: Type.INTEGER },
                        facultyPreferenceWeight: { type: Type.INTEGER },
                    },
                },
            },
        });

        const tunedWeights = JSON.parse(response.text);

        console.log('Gemini tuned weights:', tunedWeights);

        return {
            ...baseConstraints,
            aiStudentGapWeight: tunedWeights.studentGapWeight,
            aiFacultyGapWeight: tunedWeights.facultyGapWeight,
            aiFacultyWorkloadDistributionWeight: tunedWeights.facultyWorkloadDistributionWeight,
            aiFacultyPreferenceWeight: tunedWeights.facultyPreferenceWeight,
        };
    } catch (error) {
        console.error("Gemini weight tuning failed:", error);
        // Fallback to base constraints if Gemini fails
        return { 
            ...baseConstraints,
            aiStudentGapWeight: baseConstraints.studentGapWeight,
            aiFacultyGapWeight: baseConstraints.facultyGapWeight,
            aiFacultyWorkloadDistributionWeight: baseConstraints.facultyWorkloadDistributionWeight,
            aiFacultyPreferenceWeight: baseConstraints.facultyPreferenceWeight,
        };
    }
};

interface Phase {
    generations: number;
    heuristicEnumMap: Map<LowLevelHeuristic, number>;
}

/**
 * [GEMINI] Creates a custom, multi-phase strategy for the genetic algorithm.
 */
const getGeminiPhaseStrategy = async (problemSummary: {
    numBatches: number;
    numClasses: number;
    numFaculty: number;
    numRooms: number;
    numConstraints: number;
}): Promise<Phase[]> => {
    try {
        const prompt = `
            You are an expert in hyper-heuristics for solving complex optimization problems like university timetabling.
            I need a multi-phase strategy for a genetic algorithm. The total number of generations should be around ${MAX_GENERATIONS}.
            
            Problem Details:
            - Batches to schedule: ${problemSummary.numBatches}
            - Total classes to place: ${problemSummary.numClasses}
            - Available Faculty: ${problemSummary.numFaculty}
            - Available Rooms: ${problemSummary.numRooms}
            - Pinned constraints: ${problemSummary.numConstraints}

            Available low-level heuristics are: SWAP_MUTATE, MOVE_MUTATE, SIMULATED_ANNEALING, DAY_WISE_CROSSOVER.

            Design a strategy with 2-4 phases. Each phase should specify:
            1. 'generations': How many generations this phase should last.
            2. 'heuristics': An object where keys are the heuristic names and values are their selection probabilities (must sum to 1.0 for the phase).

            - Early phases should focus on exploration (e.g., higher crossover and move mutations).
            - Later phases should focus on exploitation/refinement (e.g., higher swap mutations and simulated annealing).

            Provide the response as a JSON array of phase objects.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            generations: { type: Type.INTEGER },
                            heuristics: {
                                type: Type.OBJECT,
                                properties: {
                                    SWAP_MUTATE: { type: Type.NUMBER },
                                    MOVE_MUTATE: { type: Type.NUMBER },
                                    SIMULATED_ANNEALING: { type: Type.NUMBER },
                                    DAY_WISE_CROSSOVER: { type: Type.NUMBER },
                                },
                                required: ["SWAP_MUTATE", "MOVE_MUTATE", "SIMULATED_ANNEALING", "DAY_WISE_CROSSOVER"]
                            }
                        },
                        required: ["generations", "heuristics"]
                    }
                },
            },
        });

        const strategy = JSON.parse(response.text);
        console.log('Gemini generated strategy:', strategy);
        
        if (Array.isArray(strategy) && strategy.length > 0 && strategy[0].generations) {
            return strategy.map((phase: any) => ({
                generations: phase.generations,
                heuristicEnumMap: new Map([
                    [LowLevelHeuristic.SWAP_MUTATE, phase.heuristics.SWAP_MUTATE],
                    [LowLevelHeuristic.MOVE_MUTATE, phase.heuristics.MOVE_MUTATE],
                    [LowLevelHeuristic.SIMULATED_ANNEALING, phase.heuristics.SIMULATED_ANNEALING],
                    [LowLevelHeuristic.DAY_WISE_CROSSOVER, phase.heuristics.DAY_WISE_CROSSOVER],
                ])
            }));
        }
    } catch (error) {
        console.error("Gemini strategy generation failed:", error);
    }
    
    console.log("Falling back to default strategy.");
    const defaultStrategy: Phase[] = [
        { generations: 10, heuristicEnumMap: new Map([[LowLevelHeuristic.DAY_WISE_CROSSOVER, 0.5], [LowLevelHeuristic.MOVE_MUTATE, 0.4], [LowLevelHeuristic.SWAP_MUTATE, 0.1], [LowLevelHeuristic.SIMULATED_ANNEALING, 0.0]]) },
        { generations: 10, heuristicEnumMap: new Map([[LowLevelHeuristic.DAY_WISE_CROSSOVER, 0.2], [LowLevelHeuristic.MOVE_MUTATE, 0.2], [LowLevelHeuristic.SWAP_MUTATE, 0.5], [LowLevelHeuristic.SIMULATED_ANNEALING, 0.1]]) },
        { generations: 5, heuristicEnumMap: new Map([[LowLevelHeuristic.DAY_WISE_CROSSOVER, 0.0], [LowLevelHeuristic.MOVE_MUTATE, 0.1], [LowLevelHeuristic.SWAP_MUTATE, 0.4], [LowLevelHeuristic.SIMULATED_ANNEALING, 0.5]]) },
    ];
    return defaultStrategy;
};


/**
 * [GEMINI] When the algorithm stagnates, this function asks Gemini for a creative swap to escape the local optimum.
 */
const geminiCreativeIntervention = async (
    timetable: TimetableGrid,
    allSubjects: Subject[],
    allFaculty: Faculty[],
    allRooms: Room[],
    allBatches: Batch[],
    days: string[]
): Promise<[ClassAssignment, ClassAssignment] | null> => {
    try {
        const assignments = flattenTimetable(timetable);
        const assignmentDetails = assignments.map(a => {
            const subject = allSubjects.find(s => s.id === a.subjectId)?.code || '???';
            const batch = allBatches.find(b => b.id === a.batchId)?.name || '???';
            const day = days[a.day];
            return `ID: ${a.id}, Class: ${subject} for ${batch} on ${day} at slot ${a.slot}`;
        }).join('\n');

        const prompt = `
            You are an expert scheduler providing a creative intervention to a stuck genetic algorithm.
            The algorithm is optimizing a university timetable but the fitness score has stagnated.
            It needs a creative, non-obvious swap of two classes to escape the local optimum.

            Here is a list of all class assignments in the current best timetable:
            ${assignmentDetails}

            Analyze the schedule and identify two classes to swap. A good swap might involve moving classes between different days or between batches that share some subjects, to break structural deadlocks.
            Provide your response as a JSON object containing the IDs of the two classes to swap, with keys "classId1" and "classId2".
        `;

        const INTERVENTION_TIMEOUT_MS = 15000; // 15 seconds

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Gemini intervention timed out after ${INTERVENTION_TIMEOUT_MS}ms`)), INTERVENTION_TIMEOUT_MS)
        );

        const geminiPromise = ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        classId1: { type: Type.STRING },
                        classId2: { type: Type.STRING },
                    },
                    required: ["classId1", "classId2"],
                },
            },
        });

        const response = await Promise.race([geminiPromise, timeoutPromise]) as GenerateContentResponse;
        
        const { classId1, classId2 } = JSON.parse(response.text);

        const assignment1 = assignments.find(a => a.id === classId1);
        const assignment2 = assignments.find(a => a.id === classId2);

        if (assignment1 && assignment2) {
            console.log(`Gemini intervention: Swapping ${assignment1.id} and ${assignment2.id}`);
            return [assignment1, assignment2];
        }

        console.warn("Gemini intervention failed: could not find suggested classes.", { classId1, classId2 });
        return null;

    } catch (error) {
        console.error("Gemini creative intervention failed (or timed out):", error);
        return null;
    }
};

/**
 * [NEW] Helper for NLC to find an assignment based on subject code and batch name.
 */
const findAssignmentByDetails = (timetable: TimetableGrid, subjectCode: string, batchName: string, allSubjects: Subject[], allBatches: Batch[]): ClassAssignment | null => {
    const subject = allSubjects.find(s => s.code.toLowerCase() === subjectCode.toLowerCase());
    const batch = allBatches.find(b => b.name.toLowerCase() === batchName.toLowerCase());
    if (!subject || !batch) return null;

    const batchGrid = timetable[batch.id];
    if (!batchGrid) return null;

    // Find the first occurrence of this class for the batch
    for (const day in batchGrid) {
        for (const slot in batchGrid[day]) {
            const assignment = batchGrid[day][slot];
            if (assignment.subjectId === subject.id) {
                return assignment;
            }
        }
    }
    return null;
};

/**
 * [NEW & GEMINI] Applies a natural language command to modify a timetable.
 */
export const applyNaturalLanguageCommand = async (
    timetable: TimetableGrid,
    command: string,
    allSubjects: Subject[],
    allFaculty: Faculty[],
    allBatches: Batch[],
    days: string[],
    settings: TimetableSettings
): Promise<TimetableGrid> => {
    const timeSlots = generateTimeSlots(settings);
    const assignments = flattenTimetable(timetable);

    const assignmentDetails = assignments.map(a => {
        const subject = allSubjects.find(s => s.id === a.subjectId)?.code || '???';
        const batch = allBatches.find(b => b.id === a.batchId)?.name || '???';
        const day = days[a.day];
        const time = timeSlots[a.slot] || `Slot ${a.slot}`;
        return `Class: ${subject} for ${batch} is on ${day} at ${time}`;
    }).join('\n');

    const prompt = `
        You are an intelligent assistant modifying a university timetable.
        Based on the user's command, you must determine the action ("swap" or "move") and the parameters.

        Available Days: ${days.join(', ')}
        Available Time Slots: ${timeSlots.map((ts, i) => `Slot ${i}: ${ts}`).join('; ')}

        Current Timetable Assignments:
        ${assignmentDetails}

        User Command: "${command}"

        Parse the user's command and identify the action.
        - If the action is "swap", identify the two classes to be swapped.
        - If the action is "move", identify the class to be moved and the target day and slot index.
        - A class is identified by its subject code and batch name.
        
        Return a JSON object describing the action.
        For "swap", use schema: { "action": "swap", "class1_subject_code": string, "class1_batch_name": string, "class2_subject_code": string, "class2_batch_name": string }
        For "move", use schema: { "action": "move", "class_subject_code": string, "class_batch_name": string, "target_day": string, "target_slot_index": integer }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            },
        });

        const parsed = JSON.parse(response.text);
        const newTimetable = JSON.parse(JSON.stringify(timetable));

        if (parsed.action === 'swap') {
            const assignment1 = findAssignmentByDetails(timetable, parsed.class1_subject_code, parsed.class1_batch_name, allSubjects, allBatches);
            const assignment2 = findAssignmentByDetails(timetable, parsed.class2_subject_code, parsed.class2_batch_name, allSubjects, allBatches);

            if (!assignment1 || !assignment2) {
                throw new Error("AI could not identify one or both of the classes to swap.");
            }
            
            // Perform the swap
            const batchGrid1 = newTimetable[assignment1.batchId];
            const batchGrid2 = newTimetable[assignment2.batchId];
            batchGrid1[assignment1.day][assignment1.slot] = { ...assignment2, day: assignment1.day, slot: assignment1.slot };
            batchGrid2[assignment2.day][assignment2.slot] = { ...assignment1, day: assignment2.day, slot: assignment2.slot };

        } else if (parsed.action === 'move') {
            const assignment = findAssignmentByDetails(timetable, parsed.class_subject_code, parsed.class_batch_name, allSubjects, allBatches);
            if (!assignment) {
                throw new Error("AI could not identify the class to move.");
            }
            const targetDayIndex = days.findIndex(d => d.toLowerCase() === parsed.target_day.toLowerCase());
            const targetSlotIndex = parsed.target_slot_index;

            if (targetDayIndex === -1 || targetSlotIndex < 0 || targetSlotIndex >= timeSlots.length) {
                throw new Error("AI identified an invalid target day or slot.");
            }
            
            // Check if target slot is free for the batch
            if (newTimetable[assignment.batchId]?.[targetDayIndex]?.[targetSlotIndex]) {
                 throw new Error(`Cannot move class. The target slot (${days[targetDayIndex]}, ${timeSlots[targetSlotIndex]}) is already occupied for this batch.`);
            }

            // Remove from old position
            delete newTimetable[assignment.batchId][assignment.day][assignment.slot];
            
            // Place in new position
            if (!newTimetable[assignment.batchId][targetDayIndex]) {
                newTimetable[assignment.batchId][targetDayIndex] = {};
            }
            newTimetable[assignment.batchId][targetDayIndex][targetSlotIndex] = {
                ...assignment,
                day: targetDayIndex,
                slot: targetSlotIndex,
            };
        } else {
             throw new Error("AI returned an unknown action.");
        }

        return newTimetable;

    } catch (error) {
        console.error("Gemini NLC failed:", error);
        throw new Error(`The AI assistant could not perform the request: ${error instanceof Error ? error.message : String(error)}`);
    }
};


// --- GENETIC ALGORITHM CORE ---

/**
 * The main entry point for the optimization process.
 */
export const runOptimization = async (input: SchedulerInput): Promise<{ timetable: TimetableGrid, metrics: TimetableMetrics }[]> => {
    // FIX: Destructure baseTimetable from the input object.
    const { batches, allSubjects, allFaculty, allRooms, constraints, globalConstraints, days, timetableSettings, candidateCount, facultyAllocations, baseTimetable } = input;
    const timeSlots = generateTimeSlots(timetableSettings);
    const numSlots = timeSlots.length;

    const classesToSchedule = batches.flatMap(batch =>
        batch.subjectIds.flatMap(subjectId => {
            const subject = allSubjects.find(s => s.id === subjectId);
            if (!subject) return [];
            // For labs, one session is one hour. A 2-hour lab needs two class assignments.
            return Array(subject.hoursPerWeek).fill(null).map(() => ({ batchId: batch.id, subjectId }));
        })
    );
    
    const problemSummary = {
        numBatches: batches.length, numClasses: classesToSchedule.length, numFaculty: allFaculty.length,
        numRooms: allRooms.length, numConstraints: constraints.pinnedAssignments.length,
    };
    const strategy = await getGeminiPhaseStrategy(problemSummary);
    // FIX: Pass baseTimetable to the population initialization function.
    let population = initializePopulation(POPULATION_SIZE, classesToSchedule, batches, allSubjects, allFaculty, allRooms, constraints, facultyAllocations, days, numSlots, baseTimetable);
    let bestScores: number[] = [];

    for (const phase of strategy) {
        let interventionUsedThisPhase = false;
        for (let gen = 0; gen < phase.generations; gen++) {
            population = population.map(individual => ({
                ...individual,
                metrics: calculateMetrics(individual.timetable, batches, allFaculty, globalConstraints),
            }));

            population.sort((a, b) => b.metrics.score - a.metrics.score);
            const bestScore = population[0].metrics.score;
            bestScores.push(bestScore);
            console.log(`Generation ${gen + 1}/${MAX_GENERATIONS}, Best Score: ${bestScore.toFixed(2)}`);

            if (bestScore >= PERFECT_SCORE_THRESHOLD) {
                 console.log("Near-perfect solution found, stopping early.");
                 break;
            }

            const stagnationCounter = bestScores.slice(-STAGNATION_LIMIT_FOR_EXIT).filter(s => s === bestScore).length;
            if (stagnationCounter >= STAGNATION_LIMIT_FOR_EXIT) {
                 console.log("Stagnation detected, stopping early.");
                 break;
            }
            
            // --- GEMINI INTERVENTION ---
            const interventionStagnation = bestScores.slice(-STAGNATION_LIMIT_FOR_INTERVENTION).filter(s => s === bestScore).length;
            if (interventionStagnation >= STAGNATION_LIMIT_FOR_INTERVENTION && gen > STAGNATION_LIMIT_FOR_INTERVENTION && !interventionUsedThisPhase) {
                console.log("Stagnation detected, attempting Gemini creative intervention...");
                interventionUsedThisPhase = true; // Attempt intervention only once per phase
                const intervention = await geminiCreativeIntervention(population[0].timetable, allSubjects, allFaculty, allRooms, batches, days);
                if (intervention) {
                    const [assignment1, assignment2] = intervention;
                    const newTimetable = JSON.parse(JSON.stringify(population[0].timetable));
                    const batchGrid1 = newTimetable[assignment1.batchId];
                    const batchGrid2 = newTimetable[assignment2.batchId];
                    
                    if (batchGrid1 && batchGrid2) {
                        batchGrid1[assignment1.day][assignment1.slot] = { ...assignment2, day: assignment1.day, slot: assignment1.slot };
                        batchGrid2[assignment2.day][assignment2.slot] = { ...assignment1, day: assignment2.day, slot: assignment2.slot };
                        
                        // Replace the worst individual with the Gemini-modified best
                        population[population.length - 1] = { timetable: newTimetable, metrics: calculateMetrics(newTimetable, batches, allFaculty, globalConstraints) };
                        bestScores[bestScores.length - 1] = -1; // Reset stagnation counter
                    }
                }
            }


            let newPopulation: typeof population = [];
            for (let i = 0; i < ELITISM_COUNT; i++) {
                newPopulation.push(population[i]);
            }

            while (newPopulation.length < POPULATION_SIZE) {
                let offspring = { ...selectParent(population, TOURNAMENT_SIZE) };
                
                const heuristic = selectHeuristic(phase.heuristicEnumMap);
                
                switch (heuristic) {
                    case LowLevelHeuristic.DAY_WISE_CROSSOVER:
                         const parent2 = selectParent(population, TOURNAMENT_SIZE);
                         offspring = dayWiseCrossover(offspring, parent2);
                         break;
                    case LowLevelHeuristic.SWAP_MUTATE:
                         offspring = swapMutate(offspring, 0.1);
                         break;
                    case LowLevelHeuristic.MOVE_MUTATE:
                         offspring = moveMutate(offspring, 0.1, batches, allSubjects, allFaculty, allRooms, constraints, days, numSlots);
                         break;
                    case LowLevelHeuristic.SIMULATED_ANNEALING:
                         offspring = simulatedAnnealing(offspring, batches, allFaculty, globalConstraints);
                         break;
                }
                
                greedyRepair(offspring, batches, allSubjects, allFaculty, allRooms, constraints, days, numSlots, facultyAllocations);
                newPopulation.push(offspring);
            }
            population = newPopulation;
        }
    }

    // Final scoring and selection
    population = population.map(individual => ({
        ...individual,
        metrics: calculateMetrics(individual.timetable, batches, allFaculty, globalConstraints),
    }));
    population.sort((a, b) => b.metrics.score - a.metrics.score);

    // FIX: A logic error where the function returned the entire population,
    // not just the top candidates requested by the user.
    const distinctCandidates = [];
    const seenSignatures = new Set<string>();
    for (const ind of population) {
        if (distinctCandidates.length >= candidateCount) break;
        const signature = JSON.stringify(ind.timetable);
        if (!seenSignatures.has(signature)) {
            distinctCandidates.push(ind);
            seenSignatures.add(signature);
        }
    }

    return distinctCandidates;
};

// --- INITIALIZATION ---
const initializePopulation = (
    size: number,
    classes: { batchId: string, subjectId: string }[],
    batches: Batch[],
    allSubjects: Subject[],
    allFaculty: Faculty[],
    allRooms: Room[],
    constraints: Constraints,
    facultyAllocations: FacultyAllocation[],
    days: string[],
    numSlots: number,
    // FIX: Accept optional baseTimetable.
    baseTimetable?: TimetableGrid
): { timetable: TimetableGrid, metrics: TimetableMetrics }[] => {
    let population = [];
    for (let i = 0; i < size; i++) {
        // FIX: If this is the first individual and a baseTimetable is provided, use it.
        if (i === 0 && baseTimetable) {
            population.push({ timetable: baseTimetable, metrics: { score: 0, hardConflicts: 0, studentGaps: 0, facultyGaps: 0, facultyWorkloadDistribution: 0, preferenceViolations: 0 } });
            continue;
        }

        let timetable: TimetableGrid = {};
        batches.forEach(b => {
            timetable[b.id] = {};
            for (let d = 0; d < days.length; d++) {
                timetable[b.id][d] = {};
            }
        });

        // Apply pinned assignments first
        constraints.pinnedAssignments.forEach(pin => {
            if (!timetable[pin.batchId]) timetable[pin.batchId] = {};
            pin.days.forEach(day => {
                if (!timetable[pin.batchId][day]) timetable[pin.batchId][day] = {};
                pin.startSlots.forEach(startSlot => {
                    for (let j = 0; j < pin.duration; j++) {
                        const slot = startSlot + j;
                        if (slot < numSlots) {
                            timetable[pin.batchId][day][slot] = {
                                id: generateId(),
                                subjectId: pin.subjectId,
                                // UPGRADE: Now an array to support multi-teacher classes
                                facultyIds: [pin.facultyId],
                                roomId: pin.roomId,
                                batchId: pin.batchId,
                                day, slot,
                            };
                        }
                    }
                });
            });
        });

        const unplacedClasses = [...classes];
        let attempts = 0;
        const maxAttempts = unplacedClasses.length * numSlots * days.length;

        while (unplacedClasses.length > 0 && attempts < maxAttempts) {
            attempts++;
            const classToPlace = unplacedClasses.shift()!;
            const batch = batches.find(b => b.id === classToPlace.batchId)!;
            const subject = allSubjects.find(s => s.id === classToPlace.subjectId)!;

            const day = Math.floor(Math.random() * days.length);
            const slot = Math.floor(Math.random() * numSlots);
            
            // Try to find a valid placement
            if (!isBatchAvailable(batch.id, day, slot, flattenTimetable(timetable))) {
                unplacedClasses.push(classToPlace); continue;
            }
            
            // UPGRADE: Find multiple faculty for labs/practicals
            const facultyCandidates = findFacultyForClass(batch.id, subject.id, allFaculty, facultyAllocations);
            if (facultyCandidates.length === 0) {
                 unplacedClasses.push(classToPlace); continue;
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
                 unplacedClasses.push(classToPlace); continue;
            }

            const room = findRoomForClass(batch, subject, day, slot, allRooms, flattenTimetable(timetable));
            if (!room) {
                 unplacedClasses.push(classToPlace); continue;
            }

            if (!timetable[batch.id][day]) timetable[batch.id][day] = {};
            timetable[batch.id][day][slot] = {
                id: generateId(),
                subjectId: subject.id,
                facultyIds: selectedFaculty.map(f => f.id),
                roomId: room.id,
                batchId: batch.id,
                day, slot
            };
        }

        population.push({ timetable, metrics: { score: 0, hardConflicts: 0, studentGaps: 0, facultyGaps: 0, facultyWorkloadDistribution: 0, preferenceViolations: 0 } });
    }
    return population;
};

// --- GENETIC OPERATORS ---
const selectParent = (population: { metrics: TimetableMetrics }[], tournamentSize: number) => {
    let best = null;
    for (let i = 0; i < tournamentSize; i++) {
        const individual = population[Math.floor(Math.random() * population.length)];
        if (best === null || individual.metrics.score > best.metrics.score) {
            best = individual;
        }
    }
    return best!;
};

const dayWiseCrossover = (parent1: { timetable: TimetableGrid }, parent2: { timetable: TimetableGrid }) => {
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


const swapMutate = (individual: { timetable: TimetableGrid }, mutationRate: number) => {
    if (Math.random() > mutationRate) return individual;
    const timetable = JSON.parse(JSON.stringify(individual.timetable));
    const assignments = flattenTimetable(timetable);
    if (assignments.length < 2) return individual;
    
    const [as1, as2] = [assignments[Math.floor(Math.random() * assignments.length)], assignments[Math.floor(Math.random() * assignments.length)]];

    // Swap positions
    const tempDay = as1.day, tempSlot = as1.slot;
    as1.day = as2.day; as1.slot = as2.slot;
    as2.day = tempDay; as2.slot = tempSlot;

    // Update grid
    const batchGrid1 = timetable[as1.batchId];
    const batchGrid2 = timetable[as2.batchId];
    if (batchGrid1 && batchGrid2) {
        delete batchGrid2[as2.day][as2.slot];
        delete batchGrid1[as1.day][as1.slot];
        batchGrid1[as2.day][as2.slot] = as2;
        batchGrid2[as1.day][as1.slot] = as1;
    }
    
    return { ...individual, timetable };
};

const moveMutate = (
    individual: { timetable: TimetableGrid }, 
    mutationRate: number, 
    batches: Batch[], 
    allSubjects: Subject[],
    allFaculty: Faculty[],
    allRooms: Room[],
    constraints: Constraints,
    days: string[],
    numSlots: number
) => {
    if (Math.random() > mutationRate) return individual;
    const timetable = JSON.parse(JSON.stringify(individual.timetable));
    const assignments = flattenTimetable(timetable);
    if (assignments.length === 0) return individual;

    const assignmentToMove = assignments[Math.floor(Math.random() * assignments.length)];
    const batchGrid = timetable[assignmentToMove.batchId];
    if (batchGrid?.[assignmentToMove.day]?.[assignmentToMove.slot]) {
        delete batchGrid[assignmentToMove.day][assignmentToMove.slot];
    }
    
    const batch = batches.find(b => b.id === assignmentToMove.batchId)!;
    const subject = allSubjects.find(s => s.id === assignmentToMove.subjectId)!;

    // Try to find a new valid spot
    for (let i=0; i < 50; i++) {
        const day = Math.floor(Math.random() * days.length);
        const slot = Math.floor(Math.random() * numSlots);
        if (isBatchAvailable(batch.id, day, slot, flattenTimetable(timetable))) {
            const facultyAreAvailable = assignmentToMove.facultyIds.every(fid => isFacultyAvailable(fid, day, slot, flattenTimetable(timetable), constraints.facultyAvailability));
            const room = findRoomForClass(batch, subject, day, slot, allRooms, flattenTimetable(timetable));
            if (facultyAreAvailable && room) {
                assignmentToMove.day = day;
                assignmentToMove.slot = slot;
                assignmentToMove.roomId = room.id;
                batchGrid[day][slot] = assignmentToMove;
                return { ...individual, timetable };
            }
        }
    }
    
    // If failed, put it back
    batchGrid[assignmentToMove.day][assignmentToMove.slot] = assignmentToMove;
    return individual;
};


const simulatedAnnealing = (
    individual: { timetable: TimetableGrid, metrics: TimetableMetrics },
    batches: Batch[],
    allFaculty: Faculty[],
    globalConstraints: GlobalConstraints
) => {
    let currentTimetable = JSON.parse(JSON.stringify(individual.timetable));
    let currentMetrics = calculateMetrics(currentTimetable, batches, allFaculty, globalConstraints);
    let temperature = SA_INITIAL_TEMPERATURE;

    while (temperature > SA_MIN_TEMPERATURE) {
        for (let i = 0; i < SA_ITERATIONS_PER_TEMP; i++) {
            const newTimetable = JSON.parse(JSON.stringify(currentTimetable));
            const assignments = flattenTimetable(newTimetable);
            if (assignments.length < 2) continue;
            
            const [as1, as2] = [assignments[Math.floor(Math.random() * assignments.length)], assignments[Math.floor(Math.random() * assignments.length)]];

            // Swap positions
            const tempDay = as1.day, tempSlot = as1.slot;
            as1.day = as2.day; as1.slot = as2.slot;
            as2.day = tempDay; as2.slot = tempSlot;

            // Update grid
            const batchGrid1 = newTimetable[as1.batchId];
            const batchGrid2 = newTimetable[as2.batchId];
             if (batchGrid1 && batchGrid2) {
                delete batchGrid2[as2.day][as2.slot];
                delete batchGrid1[as1.day][as1.slot];
                batchGrid1[as2.day][as2.slot] = as2;
                batchGrid2[as1.day][as1.slot] = as1;
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

const selectHeuristic = (heuristicMap: Map<LowLevelHeuristic, number>): LowLevelHeuristic => {
    const rand = Math.random();
    let cumulative = 0;
    for (const [heuristic, probability] of heuristicMap.entries()) {
        cumulative += probability;
        if (rand <= cumulative) {
            return heuristic;
        }
    }
    return LowLevelHeuristic.SWAP_MUTATE; // Fallback
};

// --- HELPERS ---
const greedyRepair = (
    individual: { timetable: TimetableGrid },
    batches: Batch[],
    allSubjects: Subject[],
    allFaculty: Faculty[],
    allRooms: Room[],
    constraints: Constraints,
    days: string[],
    numSlots: number,
    facultyAllocations: FacultyAllocation[]
) => {
    const timetable = individual.timetable;
    const allCurrentAssignments = flattenTimetable(timetable);

    // Identify conflicts and unplaced classes
    const conflicts: ClassAssignment[] = [];
    const classCounts: Record<string, number> = {};

    allCurrentAssignments.forEach(a => {
        const key = `${a.batchId}-${a.subjectId}`;
        classCounts[key] = (classCounts[key] || 0) + 1;
        
        const facultyAreAvailable = a.facultyIds.every(fid => isFacultyAvailable(fid, a.day, a.slot, allCurrentAssignments.filter(ca => ca.id !== a.id), constraints.facultyAvailability));
        if (!facultyAreAvailable) conflicts.push(a);
    });
    
    // Identify missing classes
    const requiredClasses = batches.flatMap(b => b.subjectIds.map(sId => ({ batchId: b.id, subjectId: sId, hours: allSubjects.find(s=>s.id === sId)?.hoursPerWeek || 0 })));
    requiredClasses.forEach(rc => {
        const key = `${rc.batchId}-${rc.subjectId}`;
        const placedCount = classCounts[key] || 0;
        if (placedCount < rc.hours) {
            for (let i = 0; i < rc.hours - placedCount; i++) {
                conflicts.push({
                    id: `unplaced_${generateId()}`, subjectId: rc.subjectId, batchId: rc.batchId,
                    // Dummy values, will be replaced
                    facultyIds: [], roomId: '', day: -1, slot: -1
                });
            }
        }
    });

    // Attempt to repair
    for (const conflict of conflicts) {
        // Remove from current position if it exists
        if (conflict.day !== -1 && timetable[conflict.batchId]?.[conflict.day]?.[conflict.slot]) {
            delete timetable[conflict.batchId][conflict.day][conflict.slot];
        }

        const batch = batches.find(b => b.id === conflict.batchId)!;
        const subject = allSubjects.find(s => s.id === conflict.subjectId)!;

        // Find a new valid spot
        let placed = false;
        for (let i = 0; i < 100; i++) { // Limit attempts
            const day = Math.floor(Math.random() * days.length);
            const slot = Math.floor(Math.random() * numSlots);
            
            if (!isBatchAvailable(batch.id, day, slot, flattenTimetable(timetable))) continue;
            
            const facultyCandidates = findFacultyForClass(batch.id, subject.id, allFaculty, facultyAllocations);
            const requiredFacultyCount = subject.type === 'Practical' ? 2 : 1;
            const selectedFaculty = [];
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
                    ...conflict,
                    facultyIds: selectedFaculty.map(f => f.id),
                    roomId: room.id,
                    day, slot
                 };
                 placed = true;
                 break;
            }
        }
    }
};

const findFacultyForClass = (
    batchId: string,
    subjectId: string,
    allFaculty: Faculty[],
    allocations: FacultyAllocation[],
): Faculty[] => {
    // 1. Check for a specific allocation for this batch and subject.
    const specificAllocation = allocations.find(a => a.batchId === batchId && a.subjectId === subjectId);
    if (specificAllocation && specificAllocation.facultyIds.length > 0) {
        return allFaculty.filter(f => specificAllocation.facultyIds.includes(f.id));
    }
    // 2. Fallback: Find any faculty who can teach this subject.
    return allFaculty.filter(f => f.subjectIds.includes(subjectId));
};


const findRoomForClass = (
    batch: Batch,
    subject: Subject,
    day: number,
    slot: number,
    allRooms: Room[],
    allAssignments: ClassAssignment[]
): Room | null => {
    const suitableRooms = allRooms.filter(room => {
        if (batch.allocatedRoomIds && batch.allocatedRoomIds.length > 0 && !batch.allocatedRoomIds.includes(room.id)) {
            return false; // Batch is restricted to specific rooms
        }
        return isRoomAvailable(room.id, day, slot, batch, subject, room, allAssignments);
    });
    return suitableRooms.length > 0 ? suitableRooms[Math.floor(Math.random() * suitableRooms.length)] : null;
};

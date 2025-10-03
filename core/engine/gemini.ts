import type { DiagnosticIssue, Batch, Subject, Faculty, Room, FacultyAllocation, GlobalConstraints, TimetableFeedback, ClassAssignment, TimetableGrid, TimetableSettings } from '../../types';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { generateTimeSlots } from '../../utils/time';
import { flattenTimetable } from './helpers';

// --- GEMINI API INITIALIZATION ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// Helper function to retry Gemini API calls on overload errors.
async function callGeminiWithRetry<T>(
    apiCall: () => Promise<T>,
    options: { retries?: number; delayMs?: number } = {}
): Promise<T> {
  const { retries = 2, delayMs = 2000 } = options;
  try {
    return await apiCall();
  } catch (error: any) {
    const isOverloaded = error.status === 503 || (error.message && error.message.toLowerCase().includes('overloaded'));
    if (retries > 0 && isOverloaded) {
      console.warn(`Gemini API overloaded. Retrying in ${delayMs / 1000}s... (${retries} retries left)`);
      await new Promise(res => setTimeout(res, delayMs));
      return callGeminiWithRetry(apiCall, { retries: retries - 1, delayMs: delayMs * 2 });
    }
    throw error;
  }
}

/**
 * Checks for common data integrity issues before running the scheduler.
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

    batches.forEach(batch => {
        batch.subjectIds.forEach(subjectId => {
            const subject = allSubjects.find(s => s.id === subjectId);
            if (!subject) return;

            const specificAllocation = facultyAllocations.find(fa => fa.batchId === batch.id && fa.subjectId === subjectId);
            if (specificAllocation && specificAllocation.facultyIds.length > 0) return;

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
 * Analyzes faculty feedback to tune the weights of soft constraints.
 */
export const tuneConstraintWeightsWithGemini = async (
    baseConstraints: GlobalConstraints,
    feedback: TimetableFeedback[],
    allFaculty: Faculty[]
): Promise<GlobalConstraints> => {
    if (feedback.length < 3) return { ...baseConstraints };

    try {
        const feedbackSummary = feedback.map(f => {
            const facultyName = allFaculty.find(fac => fac.id === f.facultyId)?.name || 'Unknown Faculty';
            return `- Faculty ${facultyName} gave a rating of ${f.rating}/5. Comment: ${f.comment || 'N/A'}`;
        }).join('\n');

        const prompt = `You are an expert university administrator tuning a timetable scheduling algorithm. The algorithm uses weighted constraints to score timetables. Higher weights mean a higher penalty.
            
            Current Base Weights:
            - Student Gap Weight: ${baseConstraints.studentGapWeight}
            - Faculty Gap Weight: ${baseConstraints.facultyGapWeight}
            - Faculty Workload Variance Weight: ${baseConstraints.facultyWorkloadDistributionWeight}
            - Faculty Preference Violation Weight: ${baseConstraints.facultyPreferenceWeight}

            Recent feedback from faculty on approved timetables:
            ${feedbackSummary}

            Based on this feedback, suggest adjusted weights. Provide your response as a JSON object with keys "studentGapWeight", "facultyGapWeight", "facultyWorkloadDistributionWeight", and "facultyPreferenceWeight". Make subtle adjustments.`;
        
        const response: GenerateContentResponse = await callGeminiWithRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash", contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        studentGapWeight: { type: Type.INTEGER }, facultyGapWeight: { type: Type.INTEGER },
                        facultyWorkloadDistributionWeight: { type: Type.INTEGER }, facultyPreferenceWeight: { type: Type.INTEGER },
                    },
                },
            },
        }), { retries: 2, delayMs: 2000 });

        const tunedWeights = JSON.parse(response.text);
        console.log('Gemini tuned weights:', tunedWeights);
        return {
            ...baseConstraints,
            aiStudentGapWeight: tunedWeights.studentGapWeight, aiFacultyGapWeight: tunedWeights.facultyGapWeight,
            aiFacultyWorkloadDistributionWeight: tunedWeights.facultyWorkloadDistributionWeight, aiFacultyPreferenceWeight: tunedWeights.facultyPreferenceWeight,
        };
    } catch (error) {
        console.error("Gemini weight tuning failed:", error);
        return { 
            ...baseConstraints,
            aiStudentGapWeight: baseConstraints.studentGapWeight, aiFacultyGapWeight: baseConstraints.facultyGapWeight,
            aiFacultyWorkloadDistributionWeight: baseConstraints.facultyWorkloadDistributionWeight, aiFacultyPreferenceWeight: baseConstraints.facultyPreferenceWeight,
        };
    }
};

interface Phase {
    generations: number;
    heuristicEnumMap: Map<number, number>;
}

/**
 * Creates a custom, multi-phase strategy for the genetic algorithm.
 */
export const getGeminiPhaseStrategy = async (problemSummary: {
    numBatches: number; numClasses: number; numFaculty: number; numRooms: number; numConstraints: number;
}): Promise<Phase[]> => {
    try {
        const prompt = `You are an expert in hyper-heuristics for solving university timetabling. I need a multi-phase strategy for a genetic algorithm with a total of 20 generations.
            
            Problem Details: Batches: ${problemSummary.numBatches}, Classes: ${problemSummary.numClasses}, Faculty: ${problemSummary.numFaculty}, Rooms: ${problemSummary.numRooms}, Pinned constraints: ${problemSummary.numConstraints}
            Available heuristics are: SWAP_MUTATE, MOVE_MUTATE, SIMULATED_ANNEALING, DAY_WISE_CROSSOVER.

            Design a strategy with 2-4 phases. Each phase needs 'generations' and 'heuristics' (an object of heuristic names and probabilities summing to 1.0).
            - Early phases: focus on exploration (crossover, move mutations).
            - Later phases: focus on exploitation (swap mutations, simulated annealing).
            Provide the response as a JSON array of phase objects.`;

        const response: GenerateContentResponse = await callGeminiWithRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash", contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT, properties: {
                            generations: { type: Type.INTEGER }, heuristics: { type: Type.OBJECT, properties: {
                                SWAP_MUTATE: { type: Type.NUMBER }, MOVE_MUTATE: { type: Type.NUMBER },
                                SIMULATED_ANNEALING: { type: Type.NUMBER }, DAY_WISE_CROSSOVER: { type: Type.NUMBER },
                            }, required: ["SWAP_MUTATE", "MOVE_MUTATE", "SIMULATED_ANNEALING", "DAY_WISE_CROSSOVER"] }
                        }, required: ["generations", "heuristics"]
                    }
                },
            },
        }), { retries: 2, delayMs: 1000 });

        const strategy = JSON.parse(response.text);
        console.log('Gemini generated strategy:', strategy);
        
        if (Array.isArray(strategy) && strategy.length > 0 && strategy[0].generations) {
            return strategy.map((phase: any) => ({
                generations: phase.generations,
                heuristicEnumMap: new Map([
                    [0, phase.heuristics.SWAP_MUTATE], [1, phase.heuristics.MOVE_MUTATE],
                    [2, phase.heuristics.SIMULATED_ANNEALING], [3, phase.heuristics.DAY_WISE_CROSSOVER],
                ])
            }));
        }
    } catch (error) {
        console.error("Gemini strategy generation failed:", error);
    }
    
    console.log("Falling back to default strategy.");
    return [
        { generations: 10, heuristicEnumMap: new Map([[3, 0.5], [1, 0.4], [0, 0.1], [2, 0.0]]) },
        { generations: 10, heuristicEnumMap: new Map([[3, 0.2], [1, 0.2], [0, 0.5], [2, 0.1]]) },
        { generations: 5, heuristicEnumMap: new Map([[3, 0.0], [1, 0.1], [0, 0.4], [2, 0.5]]) },
    ];
};


/**
 * When the algorithm stagnates, this function asks Gemini for a creative swap.
 */
export const geminiCreativeIntervention = async (
    timetable: TimetableGrid, allSubjects: Subject[], allFaculty: Faculty[], allRooms: Room[], allBatches: Batch[], days: string[]
): Promise<[ClassAssignment, ClassAssignment] | null> => {
    try {
        const assignments = flattenTimetable(timetable);
        const assignmentDetails = assignments.map(a => {
            const subject = allSubjects.find(s => s.id === a.subjectId)?.code || '???';
            const batch = allBatches.find(b => b.id === a.batchId)?.name || '???';
            const day = days[a.day];
            return `ID: ${a.id}, Class: ${subject} for ${batch} on ${day} at slot ${a.slot}`;
        }).join('\n');

        const prompt = `You are an expert scheduler providing a creative intervention to a stuck genetic algorithm. Identify two classes to swap to escape a local optimum.
            A good swap might involve moving classes between different days or batches.
            Current assignments: ${assignmentDetails}
            Provide your response as a JSON object with keys "classId1" and "classId2".`;

        const INTERVENTION_TIMEOUT_MS = 10000;
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`Gemini intervention timed out`)), INTERVENTION_TIMEOUT_MS));

        const geminiCall = () => ai.models.generateContent({
            model: "gemini-2.5-flash", contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT, properties: { classId1: { type: Type.STRING }, classId2: { type: Type.STRING } },
                    required: ["classId1", "classId2"],
                },
            },
        });
        
        const geminiPromiseWithRetry = callGeminiWithRetry(geminiCall, { retries: 1, delayMs: 500 });
        const response = await Promise.race([geminiPromiseWithRetry, timeoutPromise]) as GenerateContentResponse;
        
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
 * Helper for NLC to find an assignment based on subject code and batch name.
 */
const findAssignmentByDetails = (timetable: TimetableGrid, subjectCode: string, batchName: string, allSubjects: Subject[], allBatches: Batch[]): ClassAssignment | null => {
    const subject = allSubjects.find(s => s.code.toLowerCase() === subjectCode.toLowerCase());
    const batch = allBatches.find(b => b.name.toLowerCase() === batchName.toLowerCase());
    if (!subject || !batch) return null;

    const batchGrid = timetable[batch.id];
    if (!batchGrid) return null;

    for (const day in batchGrid) {
        for (const slot in batchGrid[day]) {
            const assignment = batchGrid[day][slot];
            if (assignment.subjectId === subject.id) return assignment;
        }
    }
    return null;
};

/**
 * Applies a natural language command to modify a timetable.
 */
export const applyNaturalLanguageCommand = async (
    timetable: TimetableGrid, command: string, allSubjects: Subject[], allFaculty: Faculty[], allBatches: Batch[], days: string[], settings: TimetableSettings
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

    const prompt = `You are an intelligent assistant modifying a university timetable. Parse the user's command to determine the action ("swap" or "move") and parameters.
        Available Days: ${days.join(', ')}. Available Time Slots: ${timeSlots.map((ts, i) => `Slot ${i}: ${ts}`).join('; ')}.
        Current Assignments: ${assignmentDetails}
        User Command: "${command}"
        Return a JSON object describing the action.
        For "swap", use schema: { "action": "swap", "class1_subject_code": string, "class1_batch_name": string, "class2_subject_code": string, "class2_batch_name": string }
        For "move", use schema: { "action": "move", "class_subject_code": string, "class_batch_name": string, "target_day": string, "target_slot_index": integer }`;

    try {
        const response: GenerateContentResponse = await callGeminiWithRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash", contents: prompt, config: { responseMimeType: "application/json" },
        }), { retries: 2, delayMs: 1000 });

        const parsed = JSON.parse(response.text);
        const newTimetable = JSON.parse(JSON.stringify(timetable));

        if (parsed.action === 'swap') {
            const assignment1 = findAssignmentByDetails(timetable, parsed.class1_subject_code, parsed.class1_batch_name, allSubjects, allBatches);
            const assignment2 = findAssignmentByDetails(timetable, parsed.class2_subject_code, parsed.class2_batch_name, allSubjects, allBatches);
            if (!assignment1 || !assignment2) throw new Error("AI could not identify one or both classes to swap.");
            
            newTimetable[assignment1.batchId][assignment1.day][assignment1.slot] = { ...assignment2, day: assignment1.day, slot: assignment1.slot };
            newTimetable[assignment2.batchId][assignment2.day][assignment2.slot] = { ...assignment1, day: assignment2.day, slot: assignment2.slot };

        } else if (parsed.action === 'move') {
            const assignment = findAssignmentByDetails(timetable, parsed.class_subject_code, parsed.class_batch_name, allSubjects, allBatches);
            if (!assignment) throw new Error("AI could not identify the class to move.");
            
            const targetDayIndex = days.findIndex(d => d.toLowerCase() === parsed.target_day.toLowerCase());
            const targetSlotIndex = parsed.target_slot_index;
            if (targetDayIndex === -1 || targetSlotIndex < 0 || targetSlotIndex >= timeSlots.length) throw new Error("AI identified an invalid target day or slot.");
            if (newTimetable[assignment.batchId]?.[targetDayIndex]?.[targetSlotIndex]) throw new Error(`Cannot move class. Target slot is occupied for this batch.`);

            delete newTimetable[assignment.batchId][assignment.day][assignment.slot];
            if (!newTimetable[assignment.batchId][targetDayIndex]) newTimetable[assignment.batchId][targetDayIndex] = {};
            newTimetable[assignment.batchId][targetDayIndex][targetSlotIndex] = { ...assignment, day: targetDayIndex, slot: targetSlotIndex };
        } else {
             throw new Error("AI returned an unknown action.");
        }

        return newTimetable;

    } catch (error) {
        console.error("Gemini NLC failed:", error);
        throw new Error(`AI assistant could not perform request: ${error instanceof Error ? error.message : String(error)}`);
    }
};

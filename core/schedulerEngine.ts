import type { SchedulerInput } from './engine/types';
import type { GeneratedTimetable, TimetableGrid, TimetableMetrics } from '../types';
import { calculateMetrics } from './engine/fitness';
import { initializePopulation } from './engine/population';
import { selectParent, selectHeuristic, dayWiseCrossover, swapMutate, moveMutate, simulatedAnnealing } from './engine/operators';
import { getGeminiPhaseStrategy, geminiCreativeIntervention } from './engine/gemini';
import { greedyRepair } from './engine/population';
import { generateTimeSlots } from '../utils/time';
export { runPreflightDiagnostics, applyNaturalLanguageCommand } from './engine/gemini';


// --- ALGORITHM CONFIGURATION ---
const POPULATION_SIZE = 20;
const MAX_GENERATIONS = 20;
const ELITISM_COUNT = 2;
const TOURNAMENT_SIZE = 5;
const STAGNATION_LIMIT_FOR_EXIT = 8;
const STAGNATION_LIMIT_FOR_INTERVENTION = 5;
const PERFECT_SCORE_THRESHOLD = 990;


/**
 * The main entry point for the optimization process.
 */
export const runOptimization = async (input: SchedulerInput): Promise<{ timetable: TimetableGrid, metrics: TimetableMetrics }[]> => {
    const { batches, allSubjects, allFaculty, allRooms, constraints, globalConstraints, days, workingDaysIndices, timetableSettings, candidateCount, facultyAllocations, baseTimetable } = input;
    const timeSlots = generateTimeSlots(timetableSettings);
    const numSlots = timeSlots.length;

    const pinnedLocations = new Set<string>();
    (constraints.pinnedAssignments || []).forEach(pin => {
        pin.days.forEach(day => {
            pin.startSlots.forEach(startSlot => {
                for (let j = 0; j < pin.duration; j++) {
                    const slot = startSlot + j;
                    const key = `${day}-${slot}-${pin.batchId}`;
                    pinnedLocations.add(key);
                }
            });
        });
    });

    const classesToSchedule = batches.flatMap(batch =>
        batch.subjectIds.flatMap(subjectId => {
            const subject = allSubjects.find(s => s.id === subjectId);
            if (!subject) return [];
            return Array(subject.hoursPerWeek).fill(null).map(() => ({ batchId: batch.id, subjectId }));
        })
    );
    
    const problemSummary = {
        numBatches: batches.length, numClasses: classesToSchedule.length, numFaculty: allFaculty.length,
        numRooms: allRooms.length, numConstraints: constraints.pinnedAssignments.length,
    };
    const strategy = await getGeminiPhaseStrategy(problemSummary);
    let population = initializePopulation(POPULATION_SIZE, classesToSchedule, batches, allSubjects, allFaculty, allRooms, constraints, facultyAllocations, workingDaysIndices, numSlots, baseTimetable);
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
            
            const interventionStagnation = bestScores.slice(-STAGNATION_LIMIT_FOR_INTERVENTION).filter(s => s === bestScore).length;
            if (interventionStagnation >= STAGNATION_LIMIT_FOR_INTERVENTION && gen > STAGNATION_LIMIT_FOR_INTERVENTION && !interventionUsedThisPhase) {
                console.log("Stagnation detected, attempting Gemini creative intervention...");
                interventionUsedThisPhase = true;
                const intervention = await geminiCreativeIntervention(population[0].timetable, allSubjects, allFaculty, allRooms, batches, days);
                if (intervention) {
                    const [assignment1, assignment2] = intervention;
                    const newTimetable = JSON.parse(JSON.stringify(population[0].timetable));
                    const batchGrid1 = newTimetable[assignment1.batchId];
                    const batchGrid2 = newTimetable[assignment2.batchId];
                    
                    if (batchGrid1 && batchGrid2) {
                        batchGrid1[assignment1.day][assignment1.slot] = { ...assignment2, day: assignment1.day, slot: assignment1.slot };
                        batchGrid2[assignment2.day][assignment2.slot] = { ...assignment1, day: assignment2.day, slot: assignment2.slot };
                        
                        population[population.length - 1] = { timetable: newTimetable, metrics: calculateMetrics(newTimetable, batches, allFaculty, globalConstraints) };
                        bestScores[bestScores.length - 1] = -1;
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
                    case 0: // SWAP_MUTATE
                         offspring = swapMutate(offspring, 0.1, pinnedLocations);
                         break;
                    case 1: // MOVE_MUTATE
                         offspring = moveMutate(offspring, 0.1, batches, allSubjects, allFaculty, allRooms, constraints, workingDaysIndices, numSlots, pinnedLocations);
                         break;
                    case 2: // SIMULATED_ANNEALING
                         offspring = simulatedAnnealing(offspring, batches, allFaculty, globalConstraints, pinnedLocations);
                         break;
                    case 3: // DAY_WISE_CROSSOVER
                         const parent2 = selectParent(population, TOURNAMENT_SIZE);
                         offspring = dayWiseCrossover(offspring, parent2);
                         break;
                }
                greedyRepair(offspring, batches, allSubjects, allFaculty, allRooms, constraints, workingDaysIndices, numSlots, facultyAllocations, pinnedLocations);
                newPopulation.push(offspring);
            }
            population = newPopulation;
        }
    }

    population = population.map(individual => ({
        ...individual,
        metrics: calculateMetrics(individual.timetable, batches, allFaculty, globalConstraints),
    }));
    population.sort((a, b) => b.metrics.score - a.metrics.score);

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

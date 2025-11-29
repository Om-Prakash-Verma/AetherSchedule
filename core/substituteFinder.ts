import type { ClassAssignment, Faculty, Subject, FacultyAvailability, RankedSubstitute, Batch, FacultyAllocation } from '../types';
import { isFacultyAvailable } from './conflictChecker';
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const getFacultyWorkload = (facultyId: string, allAssignments: ClassAssignment[]): number => {
    return allAssignments.filter(a => a.facultyIds.includes(facultyId)).length;
};

const getScheduleCompactness = (facultyId: string, allAssignments: ClassAssignment[]): number => {
    let totalGaps = 0;
    for (let day = 0; day < 6; day++) {
        const daySlots = allAssignments
            .filter(a => a.day === day && a.facultyIds.includes(facultyId))
            .map(a => a.slot)
            .sort((a,b) => a-b);
        
        if (daySlots.length > 1) {
            for (let i = 0; i < daySlots.length - 1; i++) {
                totalGaps += (daySlots[i+1] - daySlots[i] - 1);
            }
        }
    }
    return totalGaps;
};


export const findRankedSubstitutes = async (
    targetAssignment: ClassAssignment,
    allFaculty: Faculty[],
    allSubjects: Subject[],
    allAssignments: ClassAssignment[],
    facultyAvailabilities: FacultyAvailability[],
    facultyAllocations: FacultyAllocation[],
    allBatches: Batch[]
): Promise<RankedSubstitute[]> => {
    const originalFacultyIds = targetAssignment.facultyIds;
    const { day, slot, batchId, subjectId } = targetAssignment;
    
    const targetSubject = allSubjects.find(s => s.id === subjectId);
    const targetBatch = allBatches.find(b => b.id === batchId);

    const potentialSubstitutes = allFaculty.filter(
        (f) => !originalFacultyIds.includes(f.id)
    );

    const suitableCandidates: Omit<RankedSubstitute, 'score' | 'reasons'>[] = [];

    potentialSubstitutes.forEach(faculty => {
        const isAvailable = isFacultyAvailable(faculty.id, day, slot, allAssignments, facultyAvailabilities);
        if (isAvailable) {
            const suitableSubjects = faculty.subjectIds
                .map(subId => allSubjects.find(s => s.id === subId))
                .filter((s): s is Subject => s !== undefined);
            
            if (suitableSubjects.length > 0) {
                suitableCandidates.push({ faculty, suitableSubjects });
            }
        }
    });

    if (suitableCandidates.length === 0) return [];
    
    // --- AI-Powered Ranking ---
    try {
        const candidateData = suitableCandidates.map(candidate => {
            const workload = getFacultyWorkload(candidate.faculty.id, allAssignments);
            const compactness = getScheduleCompactness(candidate.faculty.id, allAssignments);
            const canTeachOriginal = candidate.suitableSubjects.some(s => s.id === subjectId);
            const isAllocatedToBatch = facultyAllocations.some(fa => fa.batchId === batchId && fa.facultyIds.includes(candidate.faculty.id));
            
            return {
                id: candidate.faculty.id,
                name: candidate.faculty.name,
                workload,
                compactness,
                canTeachOriginal,
                isAllocatedToBatch
            };
        });

        const prompt = `
            You are an expert university administrator finding the best substitute teacher.
            A substitute is needed for the class "${targetSubject?.name}" for batch "${targetBatch?.name}".
            
            Here is a list of available candidates and their metrics:
            ${JSON.stringify(candidateData, null, 2)}
            
            Analyze each candidate and provide a ranked list. The best candidate gets the highest score.
            Your ranking should be based on these weighted priorities:
            1.  **High Priority:** Can they teach the original subject? (canTeachOriginal: true)
            2.  **High Priority:** Are they already allocated to this batch for other subjects? (isAllocatedToBatch: true)
            3.  **Medium Priority:** Do they have a low current workload? (lower workload is better)
            4.  **Low Priority:** Will this new class maintain a compact schedule for them? (lower compactness score is better)

            Provide your response as a JSON array of objects, where each object has:
            - "id": The faculty member's ID.
            - "score": An integer score from 0 to 100.
            - "reasons": An array of short, positive strings explaining why they are a good choice (e.g., "Has a light workload this week", "Can teach the original subject", "Maintains a compact schedule", "Already allocated to this batch").
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
                            id: { type: Type.STRING },
                            score: { type: Type.INTEGER },
                            reasons: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["id", "score", "reasons"]
                    }
                },
            },
        });

        const rankedResults = JSON.parse(response.text) as {id: string, score: number, reasons: string[]}[];
        
        const finalRankedList = rankedResults.map(ranked => {
            const candidate = suitableCandidates.find(c => c.faculty.id === ranked.id);
            if (!candidate) return null;
            return { ...candidate, score: ranked.score, reasons: ranked.reasons };
        }).filter((r): r is RankedSubstitute => r !== null);
        
        finalRankedList.sort((a,b) => b.score - a.score);

        return finalRankedList;

    } catch (error) {
        console.error("Gemini substitute ranking failed:", error);
        // Fallback to simple sorting if AI fails
        return suitableCandidates.map(c => ({
            ...c,
            score: 50, // Default score
            reasons: ["Availability confirmed."]
        }));
    }
};
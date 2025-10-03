import type { GeneratedTimetable, Subject, Faculty, Room, Batch, TimetableSettings, AnalyticsReport, ClassAssignment } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import { generateTimeSlots } from '../utils/time';
// FIX: Import GenerateContentResponse to strongly type the API response.
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// Helper function to retry Gemini API calls on overload errors.
async function callGeminiWithRetry<T>(
    apiCall: () => Promise<T>,
    options: { retries?: number; delayMs?: number } = {}
): Promise<T> {
  const { retries = 2, delayMs = 1000 } = options;
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

const flattenTimetable = (timetable: GeneratedTimetable['timetable']): ClassAssignment[] => {
    return Object.values(timetable).flatMap(batchGrid =>
        Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
    );
};

export const generateAnalyticsReport = (
    timetable: GeneratedTimetable,
    allSubjects: Subject[],
    allFaculty: Faculty[],
    allRooms: Room[],
    allBatches: Batch[],
    settings: TimetableSettings
): AnalyticsReport => {
    const assignments = flattenTimetable(timetable.timetable);
    const timeSlots = generateTimeSlots(settings);
    const numSlots = timeSlots.length;
    const workingDaysIndices = settings.workingDays || [0, 1, 2, 3, 4, 5];

    // 1. Faculty Workload
    const facultyWorkloadMap = new Map<string, number>();
    allFaculty.forEach(f => facultyWorkloadMap.set(f.id, 0));
    assignments.forEach(a => {
        a.facultyIds.forEach(fid => {
            facultyWorkloadMap.set(fid, (facultyWorkloadMap.get(fid) || 0) + 1);
        });
    });
    const facultyWorkload = Array.from(facultyWorkloadMap.entries()).map(([facultyId, totalHours]) => ({
        facultyId,
        facultyName: allFaculty.find(f => f.id === facultyId)?.name || 'Unknown',
        totalHours
    })).sort((a, b) => b.totalHours - a.totalHours);

    // 2. Room Utilization & Heatmap
    const roomUtilizationMap = new Map<string, number>();
    const heatmapData: Record<string, number[][]> = {};
    allRooms.forEach(r => {
        roomUtilizationMap.set(r.id, 0);
        heatmapData[r.id] = Array(DAYS_OF_WEEK.length).fill(0).map(() => Array(numSlots).fill(0));
    });

    assignments.forEach(a => {
        roomUtilizationMap.set(a.roomId, (roomUtilizationMap.get(a.roomId) || 0) + 1);
        if (heatmapData[a.roomId] && heatmapData[a.roomId][a.day]) {
            heatmapData[a.roomId][a.day][a.slot] = 1;
        }
    });

    const totalHoursAvailable = workingDaysIndices.length * numSlots;
    const roomUtilization = Array.from(roomUtilizationMap.entries()).map(([roomId, totalHours]) => {
        const room = allRooms.find(r => r.id === roomId);
        return {
            roomId,
            roomName: room?.name || 'Unknown',
            capacity: room?.capacity || 0,
            totalHours,
            utilizationPercent: Math.round((totalHours / totalHoursAvailable) * 100)
        };
    }).sort((a, b) => b.utilizationPercent - a.utilizationPercent);


    // 3. Student Quality of Life (QoL)
    const studentQoL = timetable.batchIds.map(batchId => {
        const batchGrid = timetable.timetable[batchId];
        let totalGaps = 0;
        let totalMaxConsecutive = 0;

        for (const day of workingDaysIndices) {
            const daySlots = batchGrid?.[day] ? Object.keys(batchGrid[day]).map(Number).sort((a, b) => a - b) : [];
            if (daySlots.length > 1) {
                for (let i = 0; i < daySlots.length - 1; i++) {
                    totalGaps += (daySlots[i + 1] - daySlots[i] - 1);
                }
            }
            
            let maxConsecutive = 0;
            let currentConsecutive = 0;
            if (daySlots.length > 0) {
                 maxConsecutive = 1;
                 currentConsecutive = 1;
                for (let i=1; i < daySlots.length; i++) {
                    if (daySlots[i] === daySlots[i-1] + 1) {
                        currentConsecutive++;
                    } else {
                        currentConsecutive = 1;
                    }
                    if (currentConsecutive > maxConsecutive) {
                        maxConsecutive = currentConsecutive;
                    }
                }
            }
            totalMaxConsecutive += maxConsecutive;
        }

        return {
            batchId,
            batchName: allBatches.find(b => b.id === batchId)?.name || 'Unknown',
            avgGapsPerDay: totalGaps / workingDaysIndices.length,
            maxConsecutiveHours: totalMaxConsecutive
        };
    });

    return {
        id: `analytics_${timetable.id}`,
        timetableId: timetable.id,
        facultyWorkload,
        roomUtilization,
        studentQoL,
        heatmapData
    };
};

export const compareTimetablesWithGemini = async (
    candidate1: GeneratedTimetable,
    candidate2: GeneratedTimetable
): Promise<string> => {
    const summary = `
      Candidate 1 (Score: ${candidate1.metrics.score.toFixed(0)}):
      - Student Gaps: ${candidate1.metrics.studentGaps}
      - Faculty Gaps: ${candidate1.metrics.facultyGaps}
      - Workload Variance: ${candidate1.metrics.facultyWorkloadDistribution.toFixed(2)}

      Candidate 2 (Score: ${candidate2.metrics.score.toFixed(0)}):
      - Student Gaps: ${candidate2.metrics.studentGaps}
      - Faculty Gaps: ${candidate2.metrics.facultyGaps}
      - Workload Variance: ${candidate2.metrics.facultyWorkloadDistribution.toFixed(2)}
    `;

    const prompt = `You are an expert university administrator analyzing two timetable candidates for final approval. Your analysis should be clear, concise, and focused on helping a human make the best decision.

Here are the metrics for the two candidates:
${summary}

Based on these metrics, provide a qualitative comparison. Your response should be in markdown and include:
1.  A "**Summary**" section explaining the fundamental trade-off.
2.  A "**Pros & Cons**" section with bullet points for each candidate.
3.  A "**Recommendation**" section suggesting which candidate is likely better and why.

Focus on the practical impact. For example, a lower "Student Gaps" score means a better student experience. A lower "Workload Variance" means more equitable schedules for faculty. A higher "Score" is generally better, but the underlying reasons are more important.`;

    try {
        // FIX: Explicitly type the response from the Gemini API call to resolve the 'unknown' type error.
        const response: GenerateContentResponse = await callGeminiWithRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        }), { retries: 2, delayMs: 1500 });
        return response.text;
    } catch (error) {
        console.error("Gemini comparison failed:", error);
        throw new Error("The AI analysis service is currently unavailable.");
    }
};
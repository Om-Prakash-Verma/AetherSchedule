
import { functions } from './firebase';
import { ScheduleEntry, Faculty, Room, Batch, Subject, TimetableSettings } from "../types";

export interface AIAnalysisResult {
  score: number;
  analysis: string;
  suggestions: string[];
}

export const checkHealth = (): boolean => {
  return !!functions;
};

// --- Remote Function Definitions ---

export const analyzeScheduleWithGemini = async (
  entries: ScheduleEntry[],
  faculty: Faculty[],
  rooms: Room[],
  batches: Batch[],
  subjects: Subject[]
): Promise<AIAnalysisResult> => {
  if (!functions) return { score: 0, analysis: "Backend disconnected", suggestions: [] };

  try {
      const analyzeFn = functions.httpsCallable('analyzeSchedule');
      const result = await analyzeFn({
          entries,
          faculty,
          rooms,
          batches,
          subjects
      });
      return result.data as AIAnalysisResult;
  } catch (error) {
    console.error("Analysis Error:", error);
    return {
      score: 50,
      analysis: "Error contacting analysis service.",
      suggestions: ["Check internet connection", "Try again later"]
    };
  }
};

export const chatWithScheduler = async (
  message: string,
  currentScheduleState: any
): Promise<string> => {
  if (!functions) return "Service disconnected.";

  try {
      const chatFn = functions.httpsCallable('chatWithScheduler');
      const result = await chatFn({
          message,
          context: currentScheduleState
      });
      return (result.data as any).response || "No response.";
  } catch (error) {
      console.error("Chat Error:", error);
      return "I'm having trouble connecting to the server.";
  }
};

/**
 * Calls the backend to generate a schedule.
 * The backend handles the Gemini API key and validation.
 */
export const generateScheduleWithGemini = async (
    batches: Batch[],
    subjects: Subject[],
    faculty: Faculty[],
    rooms: Room[],
    settings: TimetableSettings,
    generatedSlots: string[],
    targetBatchId?: string, 
    existingSchedule?: ScheduleEntry[] 
): Promise<ScheduleEntry[]> => {
    if (!functions) throw new Error("Firebase Functions not initialized");

    const generateFn = functions.httpsCallable('generateSchedule');
    
    try {
        const result = await generateFn({
            batches,
            subjects,
            faculty,
            rooms,
            settings,
            generatedSlots,
            targetBatchId,
            existingSchedule
        });
        
        return result.data as ScheduleEntry[];
    } catch (error: any) {
        console.error("Generation Error:", error);
        throw new Error(error.message || "Failed to generate schedule via backend.");
    }
};

/**
 * Securely saves schedule via backend to ensure conflict validation 
 * and data integrity before writing to Firestore.
 */
export const saveScheduleSecurely = async (
    newSchedule: ScheduleEntry[],
    targetBatchId?: string
): Promise<{ success: boolean, message: string }> => {
    if (!functions) return { success: false, message: "Functions not ready" };

    const saveFn = functions.httpsCallable('saveSchedule');
    
    try {
        const result = await saveFn({
            schedule: newSchedule,
            targetBatchId
        });
        return result.data as { success: boolean, message: string };
    } catch (error: any) {
        console.error("Save Error:", error);
        throw error;
    }
}

import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ScheduleEntry, Faculty, Room, Batch, Subject, TimetableSettings } from "../types";

// Initialize Gemini
// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const checkHealth = (): boolean => {
  return !!process.env.API_KEY;
};

const REASONING_MODEL = "gemini-3-pro-preview";
const CHAT_MODEL = "gemini-2.5-flash";

export interface AIAnalysisResult {
  score: number;
  analysis: string;
  suggestions: string[];
}

/**
 * Bulletproof data sanitizer for AI Context.
 * Uses WeakSet to detect cycles and strictly filters non-plain objects.
 */
const cleanDataForAI = (data: any, visited = new WeakSet<any>()): any => {
    // 1. Primitives and Null
    if (data === null || data === undefined) return null;
    const type = typeof data;
    if (type !== 'object') return data;

    // 2. Dates
    if (data instanceof Date) return data.toISOString();

    // 3. Cycle Detection
    if (visited.has(data)) return "[Circular Reference]";
    visited.add(data);

    // 4. Arrays
    if (Array.isArray(data)) {
        return data.map(item => cleanDataForAI(item, visited));
    }

    // 5. Objects
    const clean: any = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
             // Block specific keys that are known to cause circularity or contain large internals
             if (key === 'src' || key === 'ref' || key === 'firestore' || key.startsWith('_') || key.startsWith('$')) {
                 continue;
             }
             
             const val = data[key];

             // 6. Handle Complex Objects (Classes, DOM Nodes, etc.)
             if (typeof val === 'object' && val !== null) {
                // If it has a toJSON method, use it (e.g., Firestore Timestamp)
                if (typeof val.toJSON === 'function') {
                    try {
                        clean[key] = val.toJSON();
                        continue;
                    } catch (e) {
                        clean[key] = "[Unserializable]";
                        continue;
                    }
                }

                // Check prototype to detect non-plain objects
                const proto = Object.getPrototypeOf(val);
                if (proto && proto !== Object.prototype && proto !== Array.prototype) {
                    const constructorName = val.constructor ? val.constructor.name : 'ComplexObject';
                    clean[key] = `[${constructorName}]`;
                    continue;
                }
             }
             
             // Recurse for plain objects/arrays
             clean[key] = cleanDataForAI(val, visited);
        }
    }
    return clean;
};

export const analyzeScheduleWithGemini = async (
  entries: ScheduleEntry[],
  faculty: Faculty[],
  rooms: Room[],
  batches: Batch[],
  subjects: Subject[]
): Promise<AIAnalysisResult> => {
  if (!process.env.API_KEY) return { score: 0, analysis: "API Key missing", suggestions: [] };

  try {
      // 1. Sanitize Data
      const safeEntries = cleanDataForAI(entries);
      
      // 2. Construct Context
      const context = {
        scheduleSummary: `Total Entries: ${entries.length}`,
        constraints: "Hard: No double booking faculty/rooms. Soft: Balanced workload.",
        data: {
          facultyCount: faculty.length,
          roomCount: rooms.length,
          entriesSample: Array.isArray(safeEntries) ? safeEntries.slice(0, 40) : [], 
        }
      };

      // 3. Serialize Safely
      let jsonContext = "";
      try {
        jsonContext = JSON.stringify(context);
      } catch (jsonError) {
        console.error("JSON Stringify failed in analysis:", jsonError);
        jsonContext = JSON.stringify({ error: "Data serialization failed.", summary: context.scheduleSummary });
      }

      const prompt = `
        Act as an expert academic scheduler. Analyze this schedule metadata and partial data. 
        1. Give a quality score from 0-100 based on efficiency and workload balance.
        2. Provide a qualitative analysis paragraph.
        3. List 3 specific actionable suggestions to improve it.
        
        Data: ${jsonContext}
      `;

      const response = await ai.models.generateContent({
        model: REASONING_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.INTEGER },
              analysis: { type: Type.STRING },
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      return result as AIAnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      score: 50,
      analysis: "Could not analyze schedule due to AI service or data error.",
      suggestions: ["Check API Key", "Ensure data is valid", "Retry later"]
    };
  }
};

export const chatWithScheduler = async (
  message: string,
  currentScheduleState: any
): Promise<string> => {
  if (!process.env.API_KEY) return "Please configure your Gemini API Key.";

  try {
      // 1. Sanitize
      const safeState = cleanDataForAI(currentScheduleState);

      // 2. Serialize Safely
      let contextString = "";
      try {
        contextString = JSON.stringify(safeState).substring(0, 5000);
      } catch (e) {
        contextString = "Context unavailable due to data error.";
      }

      const systemInstruction = `
        You are Aether, an intelligent academic operations assistant.
        You help users manage university timetables.
        Current Context: ${contextString}...
        
        Answer briefly and helpfully. If the user asks to move things, explain how you would do it (simulated).
      `;

      const response = await ai.models.generateContent({
        model: CHAT_MODEL,
        contents: message,
        config: { systemInstruction }
      });
      return response.text || "I didn't catch that.";
      
  } catch (error) {
      console.error("Chat Error:", error);
      return "I'm having trouble connecting to my brain right now.";
  }
};

export const generateOptimizationPlan = async (
  request: string,
  availableSlots: string[]
): Promise<any> => {
    if (!process.env.API_KEY) return null;
    try {
        const prompt = `
            User Request: "${request}"
            Available Slots: ${JSON.stringify(availableSlots)}
            Return a JSON object describing the move operation.
            Format: { "action": "MOVE", "targetId": "unknown", "newDay": "Mon", "newSlot": 1, "reason": "..." }
        `;
        const response = await ai.models.generateContent({
            model: REASONING_MODEL,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || "{}");
    } catch (e) {
        console.error("Optimization Plan Error:", e);
        return null;
    }
}

/**
 * Generates a complete timetable using Gemini reasoning with fallback.
 * Can generate for ALL batches (master schedule) or ONE batch (partial) while respecting constraints.
 */
export const generateScheduleWithGemini = async (
    batches: Batch[],
    subjects: Subject[],
    faculty: Faculty[],
    rooms: Room[],
    settings: TimetableSettings,
    generatedSlots: string[],
    targetBatchId?: string, // NEW: If provided, only generate for this batch
    existingSchedule?: ScheduleEntry[] // NEW: Used as a "Busy Mask" for other batches
): Promise<ScheduleEntry[]> => {
    if (!process.env.API_KEY) throw new Error("Gemini API Key missing");

    // 1. Filter Batches: If targetBatchId is set, only send that batch to the AI
    const batchesToSchedule = targetBatchId 
        ? batches.filter(b => b.id === targetBatchId) 
        : batches;

    if (batchesToSchedule.length === 0) {
        throw new Error("No batch found to schedule.");
    }

    // 2. Prepare clean batches with EXPLICIT assignments
    const cleanBatches = batchesToSchedule.map(b => ({ 
        id: b.id, 
        name: b.name, 
        size: b.size,
        fixedRoomId: b.fixedRoomId,
        assignments: (b.subjectAssignments || []).map(a => ({
            subjectId: a.subjectId,
            assignedFacultyIds: a.facultyIds 
        }))
    }));

    // 3. Prepare Constraints from Existing Schedule (The "Busy Mask")
    // If we are scheduling one batch, we must know what rooms/teachers are taken by OTHER batches.
    const busySlots = (existingSchedule || []).map(entry => ({
        day: entry.day,
        slot: entry.slot,
        occupiedRoomId: entry.roomId,
        occupiedFacultyIds: entry.facultyIds || []
    }));

    const cleanSubjects = subjects.map(s => ({ 
        id: s.id, 
        code: s.code, 
        name: s.name, 
        requiredRoomType: s.requiredRoomType, 
        lecturesPerWeek: s.lecturesPerWeek || s.credits || 3 
    }));
    
    const cleanFaculty = faculty.map(f => ({ id: f.id, name: f.name }));
    const cleanRooms = rooms.map(r => ({ id: r.id, name: r.name, type: r.type, capacity: r.capacity }));
    
    const days = settings.workingDays;
    const slots = generatedSlots;
    const totalSlotsPerDay = slots.length;

    // Construct detailed timetable structure for the AI
    const timetableStructure = {
        collegeStartTime: settings.collegeStartTime,
        collegeEndTime: settings.collegeEndTime,
        periodDuration: `${settings.periodDuration} minutes`,
        definedBreaks: settings.breaks.map(b => ({
            name: b.name,
            time: `${b.startTime} - ${b.endTime}`
        })),
        slotsArray: slots // ["09:00 - 10:00", "10:00 - 11:00", etc.]
    };

    const inputData = {
        targetMode: targetBatchId ? "SINGLE_BATCH" : "ALL_BATCHES",
        targetBatchName: targetBatchId ? batchesToSchedule[0].name : "All",
        timetableStructure: timetableStructure,
        batches: cleanBatches,
        subjects: cleanSubjects,
        faculty: cleanFaculty,
        rooms: cleanRooms,
        existingConflicts: busySlots.length > 0 ? "See 'busySlots' field" : "None",
        busySlots: busySlots, // AI must check this list
        config: {
            days,
            totalSlotsPerDay
        }
    };

    // Advanced Prompt for Solving the "University Course Timetabling Problem" (UCTP)
    const prompt = `
        You are the engine of AetherSchedule, a world-class academic constraint solver.
        Your task is to generate a TIMETABLE for: ${targetBatchId ? "The specific batch '" + batchesToSchedule[0].name + "'" : "ALL batches"}.

        *** TIMETABLE STRUCTURE & BREAKS ***
        The institution follows a specific time structure:
        - Class Duration: ${settings.periodDuration} minutes.
        - Start: ${settings.collegeStartTime}, End: ${settings.collegeEndTime}.
        - Breaks: ${JSON.stringify(settings.breaks.map(b => `${b.name} (${b.startTime}-${b.endTime})`))}.
        - Available Slots: ${JSON.stringify(slots)}.
        
        The 'slot' output field corresponds to the 1-based index of the 'Available Slots' array.
        (e.g., Slot 1 = ${slots[0]}, Slot 2 = ${slots[1]}).
        Do not schedule classes during break times (breaks are typically already excluded from the 'Available Slots' list, but be aware of the gap).

        *** CRITICAL INSTRUCTION: STRICT TEACHER ASSIGNMENT ***
        For a given Batch and Subject, you MUST schedule ALL the faculty members listed in 'assignedFacultyIds' for that slot.
        The output must contain an array of faculty IDs, not just one.

        *** CRITICAL INSTRUCTION: FIXED ROOM ASSIGNMENT ***
        If a Batch has a 'fixedRoomId', you MUST schedule all its 'LECTURE' type subjects in that specific Room. 
        'LAB' subjects should still go to a Room with type='LAB'.

        *** CRITICAL INSTRUCTION: GLOBAL CONFLICT AWARENESS ***
        You are provided with a list of 'busySlots' (from other batches). 
        You MUST NOT assign a Faculty member or Room if they appear in 'busySlots' for that specific Day & Slot.
        
        Also, within the schedule you are currently generating:
        - Faculty 'F1' cannot teach Batch 'B1' and Batch 'B2' at the same time.
        - Room 'R1' cannot host Batch 'B1' and Batch 'B2' at the same time.
        - Batch 'B1' cannot have two classes at the same time.

        INPUT DATA:
        ${JSON.stringify(inputData)}

        STRICT CONSTRAINTS (Violating these results in failure):
        1. **Conflict Free**: No double booking of Faculty, Rooms, or Batches (check both internal generation AND external 'busySlots').
        2. **Room Capacity**: Room capacity must be >= Batch size.
        3. **Room Type**: If subject requires 'LAB', it MUST be in a room with type 'LAB'.
        4. **Distribution Constraint**: For 'LECTURE' type subjects, you MUST NOT schedule more than 1 lecture of the same subject on the same day. Spread them across different days.
           EXCEPTION: 'LAB' type subjects SHOULD be scheduled consecutively on the same day.

        OPTIMIZATION GOALS:
        1. **The Lab Problem**: If a subject has 'requiredRoomType' == 'LAB', schedule its 'lecturesPerWeek' as CONSECUTIVE slots (back-to-back) on the SAME day.
        2. **Teacher Fatigue**: Avoid scheduling the same faculty member for more than 4 consecutive slots.
        3. **Completeness**: You MUST schedule exactly 'lecturesPerWeek' slots for EVERY subject for the target batch(es).
        4. **Slot Variance**: For a specific subject (e.g., Math), try to schedule it at different times on different days (e.g., Mon Slot 1, Tue Slot 3) rather than always in the same slot.

        OUTPUT FORMAT:
        Return a JSON Array of objects. Each object represents one class assignment.
        Fields: day (string), slot (1-based int), subjectId, facultyIds (array of strings), roomId, batchId.
    `;

    const responseSchema: Schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                day: { type: Type.STRING },
                slot: { type: Type.INTEGER },
                subjectId: { type: Type.STRING },
                facultyIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                roomId: { type: Type.STRING },
                batchId: { type: Type.STRING },
            },
            required: ["day", "slot", "subjectId", "facultyIds", "roomId", "batchId"]
        }
    };

    try {
        console.log(`Starting ${targetBatchId ? 'Single Batch' : 'Master'} Constraint Solver (Gemini 3.0 Pro)...`);
        const response = await ai.models.generateContent({
            model: REASONING_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        });

        const rawData = JSON.parse(response.text || "[]");
        return processGeneratedSchedule(rawData);

    } catch (primaryError) {
        console.warn("Reasoning model busy. Falling back to Flash model (Optimization quality may decrease)...", primaryError);
        
        try {
            // Fallback to Flash model
            const response = await ai.models.generateContent({
                model: CHAT_MODEL,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema
                }
            });

            const rawData = JSON.parse(response.text || "[]");
            return processGeneratedSchedule(rawData);

        } catch (fallbackError) {
             console.error("Critical Failure: Both AI models failed to solve the schedule.", fallbackError);
             throw new Error("Failed to generate schedule. Please check data validity and try again.");
        }
    }
};

/**
 * Helper to process raw JSON from AI into ScheduleEntry objects
 */
const processGeneratedSchedule = (rawData: any[]): ScheduleEntry[] => {
    return rawData.map((item: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        day: item.day,
        slot: item.slot,
        subjectId: item.subjectId,
        facultyIds: item.facultyIds || [item.facultyId].filter(Boolean), // Normalize to array
        roomId: item.roomId,
        batchId: item.batchId,
        isLocked: false
    }));
};
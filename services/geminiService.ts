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
 */
export const generateScheduleWithGemini = async (
    batches: Batch[],
    subjects: Subject[],
    faculty: Faculty[],
    rooms: Room[],
    settings: TimetableSettings,
    generatedSlots: string[]
): Promise<ScheduleEntry[]> => {
    if (!process.env.API_KEY) throw new Error("Gemini API Key missing");

    // Prepare clean batches with EXPLICIT assignments
    const cleanBatches = batches.map(b => ({ 
        id: b.id, 
        name: b.name, 
        size: b.size,
        fixedRoomId: b.fixedRoomId, // Pass fixed room to AI
        // Send array of assigned faculty IDs
        assignments: (b.subjectAssignments || []).map(a => ({
            subjectId: a.subjectId,
            assignedFacultyIds: a.facultyIds 
        }))
    }));

    const cleanSubjects = subjects.map(s => ({ 
        id: s.id, 
        code: s.code, 
        name: s.name, 
        requiredRoomType: s.requiredRoomType, 
        lecturesPerWeek: s.lecturesPerWeek || s.credits || 3 
    }));
    
    // Faculty list mostly for reference of names/constraints
    const cleanFaculty = faculty.map(f => ({ id: f.id, name: f.name }));
    const cleanRooms = rooms.map(r => ({ id: r.id, name: r.name, type: r.type, capacity: r.capacity }));
    
    const days = settings.workingDays;
    const slots = generatedSlots;
    const totalSlotsPerDay = slots.length;

    const inputData = {
        batches: cleanBatches,
        subjects: cleanSubjects,
        faculty: cleanFaculty,
        rooms: cleanRooms,
        config: {
            days,
            slots,
            totalSlotsPerDay
        }
    };

    // Advanced Prompt for Solving the "University Course Timetabling Problem" (UCTP)
    const prompt = `
        You are the engine of AetherSchedule, a world-class academic constraint solver.
        Your task is to generate a MASTER TIMETABLE for ALL batches simultaneously.

        *** CRITICAL INSTRUCTION: STRICT TEACHER ASSIGNMENT ***
        You must use the 'assignments' array within each Batch object. 
        For a given Batch and Subject, you MUST schedule ALL the faculty members listed in 'assignedFacultyIds' for that slot.
        The output must contain an array of faculty IDs, not just one.

        *** CRITICAL INSTRUCTION: FIXED ROOM ASSIGNMENT ***
        If a Batch has a 'fixedRoomId', you MUST schedule all its 'LECTURE' type subjects in that specific Room. 
        'LAB' subjects should still go to a Room with type='LAB'.

        *** CRITICAL INSTRUCTION: GLOBAL CONFLICT AWARENESS ***
        You must ensure that any Faculty member or Room is NEVER assigned to two different Batches at the same Day & Slot.
        You must maintain a global state of resource usage in your reasoning.

        INPUT DATA:
        ${JSON.stringify(inputData)}

        STRICT CONSTRAINTS (Violating these results in failure):
        1. **Global Faculty Conflict**: Faculty 'F1' cannot teach Batch 'B1' and Batch 'B2' at the same time.
        2. **Global Room Conflict**: Room 'R1' cannot host Batch 'B1' and Batch 'B2' at the same time.
        3. **Batch Conflict**: Batch 'B1' cannot have two classes at the same time.
        4. **Room Capacity**: Room capacity must be >= Batch size.
        5. **Room Type**: If subject requires 'LAB', it MUST be in a room with type 'LAB'. If 'LECTURE', use 'LECTURE' (or the Batch's fixedRoomId if set).

        OPTIMIZATION GOALS (Solve these common timetabling problems):
        1. **The Lab Problem**: If a subject has 'requiredRoomType' == 'LAB', schedule its 'lecturesPerWeek' as CONSECUTIVE slots (back-to-back) in the same day if possible. e.g., Slot 1 & 2.
        2. **Teacher Fatigue**: Avoid scheduling the same faculty member for more than 4 consecutive slots without a break.
        3. **Distribution**: Do NOT schedule the same Subject (Lecture) multiple times on the same day for a Batch (unless it's a Lab). Spread them across the week.
        4. **Completeness**: You MUST schedule exactly 'lecturesPerWeek' slots for EVERY subject for EVERY batch.

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
                facultyIds: { type: Type.ARRAY, items: { type: Type.STRING } }, // Changed to array
                roomId: { type: Type.STRING },
                batchId: { type: Type.STRING },
            },
            required: ["day", "slot", "subjectId", "facultyIds", "roomId", "batchId"]
        }
    };

    try {
        console.log("Starting Global Constraint Solver (Gemini 3.0 Pro)...");
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
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ScheduleEntry, Faculty, Room, Batch, Subject, TimetableSettings } from "../types";

// Initialize Gemini
// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const checkHealth = (): boolean => {
  return !!process.env.API_KEY;
};

// Use Gemini 3.0 Pro Preview for the primary complex reasoning tasks
const REASONING_MODEL = "gemini-3-pro-preview";

// Use Gemini 2.5 Flash for the secondary/fallback model
// Promoted to secondary because it has higher rate limits and handles JSON well.
const SECONDARY_MODEL = "gemini-2.5-flash";

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
        model: SECONDARY_MODEL, // Use Flash for chat to be snappy
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
 * Deterministically checks and fixes conflicts in the generated schedule.
 * "The Repair Layer"
 */
const validateAndRepairSchedule = (
    generatedEntries: ScheduleEntry[],
    existingSchedule: ScheduleEntry[],
    settings: TimetableSettings,
    generatedSlots: string[]
): ScheduleEntry[] => {
    console.log("Starting Deterministic Repair Layer...");
    
    // Create a deep copy to modify
    const repairedSchedule = [...generatedEntries];
    
    // Busy Matrix: Tracks usage of Rooms and Faculty for specific Day/Slot
    // Key: `Day-Slot` -> Set of busy Resource IDs
    const busyMatrix = new Map<string, Set<string>>();

    // 1. Populate Busy Matrix from Existing Schedule (Global Context)
    existingSchedule.forEach(entry => {
        const key = `${entry.day}-${entry.slot}`;
        if (!busyMatrix.has(key)) busyMatrix.set(key, new Set());
        
        const busySet = busyMatrix.get(key)!;
        busySet.add(`ROOM:${entry.roomId}`);
        (entry.facultyIds || []).forEach(fid => busySet.add(`FAC:${fid}`));
    });

    // 2. Iterate and Fix
    for (let i = 0; i < repairedSchedule.length; i++) {
        const entry = repairedSchedule[i];
        let currentKey = `${entry.day}-${entry.slot}`;
        
        // Check for conflicts
        // A conflict exists if ANY of the entry's resources are already in the busy set for this slot
        
        let isConflict = false;
        let busySet = busyMatrix.get(currentKey);
        
        if (busySet) {
             if (busySet.has(`ROOM:${entry.roomId}`)) isConflict = true;
             (entry.facultyIds || []).forEach(fid => {
                 if (busySet!.has(`FAC:${fid}`)) isConflict = true;
             });
        }

        if (isConflict) {
            console.warn(`Conflict detected for ${entry.subjectId} at ${currentKey}. Attempting repair...`);
            
            // Find a new slot
            let foundSlot = false;
            
            // Iterate all possible slots
            for (const day of settings.workingDays) {
                if (foundSlot) break;
                for (let slotIdx = 1; slotIdx <= generatedSlots.length; slotIdx++) {
                    const candidateKey = `${day}-${slotIdx}`;
                    
                    // Check if candidate slot is busy
                    const candidateBusySet = busyMatrix.get(candidateKey);
                    let candidateHasConflict = false;
                    
                    if (candidateBusySet) {
                        if (candidateBusySet.has(`ROOM:${entry.roomId}`)) candidateHasConflict = true;
                        (entry.facultyIds || []).forEach(fid => {
                            if (candidateBusySet.has(`FAC:${fid}`)) candidateHasConflict = true;
                        });
                    }
                    
                    if (!candidateHasConflict) {
                        // Found a free slot! Move it.
                        entry.day = day;
                        entry.slot = slotIdx;
                        foundSlot = true;
                        console.log(`-> Moved to ${day}-${slotIdx}`);
                        break;
                    }
                }
            }
            
            if (!foundSlot) {
                console.error(`CRITICAL: Could not find any valid slot for ${entry.subjectId}. Left in conflicting state.`);
            }
        }

        // 3. Register this entry into the Busy Matrix so subsequent entries don't clash with it
        const finalKey = `${entry.day}-${entry.slot}`;
        if (!busyMatrix.has(finalKey)) busyMatrix.set(finalKey, new Set());
        const finalSet = busyMatrix.get(finalKey)!;
        
        finalSet.add(`ROOM:${entry.roomId}`);
        (entry.facultyIds || []).forEach(fid => finalSet.add(`FAC:${fid}`));
    }
    
    return repairedSchedule;
};

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

    // Hyper-Advanced Prompt for Solving the "University Course Timetabling Problem" (UCTP)
    // Version 5.0: Deep Verification Mode
    const prompt = `
        You are AetherSchedule's Hyper-Intelligent Constraint Solver Engine (Version 5.0).
        Your objective is to generate a mathematically PERFECT, CONFLICT-FREE timetable for: ${targetBatchId ? "The specific batch '" + batchesToSchedule[0].name + "'" : "ALL batches"}.

        *** EXECUTION PROTOCOL: DEEP VERIFICATION (TAKE YOUR TIME) ***
        1. Accuracy is the ONLY metric. Do not rush.
        2. For every single class you attempt to place, you MUST perform a "Virtual Collision Check" against the 'busySlots' list.
        3. If 'busySlots' says Room R is taken on Mon-1, you CANNOT place another class in Room R on Mon-1.
        4. If you encounter a deadlock (no slots left), you MUST BACKTRACK and move a previous class to free up space. Simulate a backtracking algorithm.

        *** PHASE 1: TEMPORAL TOPOLOGY ***
        - Class Duration: ${settings.periodDuration} min.
        - Working Days: ${JSON.stringify(days)}.
        - Valid Slot Indices: 1 to ${slots.length}.
        - Breaks: ${JSON.stringify(settings.breaks.map(b => `${b.name}`))} (Absolute No-Fly Zones).

        *** PHASE 2: THE "BUSY MASK" (GLOBAL CONFLICTS) ***
        You are provided with 'busySlots'. This represents the spacetime coordinates already occupied by the rest of the universe.
        CRITICAL RULE: If {Day: D, Slot: S} contains RoomID: R or FacultyID: F in 'busySlots', you CANNOT place them there. 
        Treat this as a hard boundary condition.

        *** PHASE 3: ALGORITHMIC EXECUTION STEPS ***
        Execute this prioritized heuristic strategy:

        1.  **Priority 1: The "Big Rocks" (Labs & Practicals)**
            -   Identify subjects where 'requiredRoomType' == 'LAB'.
            -   These MUST be scheduled as **consecutive blocks** (e.g., Slot 1-2 or 3-4) on the same day.
            -   Optimization: Place these on days with fewer existing global conflicts.
            -   Action: Assign ALL 'assignedFacultyIds' to these slots.

        2.  **Priority 2: Fixed Constraints (Anchors)**
            -   Batches with 'fixedRoomId' MUST use that room for all LECTURE subjects.
            -   Subjects with specific 'assignedFacultyIds' MUST use those exact teachers.

        3.  **Priority 3: Intelligent Distribution (Lectures)**
            -   **Pattern Matching**: For a subject with 3 lectures/week, prefer an "Every Other Day" pattern (e.g., Mon-Wed-Fri or Tue-Thu-Sat).
            -   **Slot Variance**: Never schedule the same subject at the same time slot every day. Rotate them (Morning vs Afternoon).
            -   **Load Balancing**: Distribute the total daily workload evenly. Avoid creating a "Hell Day" with 8 hours while another day has 2.

        4.  **Priority 4: Gap Minimization (Student Experience)**
            -   Minimize "Swiss Cheese" schedules (1-hour gaps between classes). 
            -   Group lectures into contiguous blocks of 2-3 hours.

        *** STRICT VALIDATION RULES (ZERO TOLERANCE) ***
        1.  **Double Booking**: A Faculty or Room cannot exist in two places at once (Check against Internal Schedule AND 'busySlots').
        2.  **Completeness**: Total slots generated for Subject X must EXACTLY equal 'lecturesPerWeek'.
        3.  **Room Suitability**: LAB subjects go to LAB rooms. LECTURE subjects go to LECTURE rooms.
        4.  **Daily Uniqueness**: A Batch cannot have the same Subject (Lecture) twice in one day (unless it is a Lab).

        *** INPUT DATA ***
        ${JSON.stringify(inputData)}

        *** OUTPUT ***
        Return strictly a JSON Array of schedule objects.
        [{ "day": "Mon", "slot": 1, "subjectId": "...", "facultyIds": ["..."], "roomId": "...", "batchId": "..." }]
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

    let rawSchedule: any[] = [];

    // Attempt 1: Gemini 3.0 Pro (Reasoning)
    try {
        console.log(`[Attempt 1] Starting Advanced Constraint Solver (${REASONING_MODEL})...`);
        const response = await ai.models.generateContent({
            model: REASONING_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        });
        rawSchedule = JSON.parse(response.text || "[]");

    } catch (primaryError: any) {
        console.warn(`[Attempt 1 Failed] ${REASONING_MODEL} busy/quota. Falling back to Secondary model...`, primaryError);
        
        // Attempt 2: Gemini 2.5 Flash (High Availability)
        // We use Flash as the immediate backup because it has higher limits than other Pro models.
        try {
            console.log(`[Attempt 2] Starting Constraint Solver (${SECONDARY_MODEL})...`);
            const response = await ai.models.generateContent({
                model: SECONDARY_MODEL,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema
                }
            });
            rawSchedule = JSON.parse(response.text || "[]");

        } catch (secondaryError: any) {
             console.error("Critical Failure: Both AI models failed.", secondaryError);
             
             if (primaryError?.status === 429 || secondaryError?.status === 429) {
                 throw new Error("AI Service Busy (Rate Limit Exceeded). Please wait 30 seconds and try again.");
             }
             throw new Error("Failed to generate schedule. Please check data validity and try again.");
        }
    }

    // Process raw schedule into proper objects
    let processedSchedule = processGeneratedSchedule(rawSchedule);

    // Run Deterministic Repair to ensure conflict-free result
    // We pass the existing schedule so it can check against global constraints
    processedSchedule = validateAndRepairSchedule(processedSchedule, existingSchedule || [], settings, generatedSlots);

    return processedSchedule;
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
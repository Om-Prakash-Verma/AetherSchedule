import { TimetableSettings } from "../types";

export const DEFAULT_SETTINGS: TimetableSettings = {
    collegeStartTime: "09:00",
    collegeEndTime: "17:00",
    periodDuration: 60,
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    breaks: [
        { id: 'b1', name: 'Lunch Break', startTime: "13:00", endTime: "14:00" }
    ]
};

// Helper to generate readable IDs
// Format: PREFIX-SLUG-SUFFIX (e.g., FAC-JOHN-DOE-X9A)
export const generateReadableId = (prefix: string, name: string): string => {
    const slug = name
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .substring(0, 20); // Limit slug length
    
    // Add short random suffix to ensure uniqueness even if names are identical
    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    
    return `${prefix}-${slug}-${suffix}`;
};
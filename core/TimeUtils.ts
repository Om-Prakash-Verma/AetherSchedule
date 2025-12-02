import { TimetableSettings } from "../types";

/**
 * Converts "HH:mm" string to minutes from midnight.
 */
export const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

/**
 * Converts minutes from midnight to "HH:mm" string (24h format).
 */
export const minutesToTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Formats minutes into a readable 12-hour format with AM/PM (e.g., "09:00 AM").
 */
export const minutesToReadableTime = (minutes: number): string => {
    let h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // the hour '0' should be '12'
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
};

/**
 * Generates an array of time slot strings based on settings.
 * Handles breaks by skipping overlapping periods.
 * Returns array of strings like "09:00 AM - 10:00 AM".
 */
export const generateTimeSlots = (settings: TimetableSettings): string[] => {
    const slots: string[] = [];
    const startMins = timeToMinutes(settings.collegeStartTime);
    const endMins = timeToMinutes(settings.collegeEndTime);
    const duration = settings.periodDuration;

    // Sort breaks by start time to handle them in order
    const sortedBreaks = [...settings.breaks].sort((a, b) => 
        timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );

    let current = startMins;

    // Safety break to prevent infinite loops in case of bad data
    let iterations = 0;
    const MAX_ITERATIONS = 50; 

    while (current + duration <= endMins && iterations < MAX_ITERATIONS) {
        iterations++;
        
        // 1. Check if we are currently INSIDE a break or AT the start of a break
        // We find if 'current' falls within [breakStart, breakEnd)
        const breakAtCurrent = sortedBreaks.find(b => {
            const bStart = timeToMinutes(b.startTime);
            const bEnd = timeToMinutes(b.endTime);
            return current >= bStart && current < bEnd;
        });

        if (breakAtCurrent) {
            // Jump to the end of this break
            current = timeToMinutes(breakAtCurrent.endTime);
            continue;
        }

        // 2. Calculate potential slot end
        const proposedEnd = current + duration;

        // 3. Check if this proposed slot [current, proposedEnd] overlaps with any break
        // Overlap condition: SlotStart < BreakEnd && SlotEnd > BreakStart
        const overlappingBreak = sortedBreaks.find(b => {
            const bStart = timeToMinutes(b.startTime);
            const bEnd = timeToMinutes(b.endTime);
            return current < bEnd && proposedEnd > bStart;
        });

        if (overlappingBreak) {
            // If the slot would be cut off by a break, we discard this slot
            // and move our current pointer to the END of that break.
            current = timeToMinutes(overlappingBreak.endTime);
            continue;
        }

        // 4. Check if slot exceeds college end time
        if (proposedEnd > endMins) {
            break;
        }

        // 5. Valid Slot - Add it
        const startStr = minutesToReadableTime(current);
        const endStr = minutesToReadableTime(proposedEnd);
        slots.push(`${startStr} - ${endStr}`);

        // 6. Move to next slot
        current += duration;
    }

    return slots;
};

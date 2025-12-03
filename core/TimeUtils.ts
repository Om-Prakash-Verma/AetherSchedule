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

export interface TimelineItem {
    type: 'SLOT' | 'BREAK';
    name: string;
    startTime: number;
    endTime: number;
    timeString: string;
    slotIndex?: number; // Only for slots
}

/**
 * Generates an ordered timeline including both class slots and breaks.
 */
export const generateTimeline = (settings: TimetableSettings): TimelineItem[] => {
    const timeline: TimelineItem[] = [];
    const startMins = timeToMinutes(settings.collegeStartTime);
    const endMins = timeToMinutes(settings.collegeEndTime);
    const duration = settings.periodDuration;

    // Prepare breaks with minute values
    const breaks = (settings.breaks || []).map(b => ({
        ...b,
        start: timeToMinutes(b.startTime),
        end: timeToMinutes(b.endTime)
    })).sort((a, b) => a.start - b.start);

    let current = startMins;
    let slotCounter = 1;
    let iterations = 0;
    const MAX_ITERATIONS = 50;

    while (current < endMins && iterations < MAX_ITERATIONS) {
        iterations++;

        // 1. Check if we match a break start exactly
        const breakAtCurrent = breaks.find(b => b.start === current);
        if (breakAtCurrent) {
            timeline.push({
                type: 'BREAK',
                name: breakAtCurrent.name,
                startTime: breakAtCurrent.start,
                endTime: breakAtCurrent.end,
                timeString: `${minutesToReadableTime(breakAtCurrent.start)} - ${minutesToReadableTime(breakAtCurrent.end)}`
            });
            current = breakAtCurrent.end;
            continue;
        }

        const proposedEnd = current + duration;

        // 2. Check for overlapping breaks
        // If a break exists that starts after current time but before the proposed end time
        const overlappingBreak = breaks.find(b => current < b.end && proposedEnd > b.start);

        if (overlappingBreak) {
            // Gap detected or partial slot. 
            // If the break starts strictly after current, we technically have a gap. 
            // In this implementation, we skip to the break start to prioritize displaying the break.
            if (overlappingBreak.start > current) {
                current = overlappingBreak.start;
                continue; // Next iteration will pick up the breakAtCurrent logic
            } else {
                // We are inside a break (should have been caught by breakAtCurrent if aligned)
                // or break started before current. Jump to end of break.
                current = overlappingBreak.end;
                continue;
            }
        }

        // 3. Valid Slot
        if (proposedEnd > endMins) break;

        timeline.push({
            type: 'SLOT',
            name: `Slot ${slotCounter}`,
            startTime: current,
            endTime: proposedEnd,
            timeString: `${minutesToReadableTime(current)} - ${minutesToReadableTime(proposedEnd)}`,
            slotIndex: slotCounter
        });
        
        slotCounter++;
        current = proposedEnd;
    }

    return timeline;
};

/**
 * Generates an array of time slot strings based on settings.
 * Now wraps generateTimeline to maintain consistency.
 * Returns array of strings like "09:00 AM - 10:00 AM".
 */
export const generateTimeSlots = (settings: TimetableSettings): string[] => {
    const timeline = generateTimeline(settings);
    return timeline
        .filter(item => item.type === 'SLOT')
        .map(item => item.timeString);
};
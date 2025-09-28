import type { TimetableSettings } from '../types';

export const generateTimeSlots = (settings: TimetableSettings): string[] => {
    // 1. Robust initial validation to prevent crashes from invalid settings.
    if (!settings || !settings.collegeStartTime || !settings.collegeEndTime || !settings.periodDuration || settings.periodDuration <= 0) {
        console.warn("Invalid or incomplete timetable settings provided to generateTimeSlots:", settings);
        return [];
    }

    try {
        const slots: string[] = [];
        const today = '1970-01-01T'; 
        let currentTime = new Date(`${today}${settings.collegeStartTime}:00`);
        const endTime = new Date(`${today}${settings.collegeEndTime}:00`);

        if (isNaN(currentTime.getTime()) || isNaN(endTime.getTime()) || currentTime >= endTime) {
             console.error("Invalid start/end times in timetable settings, cannot generate slots:", settings);
             return [];
        }

        const breaks = (settings.breaks || []).map(b => {
            const start = new Date(`${today}${b.startTime}:00`);
            const end = new Date(`${today}${b.endTime}:00`);
            if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) return null;
            return { name: b.name, start, end };
        }).filter(b => b !== null) as { name: string; start: Date; end: Date }[];
        
        // Sort breaks by start time to handle them chronologically.
        breaks.sort((a, b) => a.start.getTime() - b.start.getTime());

        // New logic: Flow through time, jumping over breaks.
        while (currentTime < endTime) {
            let inBreak = false;
            // Check if the current time falls inside any break.
            for (const b of breaks) {
                if (currentTime >= b.start && currentTime < b.end) {
                    // If so, jump the current time to the end of that break.
                    currentTime = b.end;
                    inBreak = true;
                    break; 
                }
            }
            // If we jumped, restart the loop to re-evaluate the new time.
            if (inBreak) {
                continue;
            }

            // If we are not in a break, we can try to create a new slot.
            const slotEndTime = new Date(currentTime.getTime() + settings.periodDuration * 60000);

            // If the slot would end after the college day ends, we stop.
            if (slotEndTime > endTime) {
                break;
            }
            
            let crossesBreak = false;
            // Check if the slot we are about to create would run into a future break.
            for (const b of breaks) {
                // A crossover happens if the slot ends after a break starts, 
                // and the slot starts before that same break ends.
                if (slotEndTime > b.start && currentTime < b.end) {
                    crossesBreak = true;
                    // If it does, we discard this potential slot and jump our clock
                    // to the end of the break it would have violated.
                    currentTime = b.end;
                    break;
                }
            }
            // If we found a crossover, restart the main loop.
            if(crossesBreak) {
                continue;
            }

            // If we've passed all checks, this is a valid class slot.
            const formatTime = (date: Date) => date.toTimeString().substring(0, 5);
            slots.push(`${formatTime(currentTime)} - ${formatTime(slotEndTime)}`);
            
            // Advance the clock to the end of the slot we just created.
            currentTime = slotEndTime;
        }

        return slots;

    } catch (error) {
        console.error("A critical error occurred while generating time slots:", error, "Settings:", settings);
        return []; 
    }
};
import type { GeneratedTimetable, Subject, Faculty, Room, Batch } from '../types';
// FIX: Removed TIME_SLOTS import. The slots are now dynamically generated and passed as a parameter.
import { DAYS_OF_WEEK } from '../constants';

const escapeCsvCell = (cell: string) => `"${cell.replace(/"/g, '""')}"`;

const flattenTimetableForExport = (timetable: GeneratedTimetable['timetable']) => {
    const grid: Record<number, Record<number, any[]>> = {};
    Object.values(timetable).forEach(batchGrid => {
        Object.entries(batchGrid).forEach(([day, slots]) => {
            const dayIdx = parseInt(day, 10);
            if (!grid[dayIdx]) grid[dayIdx] = {};
            Object.entries(slots).forEach(([slot, assignment]) => {
                const slotIdx = parseInt(slot, 10);
                if (!grid[dayIdx][slotIdx]) grid[dayIdx][slotIdx] = [];
                grid[dayIdx][slotIdx].push(assignment);
            });
        });
    });
    return grid;
};

export const exportTimetableToCsv = (
    timetableData: GeneratedTimetable,
    // The first batch is used for naming, but all data is included
    firstBatch: Batch, 
    subjects: Subject[],
    faculty: Faculty[],
    rooms: Room[],
    // FIX: Added timeSlots as a parameter to support dynamic slot generation.
    timeSlots: string[]
) => {
    const flatGrid = flattenTimetableForExport(timetableData.timetable);
    let csvContent = "data:text/csv;charset=utf-8,";

    // Header Row
    const headerRow = ['Time Slot', ...DAYS_OF_WEEK].map(escapeCsvCell).join(',');
    csvContent += headerRow + '\r\n';

    // Data Rows
    // FIX: Use the passed timeSlots array instead of the old constant.
    timeSlots.forEach((slot, slotIndex) => {
        const row = [slot];
        DAYS_OF_WEEK.forEach((_, dayIndex) => {
            const assignments = flatGrid[dayIndex]?.[slotIndex];
            if (assignments && assignments.length > 0) {
                const cellContent = assignments.map(assignment => {
                    const subject = subjects.find(s => s.id === assignment.subjectId)?.name || 'N/A';
                    const facultyMember = faculty.find(f => f.id === assignment.facultyId)?.name || 'N/A';
                    const room = rooms.find(r => r.id === assignment.roomId)?.name || 'N/A';
                    const batchName = firstBatch.name; // Simplified for now
                    return `${subject} (${batchName})\\n${facultyMember}\\n@${room}`;
                }).join('\\n---\\n');
                row.push(cellContent);
            } else {
                row.push('');
            }
        });
        csvContent += row.map(escapeCsvCell).join(',') + '\r\n';
    });

    // Trigger Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileName = timetableData.batchIds.length > 1 ? 'master_timetable' : `timetable_${firstBatch.name.replace(/ /g, '_')}`;
    link.setAttribute("download", `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


const toIcsDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export const exportTimetableToIcs = (
    timetableData: GeneratedTimetable,
    firstBatch: Batch, // Used for naming convention
    subjects: Subject[],
    faculty: Faculty[],
    rooms: Room[],
    // FIX: Added timeSlots as a parameter to support dynamic slot generation.
    timeSlots: string[]
) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
    const monday = new Date(today);
    // Adjust to the upcoming Monday (or today if it is Monday)
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? -6 : dayOfWeek - 1));

    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//AetherSchedule//Smart Timetable//EN',
    ];

    const allAssignments = Object.values(timetableData.timetable).flatMap(batchGrid => 
        Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
    );

    allAssignments.forEach(assignment => {
        const subject = subjects.find(s => s.id === assignment.subjectId);
        const facultyMember = faculty.find(f => f.id === assignment.facultyId);
        const room = rooms.find(r => r.id === assignment.roomId);
        
        if (!subject || !facultyMember || !room) return;
        
        // FIX: Use the passed timeSlots array to determine the start time.
        const startHour = parseInt(timeSlots[assignment.slot].split(' ')[0].split(':')[0]);
        
        const eventDate = new Date(monday);
        eventDate.setDate(monday.getDate() + assignment.day);
        
        const startDate = new Date(eventDate);
        startDate.setHours(startHour, 0, 0, 0);
        
        const endDate = new Date(startDate);
        endDate.setHours(startDate.getHours() + 1);

        icsContent.push('BEGIN:VEVENT');
        icsContent.push(`DTSTAMP:${toIcsDate(new Date())}`);
        icsContent.push(`UID:${assignment.id}@aetherschedule`);
        icsContent.push(`DTSTART:${toIcsDate(startDate)}`);
        icsContent.push(`DTEND:${toIcsDate(endDate)}`);
        icsContent.push(`SUMMARY:${subject.name} (Batch ID: ${assignment.batchId})`);
        icsContent.push(`LOCATION:${room.name}`);
        icsContent.push(`DESCRIPTION:Subject: ${subject.name}\\nFaculty: ${facultyMember.name}\\nRoom: ${room.name}\\nBatch ID: ${assignment.batchId}`);
        // Recur weekly for a semester (e.g., 15 weeks)
        icsContent.push('RRULE:FREQ=WEEKLY;COUNT=15');
        icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');
    
    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = timetableData.batchIds.length > 1 ? 'master_timetable' : `timetable_${firstBatch.name.replace(/ /g, '_')}`;
    link.download = `${fileName}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
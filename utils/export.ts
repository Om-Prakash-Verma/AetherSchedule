import type { GeneratedTimetable, Subject, Faculty, Room, Batch } from '../types';
import { DAYS_OF_WEEK } from '../constants';

export const exportTimetableToPdf = (
    timetableData: GeneratedTimetable,
    subjects: Subject[],
    faculty: Faculty[],
    rooms: Room[],
    timeSlots: string[],
    batches: Batch[]
) => {
    const includedBatchNames = timetableData.batchIds.map(id => batches.find(b => b.id === id)?.name || id).join(', ');
    const allAssignments = Object.values(timetableData.timetable).flatMap(batchGrid => 
        Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
    );

    allAssignments.sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        return a.slot - b.slot;
    });

    let tableRowsHtml = '';
    DAYS_OF_WEEK.forEach((dayName, dayIndex) => {
        const assignmentsForDay = allAssignments.filter(a => a.day === dayIndex);
        if (assignmentsForDay.length > 0) {
            tableRowsHtml += `
                <tr><td colspan="7" class="day-header">📅 ${dayName.toUpperCase()}</td></tr>
                <tr class="table-header">
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Batch</th>
                    <th>Subject Code</th>
                    <th>Subject Name</th>
                    <th>Faculty(s)</th>
                    <th>Room</th>
                </tr>
            `;
            assignmentsForDay.forEach(assignment => {
                const subject = subjects.find(s => s.id === assignment.subjectId);
                const facultyMembers = faculty.filter(f => assignment.facultyIds.includes(f.id));
                const room = rooms.find(r => r.id === assignment.roomId);
                const batch = batches.find(b => b.id === assignment.batchId);
                const timeSlot = timeSlots[assignment.slot] || '00:00 - 00:00';
                const [startTime, endTime] = timeSlot.split(' - ');
                
                tableRowsHtml += `
                    <tr>
                        <td>${startTime}</td>
                        <td>${endTime}</td>
                        <td>${batch?.name || 'Unknown'}</td>
                        <td>${subject?.code || 'N/A'}</td>
                        <td>${subject?.name || 'N/A'}</td>
                        <td>${facultyMembers.map(f => f.name).join(', ') || 'N/A'}</td>
                        <td>${room?.name || 'N/A'}</td>
                    </tr>
                `;
            });
        }
    });
    
    const htmlContent = `
        <html>
            <head>
                <title>Timetable Export - ${includedBatchNames}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
                    body { font-family: 'Inter', sans-serif; margin: 20px; }
                    .report-header { text-align: center; margin-bottom: 20px; }
                    .report-header h1 { font-size: 24px; margin: 0; }
                    .report-header h2 { font-size: 18px; margin: 5px 0; color: #555; }
                    .report-header p { font-size: 12px; color: #777; }
                    .timetable { width: 100%; border-collapse: collapse; }
                    .timetable th, .timetable td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
                    .day-header { background-color: #f0f0f0; font-weight: bold; text-align: center; font-size: 16px; padding: 12px; }
                    .table-header { background-color: #f9f9f9; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="report-header">
                    <h1>AetherSchedule - Timetable Report</h1>
                    <h2>Batches: ${includedBatchNames}</h2>
                    <p>Generated on: ${new Date().toLocaleString()}</p>
                </div>
                <table class="timetable">
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
            </body>
        </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.left = '-9999px'; // Move it off-screen
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
        
        // Wait for iframe content to load before printing
        iframe.onload = () => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            // Clean up after a short delay
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 500);
        };
    } else {
        console.error("Could not create document for printing.");
         document.body.removeChild(iframe);
    }
};


const toIcsDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export const exportTimetableToIcs = (
    timetableData: GeneratedTimetable,
    firstBatch: Batch,
    subjects: Subject[],
    faculty: Faculty[],
    rooms: Room[],
    timeSlots: string[]
) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
    const monday = new Date(today);
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
        const facultyMembers = faculty.filter(f => assignment.facultyIds.includes(f.id));
        const room = rooms.find(r => r.id === assignment.roomId);
        
        if (!subject || facultyMembers.length === 0 || !room) return;
        
        const facultyNames = facultyMembers.map(f => f.name).join(', ');

        const timeSlot = timeSlots[assignment.slot];
        if (!timeSlot) return;

        const [startTimeStr] = timeSlot.split(' - ');
        const [startHour, startMinute] = startTimeStr.split(':').map(Number);
        
        const eventDate = new Date(monday);
        eventDate.setDate(monday.getDate() + assignment.day);
        
        const startDate = new Date(eventDate);
        startDate.setHours(startHour, startMinute, 0, 0);
        
        const endDate = new Date(startDate);
        endDate.setHours(startDate.getHours() + 1);

        icsContent.push('BEGIN:VEVENT');
        icsContent.push(`DTSTAMP:${toIcsDate(new Date())}`);
        icsContent.push(`UID:${assignment.id}@aetherschedule`);
        icsContent.push(`DTSTART:${toIcsDate(startDate)}`);
        icsContent.push(`DTEND:${toIcsDate(endDate)}`);
        icsContent.push(`SUMMARY:${subject.name} (Batch ID: ${assignment.batchId})`);
        icsContent.push(`LOCATION:${room.name}`);
        icsContent.push(`DESCRIPTION:Subject: ${subject.name}\\nFaculty: ${facultyNames}\\nRoom: ${room.name}\\nBatch ID: ${assignment.batchId}`);
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
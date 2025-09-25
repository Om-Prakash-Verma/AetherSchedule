import type { User, Subject, Faculty, Room, Batch, Department, GeneratedTimetable, Constraints, GlobalConstraints } from '../types';

// --- BASE USERS ---
const baseUsers: User[] = [
  { id: 'user_super_admin', name: 'Super Admin', email: 'super.admin@test.com', role: 'SuperAdmin' },
  { id: 'user_timetable_manager', name: 'Timetable Manager', email: 'manager@test.com', role: 'TimetableManager' },
  { id: 'user_cs_hod', name: 'CS Department Head', email: 'cs.hod@test.com', role: 'DepartmentHead' },
  { id: 'user_ee_hod', name: 'EE Department Head', email: 'ee.hod@test.com', role: 'DepartmentHead' },
  { id: 'user_me_hod', name: 'ME Department Head', email: 'me.hod@test.com', role: 'DepartmentHead' },
  { id: 'user_ce_hod', name: 'CE Department Head', email: 'ce.hod@test.com', role: 'DepartmentHead' },
];

// --- DEPARTMENTS ---
const departments: Department[] = [
  { id: 'dept_cs', name: 'Computer Science & Engineering', code: 'CS' },
  { id: 'dept_ee', name: 'Electrical Engineering', code: 'EE' },
  { id: 'dept_me', name: 'Mechanical Engineering', code: 'ME' },
  { id: 'dept_ce', name: 'Civil Engineering', code: 'CE' },
];

// --- GENERATE SUBJECTS (20) ---
const subjects: Subject[] = [];
const subjectTypes: Subject['type'][] = ['Theory', 'Practical', 'Workshop'];
let subjectCounter = 1;
for (const dept of departments) {
    for (let i = 1; i <= 5; i++) { // 5 subjects per department
        const type = subjectTypes[i % 3];
        const hours = type === 'Theory' ? 5 : (type === 'Practical' ? 4 : 3);
        subjects.push({
            id: `sub_${dept.code.toLowerCase()}_${subjectCounter}`,
            name: `${dept.name} Subject ${i}`,
            code: `${dept.code}${100 + subjectCounter}`,
            type: type,
            credits: Math.floor(hours / 1.5),
            hoursPerWeek: hours,
        });
        subjectCounter++;
    }
}
// Add one generic subject for pinned events
subjects.push({ id: 'sub_gen001', name: 'Guest Lecture', code: 'GEN001', type: 'Workshop', credits: 0, hoursPerWeek: 2 });


// --- GENERATE ROOMS (20) ---
const rooms: Room[] = [];
const roomTypes: Room['type'][] = ['Lecture Hall', 'Lab', 'Workshop'];
for (let i = 1; i <= 20; i++) {
    const type = roomTypes[i % 3];
    const capacity = 500;
    rooms.push({
        id: `room_${i}`,
        name: `${type.split(' ')[0]}-${i}`,
        capacity: capacity,
        type: type,
    });
}
rooms.push({ id: 'room_seminar', name: 'Main Seminar Hall', capacity: 500, type: 'Lecture Hall' });


// --- GENERATE BATCHES (20) ---
const batches: Batch[] = [];
let batchCounter = 1;
for (const dept of departments) {
    for (const sem of [1, 3, 5]) {
        for (const section of ['A', 'B']) {
            if (batches.length >= 20) break;
            const batchSubjects = subjects
                .filter(s => s.code.startsWith(dept.code))
                .sort(() => 0.5 - Math.random())
                .slice(0, 5); // Each batch takes 5 subjects from its department

            batches.push({
                id: `batch_${dept.code.toLowerCase()}_s${sem}_${section.toLowerCase()}_${batchCounter}`,
                name: `${dept.code} S${sem} ${section}`,
                departmentId: dept.id,
                semester: sem,
                studentCount: 60 + (batchCounter % 10),
                subjectIds: batchSubjects.map(s => s.id),
            });
            batchCounter++;
        }
        if (batches.length >= 20) break;
    }
    if (batches.length >= 20) break;
}

// --- GENERATE FACULTY (100) & USERS ---
const faculty: Faculty[] = [];
const facultyUsers: User[] = [];
const subjectTaughtCount = new Map(subjects.map(s => [s.id, 0]));

for (let i = 1; i <= 100; i++) {
    const facultyId = `fac_${i}`;
    const userId = `user_fac_${i}`;
    const facultyName = `Professor ${i}`;
    const assignedSubjectIds: string[] = [];

    // Ensure every subject is taught by at least 3 faculty members
    let subjectToAssign: string | null = null;
    for (const [subjectId, count] of subjectTaughtCount.entries()) {
        if (count < 3 && subjectId !== 'sub_gen001') {
            subjectToAssign = subjectId;
            break;
        }
    }
    
    if (subjectToAssign) {
        assignedSubjectIds.push(subjectToAssign);
        subjectTaughtCount.set(subjectToAssign, subjectTaughtCount.get(subjectToAssign)! + 1);
    } else {
        // If all subjects are covered, assign a random one
        const randomSubject = subjects[Math.floor(Math.random() * (subjects.length -1))]; // Exclude GEN001
        assignedSubjectIds.push(randomSubject.id);
    }

    // Assign a second subject for variety
    if (Math.random() > 0.4) {
        const randomSubject2 = subjects[Math.floor(Math.random() * (subjects.length -1))];
        if (!assignedSubjectIds.includes(randomSubject2.id)) {
            assignedSubjectIds.push(randomSubject2.id);
        }
    }

    faculty.push({ id: facultyId, name: facultyName, subjectIds: assignedSubjectIds, userId: userId });
    facultyUsers.push({ id: userId, name: facultyName, email: `prof.${i}@test.com`, role: 'Faculty', facultyId: facultyId });
}

// Add special faculty for guest lecture
faculty.push({ id: 'fac_guest', name: 'Guest Lecturer', subjectIds: ['sub_gen001'], userId: null });

const users: User[] = [...baseUsers, ...facultyUsers];

// --- GENERATE STUDENT USERS ---
batches.forEach(batch => {
  const userEmail = `${batch.name.toLowerCase().replace(/\s+/g, '_')}@test.com`;
  users.push({
    id: `user_batch_${batch.id}`,
    name: `${batch.name} Student Rep`,
    email: userEmail,
    role: 'Student',
    batchId: batch.id,
  });
});

// --- EMPTY TIMETABLES ---
const generatedTimetables: GeneratedTimetable[] = [];

// --- GLOBAL CONSTRAINTS ---
const globalConstraints: GlobalConstraints = {
    id: 1,
    studentGapWeight: 5,
    facultyGapWeight: 5,
    facultyWorkloadDistributionWeight: 10,
    facultyPreferenceWeight: 2,
    aiStudentGapWeight: 5,
    aiFacultyGapWeight: 5,
    aiFacultyWorkloadDistributionWeight: 10,
    aiFacultyPreferenceWeight: 2,
};

// --- EXAMPLE CONSTRAINTS USING NEW DATA ---
const constraints: Constraints = {
    pinnedAssignments: [
      {
        id: 'pin_guest_lecture_1',
        name: 'Mandatory Guest Lecture',
        subjectId: 'sub_gen001',
        facultyId: 'fac_guest',
        roomId: 'room_seminar',
        batchId: batches[0]?.id || '', // Pin to the first batch
        day: 4, // Friday
        startSlot: 4, // 13:00 - 14:00
        duration: 2,
      }
    ],
    plannedLeaves: [
      {
        id: 'leave_prof5_conf',
        facultyId: 'fac_5', // Professor 5
        startDate: '2024-10-14',
        endDate: '2024-10-18',
        reason: 'Attending Conference'
      }
    ],
    facultyAvailability: [
        {
            facultyId: 'fac_1', // Professor 1
            availability: {
                0: [3, 4, 5, 6, 7], // Not available Mon morning
                1: [0, 1, 2, 3, 4, 5, 6, 7],
                2: [0, 1, 2, 3, 4, 5, 6, 7],
                3: [0, 1, 2, 3, 4, 5, 6, 7],
                4: [0, 1, 2, 3, 4, 5, 6, 7],
                5: [0, 1, 2, 3], // Saturday half day
            }
        },
        {
            facultyId: 'fac_2', // Professor 2
            availability: { // Prefers not to work on Fridays
                0: [0, 1, 2, 3, 4, 5, 6, 7],
                1: [0, 1, 2, 3, 4, 5, 6, 7],
                2: [0, 1, 2, 3, 4, 5, 6, 7],
                3: [0, 1, 2, 3, 4, 5, 6, 7],
            }
        }
    ],
};

export const initialData = {
    users,
    departments,
    subjects,
    faculty,
    rooms,
    batches,
    generatedTimetables,
    globalConstraints,
    constraints,
};
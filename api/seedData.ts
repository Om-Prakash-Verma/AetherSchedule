
import type { User, Subject, Faculty, Room, Batch, Department, GeneratedTimetable, Constraints, GlobalConstraints, TimetableSettings } from '../types';

// --- HELPER ---
const createId = (name: string, prefix: string) => {
    return `${prefix}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
};

// --- USER PROVIDED DATA ---
const newSubjectsData = [
    { name: 'Digital Electronics', code: 'BOE310', type: 'Theory' as const, hours: 4, teachers: ['Dr. Somya Srivastava', 'Dr. Vipin Sharma', 'Dr. Neha Gupta', 'Mr. Varun Kumar', 'Ms. Swati'] },
    { name: 'Data Structures', code: 'BCS301', type: 'Theory' as const, hours: 4, teachers: ['Ms. Pooja Singhal', 'Ms. Ashtha Goyal', 'Mr. Gaurav Vats', 'Ms. Shruti Agarwal', 'Mr. Dhaneshwar Kumar', 'Mr. Vivek Kumar', 'Mr. Praveen Kumar Rai', 'Mr. Chandrahas Mishra'] },
    { name: 'Computer Organization & Architecture', code: 'BCS302', type: 'Theory' as const, hours: 4, teachers: ['Ms. Swati', 'Ms. Divya Maheshwari', 'Ms. Laxmi Saraswat', 'Mr. Varun Kumar', 'Mr. Vaibhav Ranjan', 'Ms. Neetu Bansla'] },
    { name: 'Digital System & Logic (DSTL)', code: 'BCS303', type: 'Theory' as const, hours: 4, teachers: ['Ms. Sonia Lamba', 'Ms. Neha Gaur', 'Ms. Abhilasha Varshney', 'Ms. Neplai Singla'] },
    { name: 'Python Programming', code: 'BCC302', type: 'Theory' as const, hours: 3, teachers: ['Ms. Disha Mohini Pathak', 'Ms. Abhilasha Varshney', 'Ms. Vandana Sharma', 'Ms. Nidhi Yadav', 'Prof. (Dr.) Pankaj Kumar Sharma'] },
    { name: 'Universal Human Values (UHV)', code: 'BVE301', type: 'Theory' as const, hours: 3, teachers: ['Dr. Sunita Goyal', 'Ms. Vineeta Pal', 'Dr. Anupriya'] },
    { name: 'Soft Skills', code: 'GEN101', type: 'Workshop' as const, hours: 2, teachers: ['Dr. Abrity Thakur', 'Ms. Megha Bajaj', 'Ms. Pooja Ruhtagi'] },
    { name: 'DS Lab', code: 'BCS351', type: 'Practical' as const, hours: 2, teachers: ['Ms. Pooja Singhal', 'Mr. Chandrahas Mishra', 'Ms. Ashtha Goyal', 'Mr. Gaurav Vats', 'Ms. Shruti Agarwal', 'Mr. Dhaneshwar Kumar', 'Mr. Sangh Priya', 'Mr. Vivek Kumar', 'Mr. Praveen Kumar Rai', 'Mr. Abhishek Yadav'] },
    { name: 'COA Lab', code: 'BCS352', type: 'Practical' as const, hours: 2, teachers: ['Ms. Swati', 'Ms. Nidhi Yadav', 'Ms. Divya Maheshwari', 'Ms. Laxmi Saraswat', 'Mr. Varun Kumar', 'Mr. Vaibhav Ranjan', 'Ms. Neetu Bansla'] },
    { name: 'Web Development Lab', code: 'BCS353', type: 'Practical' as const, hours: 2, teachers: ['Ms. Saumya Gupta', 'Ms. Neplai Singla', 'Ms. Anshika', 'Mr. Dhaneshwar Kumar', 'Mr. Satvik', 'Mr. Ravi Sikka', 'Ms. Laxmi Saraswat', 'Ms. Sonia Lamba', 'Ms. Nancy'] },
    { name: 'DSA Training', code: 'TRN001', type: 'Workshop' as const, hours: 2, teachers: ['Ms. Pooja Singhal', 'Mr. Chandrahas Mishra', 'Ms. Ashtha Goyal', 'Mr. Gaurav Vats', 'Ms. Shruti Agarwal', 'Mr. Dhaneshwar Kumar', 'Mr. Sangh Priya', 'Mr. Vivek Kumar', 'Mr. Abhishek Yadav', 'Ms. Vandana Sharma', 'Ms. Saumya Gupta'] },
    { name: 'FSD Training', code: 'TRN002', type: 'Workshop' as const, hours: 2, teachers: ['Ms. Saumya Gupta', 'Ms. Laxmi Saraswat', 'Mr. Dhaneshwar Kumar', 'Mr. Ravi Sikka', 'Mr. Yashi Rastogi', 'Ms. Anshika', 'Ms. Beena', 'Ms. Nancy', 'Mr. Satvik', 'Mr. Vicky'] }
];

// --- GENERATION LOGIC ---

// 1. Process Faculty from user data
const allTeacherNames = [...new Set(newSubjectsData.flatMap(s => s.teachers))];
const faculty: Faculty[] = allTeacherNames.map(name => ({
    id: createId(name, 'fac'),
    name,
    subjectIds: [],
    userId: createId(name, 'user_fac')
}));

// 2. Process Subjects from user data and link to Faculty
const subjects: Subject[] = newSubjectsData.map(sub => {
    const subjectId = createId(sub.code, 'sub');
    sub.teachers.forEach(teacherName => {
        const facultyMember = faculty.find(f => f.name === teacherName);
        if (facultyMember) {
            facultyMember.subjectIds.push(subjectId);
        }
    });
    return {
        id: subjectId,
        name: sub.name,
        code: sub.code,
        type: sub.type,
        credits: Math.max(1, Math.floor(sub.hours / 1.5)),
        hoursPerWeek: sub.hours
    };
});

// 3. Departments
const departments: Department[] = [
  { id: 'dept_cs', name: 'Computer Science & Engineering', code: 'CS' },
  { id: 'dept_ee', name: 'Electrical Engineering', code: 'EE' },
  { id: 'dept_me', name: 'Mechanical Engineering', code: 'ME' },
  { id: 'dept_ce', name: 'Civil Engineering', code: 'CE' },
  { id: 'dept_gen', name: 'General & Humanities', code: 'GEN' },
];

// 4. Rooms (RESTORED)
const rooms: Room[] = [
    { id: 'room_lh1', name: 'Lecture Hall 1', capacity: 120, type: 'Lecture Hall' },
    { id: 'room_lh2', name: 'Lecture Hall 2', capacity: 120, type: 'Lecture Hall' },
    { id: 'room_lh3', name: 'Lecture Hall 3', capacity: 70, type: 'Lecture Hall' },
    { id: 'room_lab_cs1', name: 'CS Lab 1 (DS)', capacity: 60, type: 'Lab' },
    { id: 'room_lab_cs2', name: 'CS Lab 2 (COA)', capacity: 60, type: 'Lab' },
    { id: 'room_lab_cs3', name: 'CS Lab 3 (Web)', capacity: 60, type: 'Lab' },
    { id: 'room_workshop1', name: 'Workshop Hall 1', capacity: 80, type: 'Workshop' },
];

// 5. Batches (RESTORED)
const batches: Batch[] = [
    {
        id: 'batch_cs_s3_a',
        name: 'CS S3 A',
        departmentId: 'dept_cs',
        semester: 3,
        studentCount: 65,
        subjectIds: subjects.map(s => s.id) // Assign all subjects for demo purposes
    },
    {
        id: 'batch_cs_s3_b',
        name: 'CS S3 B',
        departmentId: 'dept_cs',
        semester: 3,
        studentCount: 65,
        subjectIds: subjects.map(s => s.id)
    },
];


// 6. Users
const baseUsers: User[] = [
  { id: 'user_super_admin', name: 'Super Admin', email: 'super.admin@test.com', role: 'SuperAdmin' },
  { id: 'user_timetable_manager', name: 'Timetable Manager', email: 'manager@test.com', role: 'TimetableManager' },
  { id: 'user_cs_hod', name: 'CS Department Head', email: 'cs.hod@test.com', role: 'DepartmentHead' },
  { id: 'user_ee_hod', name: 'EE Department Head', email: 'ee.hod@test.com', role: 'DepartmentHead' },
  { id: 'user_me_hod', name: 'ME Department Head', email: 'me.hod@test.com', role: 'DepartmentHead' },
  { id: 'user_ce_hod', name: 'CE Department Head', email: 'ce.hod@test.com', role: 'DepartmentHead' },
];

const facultyUsers: User[] = faculty.map(f => ({
    id: f.userId!,
    name: f.name,
    email: `${f.id.replace('fac_', '')}@test.com`,
    role: 'Faculty',
    facultyId: f.id,
}));

// Student users (RESTORED)
const studentUsers: User[] = batches.map(batch => ({
    id: `user_student_${batch.id}`,
    name: `${batch.name} Student Rep`,
    email: `${batch.name.toLowerCase().replace(/\s+/g, '_')}@test.com`,
    role: 'Student',
    batchId: batch.id,
}));

const users: User[] = [...baseUsers, ...facultyUsers, ...studentUsers];

// --- FINAL EXPORT STRUCTURE ---

const generatedTimetables: GeneratedTimetable[] = [];

const constraints: Constraints = {
    pinnedAssignments: [],
    plannedLeaves: [],
    facultyAvailability: [],
};

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

const timetableSettings: TimetableSettings = {
    id: 1,
    collegeStartTime: '09:00',
    collegeEndTime: '17:00',
    periodDuration: 60,
    breaks: [
        { name: 'Lunch Break', startTime: '13:00', endTime: '14:00' }
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
    timetableSettings,
    constraints,
};

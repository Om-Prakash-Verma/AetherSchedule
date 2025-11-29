import type { User, Subject, Faculty, Room, Batch, Department, GeneratedTimetable, Constraints, GlobalConstraints, TimetableSettings, FacultyAllocation } from '../types';

// --- HELPER ---
const createId = (name: string, prefix: string) => {
    return `${prefix}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
};

// --- USER PROVIDED DATA ---
const newSubjectsData: { name: string; code: string; type: 'Theory' | 'Practical' | 'Workshop'; hours: number; teachers: string[]; }[] = [
    { name: 'Digital Electronics', code: 'BOE310', type: 'Theory', hours: 4, teachers: ['Dr. Somya Srivastava', 'Dr. Vipin Sharma', 'Dr. Neha Gupta', 'Mr. Varun Kumar', 'Ms. Swati'] },
    { name: 'Data Structures', code: 'BCS301', type: 'Theory', hours: 4, teachers: ['Ms. Pooja Singhal', 'Ms. Ashtha Goyal', 'Mr. Gaurav Vats', 'Ms. Shruti Agarwal', 'Mr. Dhaneshwar Kumar', 'Mr. Vivek Kumar', 'Mr. Praveen Kumar Rai', 'Mr. Chandrahas Mishra'] },
    { name: 'Computer Organization & Architecture', code: 'BCS302', type: 'Theory', hours: 4, teachers: ['Ms. Swati', 'Ms. Divya Maheshwari', 'Ms. Laxmi Saraswat', 'Mr. Varun Kumar', 'Mr. Vaibhav Ranjan', 'Ms. Neetu Bansla'] },
    { name: 'Digital System & Logic (DSTL)', code: 'BCS303', type: 'Theory', hours: 4, teachers: ['Ms. Sonia Lamba', 'Ms. Neha Gaur', 'Ms. Abhilasha Varshney', 'Ms. Neplai Singla'] },
    { name: 'Python Programming', code: 'BCC302', type: 'Theory', hours: 3, teachers: ['Ms. Disha Mohini Pathak', 'Ms. Abhilasha Varshney', 'Ms. Vandana Sharma', 'Ms. Nidhi Yadav', 'Prof. (Dr.) Pankaj Kumar Sharma'] },
    { name: 'Universal Human Values (UHV)', code: 'BVE301', type: 'Theory', hours: 2, teachers: ['Dr. Sunita Goyal', 'Ms. Vineeta Pal', 'Dr. Anupriya'] },
    { name: 'Soft Skills', code: 'SSK301', type: 'Theory', hours: 2, teachers: ['Dr. Abrity Thakur', 'Ms. Megha Bajaj', 'Ms. Pooja Ruhtagi'] },
    { name: 'Database Management Systems', code: 'BCS501', type: 'Theory', hours: 4, teachers: ['Mr. Praveen Kumar Rai', 'Mr. Vivek Kumar'] },
    { name: 'Operating Systems', code: 'BCS502', type: 'Theory', hours: 4, teachers: ['Ms. Divya Maheshwari', 'Mr. Vaibhav Ranjan'] },
    { name: 'DS Lab', code: 'BCS351', type: 'Practical', hours: 2, teachers: ['Ms. Pooja Singhal', 'Mr. Chandrahas Mishra', 'Ms. Ashtha Goyal', 'Mr. Gaurav Vats', 'Ms. Shruti Agarwal', 'Mr. Dhaneshwar Kumar', 'Mr. Sangh Priya', 'Mr. Vivek Kumar', 'Mr. Praveen Kumar Rai', 'Mr. Abhishek Yadav'] },
    { name: 'COA Lab (S3)', code: 'BCS352', type: 'Practical', hours: 2, teachers: ['Ms. Swati', 'Ms. Nidhi Yadav', 'Ms. Divya Maheshwari', 'Ms. Laxmi Saraswat', 'Mr. Varun Kumar', 'Mr. Vaibhav Ranjan', 'Ms. Neetu Bansla'] },
    { name: 'COA Lab (S5)', code: 'BCS552', type: 'Practical', hours: 2, teachers: ['Ms. Swati', 'Ms. Nidhi Yadav', 'Ms. Divya Maheshwari', 'Ms. Laxmi Saraswat', 'Mr. Varun Kumar', 'Mr. Vaibhav Ranjan', 'Ms. Neetu Bansla'] },
    { name: 'Web Development Lab', code: 'BCS353', type: 'Practical', hours: 2, teachers: ['Ms. Saumya Gupta', 'Ms. Neplai Singla', 'Ms. Anshika', 'Mr. Dhaneshwar Kumar', 'Mr. Satvik', 'Mr. Ravi Sikka', 'Ms. Laxmi Saraswat', 'Ms. Sonia Lamba', 'Ms. Nancy'] },
    { name: 'DSA Training', code: 'TRN501', type: 'Workshop', hours: 2, teachers: ['Ms. Pooja Singhal', 'Mr. Chandrahas Mishra', 'Ms. Ashtha Goyal', 'Mr. Gaurav Vats', 'Ms. Shruti Agarwal', 'Mr. Dhaneshwar Kumar', 'Mr. Sangh Priya', 'Mr. Vivek Kumar', 'Mr. Abhishek Yadav', 'Ms. Vandana Sharma', 'Ms. Saumya Gupta'] },
    { name: 'FSD Training', code: 'TRN502', type: 'Workshop', hours: 2, teachers: ['Ms. Saumya Gupta', 'Ms. Laxmi Saraswat', 'Mr. Dhaneshwar Kumar', 'Mr. Ravi Sikka', 'Mr. Yashi Rastogi', 'Ms. Anshika', 'Ms. Beena', 'Ms. Nancy', 'Mr. Satvik', 'Mr. Vicky'] },
];


// --- GENERATION LOGIC ---

const allTeacherNames = [...new Set(newSubjectsData.flatMap(s => s.teachers))];
const faculty: Faculty[] = allTeacherNames.map(name => ({
    id: createId(name, 'fac'),
    name,
    subjectIds: [],
    userId: createId(name, 'user')
}));

const subjects: Subject[] = newSubjectsData.map(sub => {
    const subjectId = createId(sub.code, 'sub');
    sub.teachers.forEach(teacherName => {
        const facultyMember = faculty.find(f => f.name === teacherName);
        if (facultyMember) facultyMember.subjectIds.push(subjectId);
    });
    return {
        id: subjectId, name: sub.name, code: sub.code, type: sub.type,
        credits: Math.max(1, Math.floor(sub.hours / 1.5)),
        hoursPerWeek: sub.hours
    };
});

const departments: Department[] = [
    { id: createId('Computer Science & Engineering', 'dept'), name: 'Computer Science & Engineering', code: 'CSE' }
];

const rooms: Room[] = [
    { id: createId('LH-1', 'room'), name: 'LH-1', capacity: 70, type: 'Lecture Hall' },
    { id: createId('LH-2', 'room'), name: 'LH-2', capacity: 70, type: 'Lecture Hall' },
    { id: createId('LH-3', 'room'), name: 'LH-3', capacity: 70, type: 'Lecture Hall' },
    { id: createId('LH-4', 'room'), name: 'LH-4', capacity: 70, type: 'Lecture Hall' },
    { id: createId('Lab-1', 'room'), name: 'Lab-1', capacity: 35, type: 'Lab' },
    { id: createId('Lab-2', 'room'), name: 'Lab-2', capacity: 35, type: 'Lab' },
    { id: createId('Lab-3', 'room'), name: 'Lab-3', capacity: 35, type: 'Lab' },
    { id: createId('Lab-4', 'room'), name: 'Lab-4', capacity: 35, type: 'Lab' },
    { id: createId('Lab-5', 'room'), name: 'Lab-5', capacity: 35, type: 'Lab' },
    { id: createId('Lab-6', 'room'), name: 'Lab-6', capacity: 35, type: 'Lab' },
    { id: createId('WS-1', 'room'), name: 'WS-1', capacity: 70, type: 'Workshop' },
];

const cseDeptId = departments[0].id;
const batches: Batch[] = [
    {
        id: createId('CS S3 A', 'batch'), name: 'CS S3 A', departmentId: cseDeptId, semester: 3, studentCount: 65,
        subjectIds: [
            createId('BOE310', 'sub'), createId('BCS301', 'sub'), createId('BCS302', 'sub'),
            createId('BCS303', 'sub'), createId('BCC302', 'sub'), createId('BVE301', 'sub'),
            createId('SSK301', 'sub'), createId('BCS351', 'sub'), createId('BCS352', 'sub'), createId('BCS353', 'sub')
        ],
        allocatedFacultyIds: [], allocatedRoomIds: []
    },
    {
        id: createId('CS S5 A', 'batch'), name: 'CS S5 A', departmentId: cseDeptId, semester: 5, studentCount: 65,
        subjectIds: [
            createId('BCS501', 'sub'), createId('BCS502', 'sub'),
            createId('TRN501', 'sub'), createId('TRN502', 'sub'), createId('BCS552', 'sub')
        ],
        allocatedFacultyIds: [], allocatedRoomIds: []
    }
];

const baseUsers: User[] = [
  { id: 'user_super_admin', name: 'Super Admin', email: 'super.admin@test.com', role: 'SuperAdmin' },
  { id: 'user_timetable_manager', name: 'Timetable Manager', email: 'manager@test.com', role: 'TimetableManager' },
  { id: 'user_cs_hod', name: 'CS Department Head', email: 'cs.hod@test.com', role: 'DepartmentHead' },
];

const facultyUsers: User[] = faculty.map(f => ({
    id: f.userId!, name: f.name, email: `${createId(f.name, '')}@test.com`, role: 'Faculty', facultyId: f.id,
}));

const studentUsers: User[] = batches.map(batch => ({
    id: createId(`student_${batch.name}`, 'user'), name: `${batch.name} Student Rep`, email: `${createId(batch.name, '')}@test.com`, role: 'Student', batchId: batch.id,
}));

const users: User[] = [...baseUsers, ...facultyUsers, ...studentUsers];

// --- FINAL EXPORT STRUCTURE ---

const generatedTimetables: GeneratedTimetable[] = [];

const constraints: Constraints = {
    pinnedAssignments: [],
    plannedLeaves: [],
    facultyAvailability: [],
    substitutions: [],
};

const facultyAllocations: FacultyAllocation[] = []; 

const globalConstraints: GlobalConstraints = {
    id: 1, studentGapWeight: 5, facultyGapWeight: 5, facultyWorkloadDistributionWeight: 10,
    facultyPreferenceWeight: 2, aiStudentGapWeight: 5, aiFacultyGapWeight: 5,
    aiFacultyWorkloadDistributionWeight: 10, aiFacultyPreferenceWeight: 2,
};

const timetableSettings: TimetableSettings = {
    id: 1, collegeStartTime: '09:00', collegeEndTime: '17:00', periodDuration: 60,
    breaks: [{ name: 'Lunch Break', startTime: '13:00', endTime: '14:00' }],
};

export const initialData = {
    users, departments, subjects, faculty, rooms, batches, generatedTimetables,
    globalConstraints, timetableSettings, constraints, facultyAllocations,
};
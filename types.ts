

export enum ResourceType {
  FACULTY = 'FACULTY',
  ROOM = 'ROOM',
  BATCH = 'BATCH',
  SUBJECT = 'SUBJECT',
  DEPARTMENT = 'DEPARTMENT'
}

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface Faculty {
  id: string;
  name: string;
  department: string;
  preferredSlots: string[]; // e.g. ["Mon-1", "Tue-2"]
  maxHoursPerDay: number;
  subjects: string[]; // Subject IDs taught by this faculty
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  type: 'LECTURE' | 'LAB';
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  credits: number; // Academic credits
  lecturesPerWeek: number; // Number of lectures per week (Frequency)
  requiredRoomType: 'LECTURE' | 'LAB';
}

export interface SubjectAssignment {
    subjectId: string;
    facultyIds: string[]; // Changed to array to support multiple teachers (e.g. for Labs)
}

export interface Batch {
  id: string;
  name: string;
  size: number;
  fixedRoomId?: string; // New: Optional fixed room for this batch
  // identifying subjects directly is deprecated in favor of subjectAssignments, 
  // but we keep it for now or map it.
  subjects: string[]; 
  subjectAssignments: SubjectAssignment[]; 
}

export interface ScheduleEntry {
  id: string;
  day: string; // "Mon", "Tue", etc.
  slot: number; // 1-indexed (e.g., 1 to 8)
  subjectId: string;
  facultyIds: string[]; // Changed to array
  roomId: string;
  batchId: string;
  isLocked: boolean; // If true, AI won't move it
}

export interface ScheduleConflict {
  type: 'FACULTY' | 'ROOM' | 'BATCH' | 'CAPACITY';
  description: string;
  involvedIds: string[];
}

export interface SystemMetrics {
  facultyUtilization: number;
  roomUtilization: number;
  conflicts: number;
  studentSatisfaction: number;
}

// --- Timetable Configuration Types ---

export interface Break {
    id: string;
    name: string;
    startTime: string; // "HH:mm"
    endTime: string;   // "HH:mm"
}

export interface TimetableSettings {
    collegeStartTime: string; // "09:00"
    collegeEndTime: string;   // "17:00"
    periodDuration: number;   // minutes, e.g., 60
    workingDays: string[];    // ["Mon", "Tue", "Wed", "Thu", "Fri"]
    breaks: Break[];
}

export interface AppData {
  faculty: Faculty[];
  rooms: Room[];
  subjects: Subject[];
  batches: Batch[];
  departments: Department[];
  settings: TimetableSettings;
  schedule?: ScheduleEntry[];
}

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Deprecated: These should now be derived from TimetableSettings, 
// but kept for fallback compatibility during migration.
export const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];
export const SLOT_TIMES = [
  "09:00 - 10:00",
  "10:00 - 11:00",
  "11:00 - 12:00",
  "12:00 - 01:00",
  "02:00 - 03:00",
  "03:00 - 04:00",
  "04:00 - 05:00",
  "05:00 - 06:00",
];
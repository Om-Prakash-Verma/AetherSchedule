import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  name: Page;
  icon: LucideIcon;
}

export const ROLES = ['SuperAdmin', 'TimetableManager', 'DepartmentHead', 'Faculty', 'Student'] as const;
export type Role = typeof ROLES[number];

export type Page = 
  | 'Dashboard'
  | 'My Timetable'
  | 'Scheduler'
  | 'Data Management'
  | 'Constraints'
  | 'Analytics'
  | 'Settings'
  | 'Homepage';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  batchId?: string | null; // for students
  facultyId?: string | null; // for faculty
  departmentId?: string | null; // for department heads
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  type: 'Theory' | 'Practical' | 'Workshop';
  credits: number;
  hoursPerWeek: number;
}

export interface Faculty {
  id:string;
  name: string;
  subjectIds: string[];
  preferredSlots?: Record<number, number[]>; // day -> slots[]
  userId?: string | null; // Link to a user account
}

export interface Room {
  id:string;
  name: string;
  capacity: number;
  type: 'Lecture Hall' | 'Lab' | 'Workshop';
}

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface Batch {
  id: string;
  name: string;
  departmentId: string;
  semester: number;
  studentCount: number;
  subjectIds: string[];
  allocatedFacultyIds?: string[];
  allocatedRoomIds?: string[];
}

// Represents the rule (Batch, Subject) -> Faculty/Faculties
export interface FacultyAllocation {
    id: string;
    batchId: string;
    subjectId: string;
    facultyIds: string[];
}

export interface ClassAssignment {
  id: string;
  subjectId: string;
  facultyIds: string[];
  roomId: string;
  batchId: string;
  day: number; // 0 for Monday, ...
  slot: number; // 0 for 9-10am, ...
}

// A single-batch grid, used for display purposes
export type SingleBatchTimetableGrid = Record<number, Record<number, ClassAssignment>>; // day -> slot -> assignment

// A master timetable grid that can hold schedules for multiple batches concurrently.
export type TimetableGrid = Record<string, SingleBatchTimetableGrid>; // batchId -> day -> slot -> assignment

export interface GeneratedTimetable {
  id: string;
  batchIds: string[];
  version: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Archived';
  comments: { userId: string, userName: string, text: string, timestamp: string }[];
  createdAt: Date;
  metrics: TimetableMetrics;
  timetable: TimetableGrid;
  feedback?: TimetableFeedback[];
  analytics?: AnalyticsReport;
}

export interface TimetableMetrics {
    score: number;
    hardConflicts: number;
    studentGaps: number;
    facultyGaps: number;
    facultyWorkloadDistribution: number;
    preferenceViolations: number;
}

export interface TimetableFeedback {
    id: string;
    timetableId: string;
    facultyId: string;
    rating: number; // e.g., 1-5
    comment?: string;
    createdAt: string;
}

export interface PinnedAssignment {
  id: string;
  name: string;
  subjectId: string;
  facultyId: string;
  roomId: string;
  batchId: string;
  days: number[];
  startSlots: number[];
  duration: number; // in slots
}

export interface PlannedLeave {
    id: string;
    facultyId: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    reason: string;
}

export interface FacultyAvailability {
    id?: number; // Added for db primary key
    facultyId: string;
    availability: Record<number, number[]>; // day -> slots[]
}

export interface Substitution {
    id: string;
    originalAssignmentId: string;
    originalFacultyId: string; // The specific faculty member being substituted out of the original assignment
    substituteFacultyId: string;
    substituteSubjectId: string; 
    roomId: string; // This makes the substitution record self-contained
    batchId: string;
    day: number;
    slot: number;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    createdAt: string; // To determine which substitution takes precedence
}

export interface Constraints {
    pinnedAssignments: PinnedAssignment[];
    plannedLeaves: PlannedLeave[];
    facultyAvailability: FacultyAvailability[];
    substitutions: Substitution[];
}

export interface GlobalConstraints {
    id: number;
    studentGapWeight: number;
    facultyGapWeight: number;
    facultyWorkloadDistributionWeight: number;
    facultyPreferenceWeight: number;
    // AI Tuned weights
    aiStudentGapWeight: number;
    aiFacultyGapWeight: number;

    aiFacultyWorkloadDistributionWeight: number;
    aiFacultyPreferenceWeight: number;
    constraintPresets?: ConstraintPreset[];
}

export interface ConstraintPreset {
    id: string;
    name: string;
    description: string;
    rules: {
        target: 'faculty' | 'student' | 'class';
        metric: 'consecutive_hours' | 'daily_hours' | 'weekly_hours';
        operator: 'max' | 'min';
        value: number;
    }[];
}

export interface TimetableSettings {
    id: number;
    collegeStartTime: string; // "HH:mm"
    collegeEndTime: string; // "HH:mm"
    periodDuration: number; // in minutes
    breaks: { name: string; startTime: string; endTime: string }[];
}


export interface Conflict {
    type: 'Faculty' | 'Room' | 'Batch';
    message: string;
}

export type DropChange = 
  | { type: 'move'; assignment: ClassAssignment; to: { day: number; slot: number } }
  | { type: 'swap'; assignment1: ClassAssignment; assignment2: ClassAssignment };


export interface DiagnosticIssue {
    severity: 'critical' | 'warning';
    title: string;
    description: string;
    suggestion: string;
}

export interface AnalyticsReport {
    id: string;
    timetableId: string;
    facultyWorkload: { facultyId: string; facultyName: string; totalHours: number; }[];
    roomUtilization: { roomId: string; roomName: string; totalHours: number; capacity: number; utilizationPercent: number; }[];
    studentQoL: { batchId: string; batchName: string; avgGapsPerDay: number; maxConsecutiveHours: number; }[];
    heatmapData: Record<string, number[][]>; // roomId -> day -> slot -> usage (0 or 1)
}

export interface RankedSubstitute {
    faculty: Faculty;
    suitableSubjects: Subject[];
    score: number;
    reasons: string[];
}
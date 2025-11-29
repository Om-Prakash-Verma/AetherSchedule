

import { pgTable, text, integer, boolean, jsonb, timestamp, varchar, primaryKey, real } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type {
    Role,
    AnalyticsReport,
    TimetableGrid,
    PinnedAssignment,
    PlannedLeave,
    FacultyAvailability,
    Substitution,
    ConstraintPreset,
    TimetableMetrics
} from '../types';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').$type<Role>().notNull(),
  batchId: text('batch_id').references(() => batches.id),
  facultyId: text('faculty_id').references(() => faculty.id),
  departmentId: text('department_id').references(() => departments.id),
});

export const departments = pgTable('departments', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    code: text('code').notNull(),
});

export const subjects = pgTable('subjects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  type: text('type', { enum: ['Theory', 'Practical', 'Workshop'] }).notNull(),
  credits: integer('credits').notNull(),
  hoursPerWeek: integer('hours_per_week').notNull(),
});

export const rooms = pgTable('rooms', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  capacity: integer('capacity').notNull(),
  type: text('type', { enum: ['Lecture Hall', 'Lab', 'Workshop'] }).notNull(),
});

export const faculty = pgTable('faculty', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  subjectIds: jsonb('subject_ids').$type<string[]>().default([]),
  preferredSlots: jsonb('preferred_slots').$type<Record<number, number[]>>(),
  userId: text('user_id').references(() => users.id),
});

export const batches = pgTable('batches', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    departmentId: text('department_id').notNull().references(() => departments.id),
    semester: integer('semester').notNull(),
    studentCount: integer('student_count').notNull(),
    subjectIds: jsonb('subject_ids').$type<string[]>().default([]),
    allocatedFacultyIds: jsonb('allocated_faculty_ids').$type<string[]>(),
    allocatedRoomIds: jsonb('allocated_room_ids').$type<string[]>(),
});

export const facultyAllocations = pgTable('faculty_allocations', {
    id: text('id').primaryKey(),
    batchId: text('batch_id').notNull().references(() => batches.id),
    subjectId: text('subject_id').notNull().references(() => subjects.id),
    facultyIds: jsonb('faculty_ids').$type<string[]>().notNull(),
});

export const timetables = pgTable('generated_timetables', {
    id: text('id').primaryKey(),
    batchIds: jsonb('batch_ids').$type<string[]>().notNull(),
    version: integer('version').notNull(),
    status: text('status', { enum: ['Draft', 'Submitted', 'Approved', 'Rejected', 'Archived'] }).notNull(),
    comments: jsonb('comments').$type<{ userId: string, userName: string, text: string, timestamp: string }[]>(),
    createdAt: timestamp('created_at').defaultNow(),
    metrics: jsonb('metrics').$type<TimetableMetrics>(),
    timetable: jsonb('timetable').$type<TimetableGrid>().notNull(),
    analytics: jsonb('analytics').$type<AnalyticsReport>(),
});

export const feedback = pgTable('timetable_feedback', {
    id: text('id').primaryKey(),
    timetableId: text('timetable_id').notNull().references(() => timetables.id),
    facultyId: text('faculty_id').notNull().references(() => faculty.id),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const constraints = pgTable('constraints', {
    id: integer('id').primaryKey(), // Singleton
    pinnedAssignments: jsonb('pinned_assignments').$type<PinnedAssignment[]>(),
    plannedLeaves: jsonb('planned_leaves').$type<PlannedLeave[]>(),
    facultyAvailability: jsonb('faculty_availability').$type<FacultyAvailability[]>(),
    substitutions: jsonb('substitutions').$type<Substitution[]>(),
});

export const globalConstraints = pgTable('global_constraints', {
    id: integer('id').primaryKey(), // Singleton
    studentGapWeight: real('student_gap_weight').notNull(),
    facultyGapWeight: real('faculty_gap_weight').notNull(),
    facultyWorkloadDistributionWeight: real('faculty_workload_distribution_weight').notNull(),
    facultyPreferenceWeight: real('faculty_preference_weight').notNull(),
    aiStudentGapWeight: real('ai_student_gap_weight').notNull(),
    aiFacultyGapWeight: real('ai_faculty_gap_weight').notNull(),
    aiFacultyWorkloadDistributionWeight: real('ai_faculty_workload_distribution_weight').notNull(),
    aiFacultyPreferenceWeight: real('ai_faculty_preference_weight').notNull(),
    constraintPresets: jsonb('constraint_presets').$type<ConstraintPreset[]>(),
});

export const timetableSettings = pgTable('timetable_settings', {
    id: integer('id').primaryKey(), // Singleton
    collegeStartTime: text('college_start_time').notNull(),
    collegeEndTime: text('college_end_time').notNull(),
    periodDuration: integer('period_duration').notNull(),
    breaks: jsonb('breaks').$type<{ name: string; startTime: string; endTime: string }[]>(),
});


// --- RELATIONS ---

export const usersRelations = relations(users, ({ one }) => ({
    batch: one(batches, {
        fields: [users.batchId],
        references: [batches.id]
    }),
    faculty: one(faculty, {
        fields: [users.facultyId],
        references: [faculty.id]
    }),
    department: one(departments, {
        fields: [users.departmentId],
        references: [departments.id]
    }),
}));

export const facultyRelations = relations(faculty, ({ one, many }) => ({
    user: one(users, {
        fields: [faculty.userId],
        references: [users.id]
    }),
    feedback: many(feedback)
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
    batches: many(batches),
    users: many(users),
}));

export const batchesRelations = relations(batches, ({ one, many }) => ({
    department: one(departments, {
        fields: [batches.departmentId],
        references: [departments.id]
    }),
    users: many(users),
    facultyAllocations: many(facultyAllocations)
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
    facultyAllocations: many(facultyAllocations)
}));

export const facultyAllocationsRelations = relations(facultyAllocations, ({ one }) => ({
    batch: one(batches, {
        fields: [facultyAllocations.batchId],
        references: [batches.id]
    }),
    subject: one(subjects, {
        fields: [facultyAllocations.subjectId],
        references: [subjects.id]
    })
}));

export const timetablesRelations = relations(timetables, ({ many }) => ({
    feedback: many(feedback)
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
    timetable: one(timetables, {
        fields: [feedback.timetableId],
        references: [timetables.id]
    }),
    faculty: one(faculty, {
        fields: [feedback.facultyId],
        references: [faculty.id]
    })
}));
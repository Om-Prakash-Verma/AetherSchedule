import { pgTable, text, integer, jsonb, varchar, serial, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { Faculty, GeneratedTimetable } from '../types';

export const rolesEnum = pgEnum('roles', ['SuperAdmin', 'TimetableManager', 'DepartmentHead', 'Faculty', 'Student']);
export const subjectTypeEnum = pgEnum('subject_type', ['Theory', 'Practical', 'Workshop']);
export const roomTypeEnum = pgEnum('room_type', ['Lecture Hall', 'Lab', 'Workshop']);
export const timetableStatusEnum = pgEnum('timetable_status', ['Draft', 'Submitted', 'Approved', 'Rejected', 'Archived']);

export const users = pgTable('users', {
    id: varchar('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    role: rolesEnum('role').notNull(),
    batchId: text('batch_id'),
    facultyId: text('faculty_id').references(() => faculty.id, { onDelete: 'set null' }),
});

export const subjects = pgTable('subjects', {
    id: varchar('id').primaryKey(),
    name: text('name').notNull(),
    code: text('code').notNull().unique(),
    type: subjectTypeEnum('type').notNull(),
    credits: integer('credits').notNull(),
    hoursPerWeek: integer('hours_per_week').notNull(),
});

export const faculty = pgTable('faculty', {
    id: varchar('id').primaryKey(),
    name: text('name').notNull(),
    subjectIds: jsonb('subject_ids').$type<string[]>().notNull(),
    preferredSlots: jsonb('preferred_slots').$type<Faculty['preferredSlots']>(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
});

export const rooms = pgTable('rooms', {
    id: varchar('id').primaryKey(),
    name: text('name').notNull().unique(),
    capacity: integer('capacity').notNull(),
    type: roomTypeEnum('type').notNull(),
});

export const departments = pgTable('departments', {
    id: varchar('id').primaryKey(),
    name: text('name').notNull().unique(),
    code: text('code').notNull().unique(),
});

export const batches = pgTable('batches', {
    id: varchar('id').primaryKey(),
    name: text('name').notNull(),
    departmentId: varchar('department_id').notNull().references(() => departments.id, { onDelete: 'cascade' }),
    semester: integer('semester').notNull(),
    studentCount: integer('student_count').notNull(),
    subjectIds: jsonb('subject_ids').$type<string[]>().notNull(),
    allocatedFacultyIds: jsonb('allocated_faculty_ids').$type<string[]>(),
    allocatedRoomIds: jsonb('allocated_room_ids').$type<string[]>(),
});

export const timetables = pgTable('timetables', {
    id: varchar('id').primaryKey(),
    batchIds: jsonb('batch_ids').$type<string[]>().notNull(),
    version: integer('version').notNull(),
    status: timetableStatusEnum('status').notNull(),
    comments: jsonb('comments').$type<GeneratedTimetable['comments']>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    metrics: jsonb('metrics').$type<GeneratedTimetable['metrics']>().notNull(),
    timetable: jsonb('timetable').$type<GeneratedTimetable['timetable']>().notNull(),
});

export const timetableFeedback = pgTable('timetable_feedback', {
    id: varchar('id').primaryKey(),
    timetableId: varchar('timetable_id').notNull().references(() => timetables.id, { onDelete: 'cascade' }),
    facultyId: varchar('faculty_id').notNull().references(() => faculty.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(), // 1-5
    comment: text('comment'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const globalConstraints = pgTable('global_constraints', {
    id: serial('id').primaryKey(),
    // Base (human-set) weights
    studentGapWeight: integer('student_gap_weight').notNull(),
    facultyGapWeight: integer('faculty_gap_weight').notNull(),
    facultyWorkloadDistributionWeight: integer('faculty_workload_distribution_weight').notNull(),
    facultyPreferenceWeight: integer('faculty_preference_weight').notNull(),
    // AI-tuned weights
    aiStudentGapWeight: integer('ai_student_gap_weight').notNull(),
    aiFacultyGapWeight: integer('ai_faculty_gap_weight').notNull(),
    aiFacultyWorkloadDistributionWeight: integer('ai_faculty_workload_distribution_weight').notNull(),
    aiFacultyPreferenceWeight: integer('ai_faculty_preference_weight').notNull(),
});

export const pinnedAssignments = pgTable('pinned_assignments', {
    id: varchar('id').primaryKey(),
    name: text('name').notNull(),
    subjectId: varchar('subject_id').notNull(),
    facultyId: varchar('faculty_id').notNull(),
    roomId: varchar('room_id').notNull(),
    batchId: varchar('batch_id').notNull(),
    day: integer('day').notNull(),
    startSlot: integer('start_slot').notNull(),
    duration: integer('duration').notNull(),
});

export const plannedLeaves = pgTable('planned_leaves', {
    id: varchar('id').primaryKey(),
    facultyId: varchar('faculty_id').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    reason: text('reason').notNull(),
});

export const facultyAvailability = pgTable('faculty_availability', {
    id: serial('id').primaryKey(),
    facultyId: varchar('faculty_id').notNull().unique(),
    availability: jsonb('availability').$type<Record<number, number[]>>().notNull(),
});

// --- RELATIONS ---

export const usersRelations = relations(users, ({ one }) => ({
	batch: one(batches, {
		fields: [users.batchId],
		references: [batches.id],
	}),
    facultyProfile: one(faculty, {
        fields: [users.facultyId],
        references: [faculty.id],
    })
}));

export const facultyRelations = relations(faculty, ({ one }) => ({
	user: one(users, {
		fields: [faculty.userId],
		references: [users.id],
	}),
}));

export const batchesRelations = relations(batches, ({ one }) => ({
    department: one(departments, {
        fields: [batches.departmentId],
        references: [departments.id],
    }),
}));

export const timetablesRelations = relations(timetables, ({ many }) => ({
	feedback: many(timetableFeedback),
}));

export const timetableFeedbackRelations = relations(timetableFeedback, ({ one }) => ({
    timetable: one(timetables, {
        fields: [timetableFeedback.timetableId],
        references: [timetables.id],
    }),
    faculty: one(faculty, {
        fields: [timetableFeedback.facultyId],
        references: [faculty.id],
    }),
}));
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../db/schema';
import { initialData } from './seedData';
import { runOptimization, tuneConstraintWeightsWithGemini } from '../core/schedulerEngine';
import { findSubstitutes } from '../core/substituteFinder';
import { DAYS_OF_WEEK } from '../constants';
import { eq, and, inArray, InferSelectModel, sql } from 'drizzle-orm';
import type { GeneratedTimetable, Batch, User, FacultyAvailability, Subject, TimetableFeedback, GlobalConstraints, Faculty, PinnedAssignment, PlannedLeave, Room, Department, TimetableSettings, Substitution, FacultyAllocation } from '../types';

// Inferred types from DB schema
type TimetableFeedbackFromDB = InferSelectModel<typeof schema.timetableFeedback>;

// --- DATABASE CONNECTION ---
let db: NeonHttpDatabase<typeof schema>;
let dbInitializationError: Error | null = null;

try {
    if (!process.env.POSTGRES_URL) {
        throw new Error('FATAL: POSTGRES_URL environment variable is not set.');
    }
    const sql = neon(process.env.POSTGRES_URL);
    db = drizzle(sql, { schema });
} catch (e) {
    dbInitializationError = e as Error;
    console.error("Database initialization failed:", dbInitializationError.message);
}


export const app = new Hono().basePath('/api');

let isSeeded = false;

app.use('*', async (c, next) => {
    if (dbInitializationError) {
        return c.json({ message: 'Database configuration error.', error: dbInitializationError.message }, 500);
    }

    if (!isSeeded) {
        try {
            console.log('Checking if DB needs seeding...');
            const userCountResult = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
            
            if (userCountResult.length === 0) {
                console.log('Database is unseeded. Running sequential seeding...');
                
                // FIX: Removed the `db.transaction` wrapper, which is unsupported by the neon-http driver
                // in this middleware context. Operations now run sequentially, preventing a critical startup error.
                if (initialData.departments.length > 0) await db.insert(schema.departments).values(initialData.departments).onConflictDoNothing();
                if (initialData.subjects.length > 0) await db.insert(schema.subjects).values(initialData.subjects).onConflictDoNothing();
                if (initialData.rooms.length > 0) await db.insert(schema.rooms).values(initialData.rooms).onConflictDoNothing();
                if (initialData.batches.length > 0) await db.insert(schema.batches).values(initialData.batches).onConflictDoNothing();

                const facultyForInsert = initialData.faculty.map(f => ({
                    id: f.id, name: f.name, subjectIds: f.subjectIds, preferredSlots: f.preferredSlots,
                }));
                if (facultyForInsert.length > 0) await db.insert(schema.faculty).values(facultyForInsert).onConflictDoNothing();
                if (initialData.users.length > 0) await db.insert(schema.users).values(initialData.users).onConflictDoNothing();

                const updateFacultyPromises = initialData.faculty
                    .filter(f => f.userId)
                    .map(f => db.update(schema.faculty).set({ userId: f.userId }).where(eq(schema.faculty.id, f.id)));
                if (updateFacultyPromises.length > 0) await Promise.all(updateFacultyPromises);
                
                await db.insert(schema.globalConstraints).values(initialData.globalConstraints).onConflictDoUpdate({ target: schema.globalConstraints.id, set: initialData.globalConstraints });
                await db.insert(schema.timetableSettings).values(initialData.timetableSettings).onConflictDoUpdate({ target: schema.timetableSettings.id, set: initialData.timetableSettings });
                
                if (initialData.constraints.pinnedAssignments.length > 0) await db.insert(schema.pinnedAssignments).values(initialData.constraints.pinnedAssignments).onConflictDoNothing();
                if (initialData.constraints.plannedLeaves.length > 0) await db.insert(schema.plannedLeaves).values(initialData.constraints.plannedLeaves).onConflictDoNothing();
                for (const fa of initialData.constraints.facultyAvailability) {
                    await db.insert(schema.facultyAvailability).values(fa).onConflictDoUpdate({ target: schema.facultyAvailability.facultyId, set: { availability: fa.availability } });
                }
                if (initialData.constraints.substitutions?.length > 0) await db.insert(schema.substitutions).values(initialData.constraints.substitutions).onConflictDoNothing();
                if (initialData.facultyAllocations?.length > 0) await db.insert(schema.facultyAllocations).values(initialData.facultyAllocations).onConflictDoNothing();

                console.log('Database seeding complete.');
            } else {
                console.log('Database already seeded.');
            }
            isSeeded = true;
        } catch (error: any) {
            console.error('CRITICAL: Database connection or seeding failed:', error);
            if (error.cause?.code === '42P01') {
                const tableName = (error.cause.message || '').match(/relation "([^"]+)"/)?.[1] || 'a required table';
                const detailedMessage = `Database schema is missing. The table '${tableName}' was not found. If running locally, push your schema: npx drizzle-kit push`;
                return c.json({ message: detailedMessage, error: 'Database not initialized.' }, 503);
            }
            return c.json({ message: 'Could not connect to the database.', error: (error as Error).message }, 503);
        }
    }
    await next();
});

app.post('/login', zValidator('json', z.object({ email: z.string().email() })), async (c) => {
  const { email } = c.req.valid('json');
  const userResult = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (userResult.length > 0) return c.json(userResult[0]);
  return c.json({ message: 'User not found' }, 404);
});

// --- GRANULAR DATA FETCHING ENDPOINTS ---
app.get('/subjects', async c => c.json(await db.select().from(schema.subjects)));
app.get('/faculty', async c => c.json(await db.select().from(schema.faculty)));
app.get('/rooms', async c => c.json(await db.select().from(schema.rooms)));
app.get('/departments', async c => c.json(await db.select().from(schema.departments)));
app.get('/batches', async c => c.json(await db.select().from(schema.batches)));
app.get('/users', async c => c.json(await db.select().from(schema.users)));
app.get('/faculty-allocations', async c => c.json(await db.select().from(schema.facultyAllocations)));

app.get('/timetables', async (c) => {
    const timetablesWithFeedback = await db.query.timetables.findMany({ with: { feedback: true } });
    return c.json(timetablesWithFeedback.map(tt => ({
        ...tt,
        createdAt: tt.createdAt.toISOString(),
        feedback: (tt.feedback || []).map((fb: TimetableFeedbackFromDB) => ({ ...fb, createdAt: fb.createdAt.toISOString() }))
    })));
});

app.get('/constraints', async (c) => {
    const [pinned, leaves, availability, subs] = await Promise.all([
        db.select().from(schema.pinnedAssignments), db.select().from(schema.plannedLeaves),
        db.select().from(schema.facultyAvailability), db.select().from(schema.substitutions),
    ]);
    return c.json({ pinnedAssignments: pinned, plannedLeaves: leaves, facultyAvailability: availability, substitutions: subs });
});

app.get('/settings', async (c) => {
    const [gc, ts] = await Promise.all([
        db.select().from(schema.globalConstraints).limit(1), db.select().from(schema.timetableSettings).limit(1),
    ]);
    return c.json({
        globalConstraints: gc[0] || initialData.globalConstraints,
        timetableSettings: ts[0] || initialData.timetableSettings,
    });
});

app.post('/scheduler', zValidator('json', z.object({ batchIds: z.array(z.string()).min(1) })), async (c) => {
    try {
        const { batchIds } = c.req.valid('json');
        
        const [batches, allSubjects, allFaculty, allRooms, gc, pinned, leaves, availability, approvedFromDb, settings, subs, allocations] = await Promise.all([
            db.select().from(schema.batches).where(inArray(schema.batches.id, batchIds)),
            db.select().from(schema.subjects), db.select().from(schema.faculty), db.select().from(schema.rooms),
            db.select().from(schema.globalConstraints).limit(1), db.select().from(schema.pinnedAssignments),
            db.select().from(schema.plannedLeaves), db.select().from(schema.facultyAvailability),
            db.query.timetables.findMany({ where: eq(schema.timetables.status, 'Approved'), with: { feedback: true } }),
            db.select().from(schema.timetableSettings).limit(1), db.select().from(schema.substitutions),
            db.select().from(schema.facultyAllocations),
        ]);

        const approved = approvedFromDb.map(tt => ({ ...tt, createdAt: tt.createdAt.toISOString(), feedback: (tt.feedback || []).map((fb: TimetableFeedbackFromDB) => ({ ...fb, createdAt: fb.createdAt.toISOString() })) }));
        const baseGc = gc[0] || initialData.globalConstraints;
        const allFeedback = approved.flatMap(tt => tt.feedback || []);
        const tunedConstraints = await tuneConstraintWeightsWithGemini(baseGc, allFeedback, allFaculty as Faculty[]);
        await db.update(schema.globalConstraints).set({ ...tunedConstraints }).where(eq(schema.globalConstraints.id, baseGc.id));

        const candidates = await runOptimization({
          batches, allSubjects, allFaculty: allFaculty as Faculty[], allRooms, approvedTimetables: approved,
          constraints: { pinnedAssignments: pinned, plannedLeaves: leaves, facultyAvailability: availability, substitutions: subs },
          globalConstraints: tunedConstraints, days: DAYS_OF_WEEK, 
          timetableSettings: (settings || [])[0] || initialData.timetableSettings, candidateCount: 5, facultyAllocations: allocations,
        });
      
        return c.json(candidates.map((cand) => ({
          id: `tt_cand_${batchIds.join('_')}_${Date.now()}_${Math.random()}`, batchIds, version: 1, status: 'Draft',
          comments: [], createdAt: new Date().toISOString(), metrics: cand.metrics, timetable: cand.timetable,
        })));
    } catch (error) {
        console.error(`[API /scheduler] Error:`, error);
        return c.json({ message: 'Timetable generation failed.', error: (error as Error).message }, 500);
    }
});

app.post('/substitutes/find', zValidator('json', z.object({ assignmentId: z.string() })), async (c) => {
    try {
        const { assignmentId } = c.req.valid('json');
        const [allBatches, allSubjects, allFaculty, allLeaves, allAvailabilities, approvedTimetablesFromDb, allSubstitutions, allFacultyAllocations] = await Promise.all([
             db.select().from(schema.batches), db.select().from(schema.subjects),
             db.select().from(schema.faculty), db.select().from(schema.plannedLeaves),
             db.select().from(schema.facultyAvailability),
             db.query.timetables.findMany({ where: eq(schema.timetables.status, 'Approved') }),
             db.select().from(schema.substitutions),
             db.select().from(schema.facultyAllocations),
        ]);

        // FIX: Map the `createdAt` Date objects to ISO strings to match the expected type.
        const approvedTimetables = approvedTimetablesFromDb.map(tt => ({
            ...tt,
            createdAt: tt.createdAt.toISOString(),
            feedback: (tt.feedback || []).map((fb: TimetableFeedbackFromDB) => ({ ...fb, createdAt: fb.createdAt.toISOString() }))
        }));

        const results = await findSubstitutes({
            assignmentId, allBatches, allSubjects, allFaculty, allLeaves,
            allAvailabilities, approvedTimetables, allSubstitutions, allFacultyAllocations,
        });
        return c.json(results);
    } catch (error) {
        console.error('[API /substitutes/find] Error:', error);
        return c.json({ message: 'Failed to find substitutes.', error: (error as Error).message }, 500);
    }
});
app.post('/substitutes', zValidator('json', z.any()), async (c) => {
    const subData = c.req.valid('json');
    const result = await db.insert(schema.substitutions).values(subData).onConflictDoUpdate({ target: schema.substitutions.id, set: subData }).returning();
    return c.json(result[0]);
});

// --- TIMETABLE MANAGEMENT (IMPLEMENTED) ---
app.post('/timetables', zValidator('json', z.any()), async (c) => {
    const timetableData = c.req.valid('json') as GeneratedTimetable;
    
    // FIX: A `createdAt` string from the client was causing Drizzle to error on update.
    // This creates a safe object with a proper Date object for the database.
    const safeDataForDb = {
        ...timetableData,
        createdAt: new Date(timetableData.createdAt),
    };

    if (timetableData.status === 'Approved') {
        const approvedTimetables = await db.query.timetables.findMany({ where: eq(schema.timetables.status, 'Approved') });
        const toArchive = approvedTimetables.filter(tt => tt.batchIds.some(bId => timetableData.batchIds.includes(bId)));
        if (toArchive.length > 0) {
            await db.update(schema.timetables).set({ status: 'Archived' }).where(inArray(schema.timetables.id, toArchive.map(tt => tt.id)));
        }
    }

    // Use the safe object for both insert and update to prevent type errors.
    await db.insert(schema.timetables).values(safeDataForDb).onConflictDoUpdate({
        target: schema.timetables.id,
        set: safeDataForDb
    });

    return c.json(timetableData);
});

app.post('/timetables/feedback', zValidator('json', z.any()), async (c) => {
    const feedbackData = c.req.valid('json');
    const newFeedback = { id: `fb_${Date.now()}`, ...feedbackData };
    const result = await db.insert(schema.timetableFeedback).values(newFeedback).returning();
    return c.json(result[0]);
});

// --- GENERIC CRUD (IMPLEMENTED) ---
const tables = { subjects: schema.subjects, faculty: schema.faculty, rooms: schema.rooms, departments: schema.departments, users: schema.users };
for (const [path, table] of Object.entries(tables)) {
    app.post(`/${path}`, zValidator('json', z.any()), async (c) => {
        const data = c.req.valid('json');
        // @ts-ignore
        const result = await db.insert(table).values(data).onConflictDoUpdate({ target: table.id, set: data }).returning();
        return c.json(result[0]);
    });
    app.delete(`/${path}/:id`, async (c) => {
        const { id } = c.req.param();
        // @ts-ignore
        await db.delete(table).where(eq(table.id, id));
        return c.json({ success: true });
    });
}

// --- BATCH CRUD (UPGRADED FOR MULTI-TEACHER LABS) ---
app.post('/batches', async (c) => {
    const { allocations, ...batchData } = await c.req.json();

    // Operations run sequentially as db.transaction is unsupported.

    // Step 1: Insert or update the batch itself.
    await db.insert(schema.batches).values(batchData).onConflictDoUpdate({ target: schema.batches.id, set: batchData });
    
    // Step 2: Delete all existing allocations for this batch.
    await db.delete(schema.facultyAllocations).where(eq(schema.facultyAllocations.batchId, batchData.id));

    // Step 3: Insert the new allocations if any exist.
    if (allocations && Object.keys(allocations).length > 0) {
        const newAllocations = Object.entries(allocations)
            .filter(([_, facultyIds]) => (facultyIds as string[]).length > 0) // Filter out empty arrays
            .map(([subjectId, facultyIds]) => ({
                id: `alloc_${batchData.id}_${subjectId}`,
                batchId: batchData.id,
                subjectId,
                facultyIds: facultyIds as string[], // Now an array
            }));
            
        if (newAllocations.length > 0) {
          await db.insert(schema.facultyAllocations).values(newAllocations).onConflictDoUpdate({ target: schema.facultyAllocations.id, set: { facultyIds: sql`excluded.faculty_ids` }});
        }
    }

    // After saving the batch, ensure a student user account exists for it.
    const existingUser = await db.query.users.findFirst({
        where: and(
            eq(schema.users.role, 'Student'),
            eq(schema.users.batchId, batchData.id)
        )
    });

    if (!existingUser) {
        const createId = (name: string, prefix: string) => {
            return `${prefix}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
        };
        const studentUser: User = {
            id: createId(`student_${batchData.name}`, 'user'),
            name: `${batchData.name} Student Rep`,
            email: `${createId(batchData.name, '')}@test.com`,
            role: 'Student',
            batchId: batchData.id,
        };
        // Use onConflictDoNothing to safely handle any race conditions or non-unique generated IDs.
        await db.insert(schema.users).values(studentUser).onConflictDoNothing();
    }

    return c.json(batchData);
});
app.delete('/batches/:id', async (c) => {
    const { id } = c.req.param();
    await db.delete(schema.batches).where(eq(schema.batches.id, id));
    return c.json({ success: true });
});


// --- CONSTRAINTS & SETTINGS (IMPLEMENTED) ---
app.post('/constraints/pinned', zValidator('json', z.any()), async c => c.json((await db.insert(schema.pinnedAssignments).values(c.req.valid('json')).onConflictDoUpdate({ target: schema.pinnedAssignments.id, set: c.req.valid('json') }).returning())[0]));
app.delete('/constraints/pinned/:id', async c => { await db.delete(schema.pinnedAssignments).where(eq(schema.pinnedAssignments.id, c.req.param('id'))); return c.json({ success: true }); });
app.post('/constraints/leaves', zValidator('json', z.any()), async c => c.json((await db.insert(schema.plannedLeaves).values(c.req.valid('json')).onConflictDoUpdate({ target: schema.plannedLeaves.id, set: c.req.valid('json') }).returning())[0]));
app.delete('/constraints/leaves/:id', async c => { await db.delete(schema.plannedLeaves).where(eq(schema.plannedLeaves.id, c.req.param('id'))); return c.json({ success: true }); });

app.post('/constraints/availability', zValidator('json', z.any()), async (c) => {
    const data = c.req.valid('json') as FacultyAvailability;
    const result = await db.insert(schema.facultyAvailability).values(data).onConflictDoUpdate({ target: schema.facultyAvailability.facultyId, set: { availability: data.availability } }).returning();
    return c.json(result[0]);
});

app.post('/settings/global', zValidator('json', z.any()), async (c) => c.json((await db.update(schema.globalConstraints).set(c.req.valid('json')).where(eq(schema.globalConstraints.id, 1)).returning())[0]));
app.post('/settings/timetable', zValidator('json', z.any()), async (c) => c.json((await db.update(schema.timetableSettings).set(c.req.valid('json')).where(eq(schema.timetableSettings.id, 1)).returning())[0]));

// --- DATA PORTABILITY (UPGRADED) ---
app.get('/data/export', async (c) => {
    const [subjects, faculty, rooms, batches, departments, facultyAllocations, users] = await Promise.all([
        db.select().from(schema.subjects),
        db.select().from(schema.faculty),
        db.select().from(schema.rooms),
        db.select().from(schema.batches),
        db.select().from(schema.departments),
        db.select().from(schema.facultyAllocations),
        db.select().from(schema.users), // Now includes users
    ]);
    const exportData = { subjects, faculty, rooms, batches, departments, facultyAllocations, users };
    
    c.header('Content-Disposition', `attachment; filename="aetherschedule_data_export_${new Date().toISOString().split('T')[0]}.json"`);
    return c.json(exportData);
});

app.post('/data/import', async (c) => {
    try {
        const data = await c.req.json();
        const requiredKeys = ['subjects', 'faculty', 'rooms', 'batches', 'departments', 'facultyAllocations', 'users'];
        if (requiredKeys.some(key => !data[key])) {
            return c.json({ message: 'Invalid import file structure. Required sections are missing.' }, 400);
        }

        // Using .onConflictDoUpdate() for a safer, non-destructive import.

        // Stage 1: Upsert data without strong dependencies
        if (data.departments?.length) await db.insert(schema.departments).values(data.departments).onConflictDoUpdate({ target: schema.departments.id, set: { name: sql`excluded.name`, code: sql`excluded.code` } });
        if (data.subjects?.length) await db.insert(schema.subjects).values(data.subjects).onConflictDoUpdate({ target: schema.subjects.id, set: { name: sql`excluded.name`, code: sql`excluded.code`, type: sql`excluded.type`, credits: sql`excluded.credits`, hoursPerWeek: sql`excluded.hours_per_week` } });
        if (data.rooms?.length) await db.insert(schema.rooms).values(data.rooms).onConflictDoUpdate({ target: schema.rooms.id, set: { name: sql`excluded.name`, capacity: sql`excluded.capacity`, type: sql`excluded.type` } });
        if (data.batches?.length) await db.insert(schema.batches).values(data.batches).onConflictDoUpdate({ target: schema.batches.id, set: { name: sql`excluded.name`, departmentId: sql`excluded.department_id`, semester: sql`excluded.semester`, studentCount: sql`excluded.student_count`, subjectIds: sql`excluded.subject_ids` } });

        // Stage 2: Handle circular dependency between users and faculty
        // First, upsert users. This will work because their `facultyId` and `batchId` can point to existing records or be null.
        if (data.users?.length) await db.insert(schema.users).values(data.users).onConflictDoUpdate({ target: schema.users.id, set: { name: sql`excluded.name`, email: sql`excluded.email`, role: sql`excluded.role`, batchId: sql`excluded.batch_id`, facultyId: sql`excluded.faculty_id` } });

        // Then, upsert faculty. This will work because their `userId` can now point to an existing user.
        if (data.faculty?.length) await db.insert(schema.faculty).values(data.faculty).onConflictDoUpdate({ target: schema.faculty.id, set: { name: sql`excluded.name`, subjectIds: sql`excluded.subject_ids`, preferredSlots: sql`excluded.preferred_slots`, userId: sql`excluded.user_id` } });

        // Stage 3: Replace allocations
        await db.delete(schema.facultyAllocations);
        if (data.facultyAllocations?.length) await db.insert(schema.facultyAllocations).values(data.facultyAllocations);
        
        return c.json({ success: true, message: 'Data imported successfully.' });
    } catch (error: any) {
        console.error('[API /data/import] Error:', error);
        return c.json({ message: 'Failed to import data.', error: (error as Error).message }, 500);
    }
});

// --- RESET DB (IMPLEMENTED) ---
app.post('/reset-db', async (c) => {
    console.log("Clearing all data from database sequentially...");
    // Delete in order to respect foreign key constraints
    await db.delete(schema.timetableFeedback);
    await db.delete(schema.substitutions);
    await db.delete(schema.facultyAllocations);
    await db.delete(schema.pinnedAssignments);
    await db.delete(schema.facultyAvailability);
    await db.delete(schema.plannedLeaves);
    await db.delete(schema.timetables);
    
    // FIX: Break the circular dependency between users and faculty before deleting.
    // This prevents a foreign key violation crash.
    await db.update(schema.faculty).set({ userId: null });
    
    await db.delete(schema.users);
    await db.delete(schema.faculty);
    await db.delete(schema.batches);
    await db.delete(schema.departments);
    await db.delete(schema.subjects);
    await db.delete(schema.rooms);
    await db.delete(schema.globalConstraints);
    await db.delete(schema.timetableSettings);

    isSeeded = false; // Force re-seeding on the next request
    return c.json({ success: true });
});
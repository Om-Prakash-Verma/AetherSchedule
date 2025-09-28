import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../db/schema';
import { initialData } from './seedData';
import { runOptimization, tuneConstraintWeightsWithGemini } from '../core/schedulerEngine';
import { DAYS_OF_WEEK } from '../constants';
import { eq, and, inArray, InferSelectModel } from 'drizzle-orm';
import type { GeneratedTimetable, Batch, User, FacultyAvailability, Subject, TimetableFeedback, GlobalConstraints, Faculty, PinnedAssignment, PlannedLeave, Room, Department, TimetableSettings } from '../types';

// Inferred types from DB schema
type TimetableFeedbackFromDB = InferSelectModel<typeof schema.timetableFeedback>;

// --- DATABASE CONNECTION ---
let db: NeonHttpDatabase<typeof schema>;
let dbInitializationError: Error | null = null;

try {
    // Critical check for environment variable
    if (!process.env.POSTGRES_URL) {
        throw new Error('FATAL: POSTGRES_URL environment variable is not set in the Vercel deployment environment.');
    }
    const sql = neon(process.env.POSTGRES_URL);
    // FIX: Corrected Drizzle initialization by removing the invalid 'relations' property.
    // The schema itself contains all necessary relation definitions.
    db = drizzle(sql, { schema });
} catch (e) {
    dbInitializationError = e as Error;
    console.error("Database initialization failed:", dbInitializationError.message);
}


// FIX: Export the 'app' constant so it can be imported by other modules.
export const app = new Hono().basePath('/api');

let isSeeded = false;

// Middleware to check for initialization errors and handle seeding
app.use('*', async (c, next) => {
    // Fail fast if the DB client failed to initialize at all.
    if (dbInitializationError) {
        return c.json({ message: 'Database configuration error.', error: dbInitializationError.message }, 500);
    }

    if (!isSeeded) {
        try {
            console.log('Checking if DB needs seeding...');
            // This is the first actual query. If this fails, the credentials or connection are bad.
            const userCountResult = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
            
            // We check users, but even if this is misleading (e.g. users table is empty but others aren't),
            // the idempotent inserts below will prevent crashes.
            if (userCountResult.length === 0) {
                console.log('Database may be unseeded or partially seeded. Attempting idempotent seeding...');

                // Make all inserts idempotent to gracefully handle partially seeded databases.
                // .onConflictDoNothing() skips insertion if the primary key already exists.
                
                // 1. Independent tables
                if (initialData.departments.length > 0) await db.insert(schema.departments).values(initialData.departments).onConflictDoNothing();
                if (initialData.subjects.length > 0) await db.insert(schema.subjects).values(initialData.subjects).onConflictDoNothing();
                if (initialData.rooms.length > 0) await db.insert(schema.rooms).values(initialData.rooms).onConflictDoNothing();
                
                // 2. Batches (depends on departments)
                if (initialData.batches.length > 0) await db.insert(schema.batches).values(initialData.batches).onConflictDoNothing();

                // 3. Break the user/faculty circular dependency
                const facultyForInsert = initialData.faculty.map(f => ({
                    id: f.id,
                    name: f.name,
                    subjectIds: f.subjectIds,
                    preferredSlots: f.preferredSlots,
                }));
                if (facultyForInsert.length > 0) await db.insert(schema.faculty).values(facultyForInsert).onConflictDoNothing();

                // 4. Insert users.
                if (initialData.users.length > 0) await db.insert(schema.users).values(initialData.users).onConflictDoNothing();

                // 5. Update faculty records with user IDs. This is safe to re-run.
                const updateFacultyPromises = initialData.faculty
                    .filter(f => f.userId)
                    .map(f => 
                        db.update(schema.faculty)
                            .set({ userId: f.userId })
                            .where(eq(schema.faculty.id, f.id))
                    );
                if (updateFacultyPromises.length > 0) await Promise.all(updateFacultyPromises);
                
                // 6. Seed constraints and settings tables
                // Use onConflictDoUpdate for settings to ensure they match the seed file.
                await db.insert(schema.globalConstraints).values(initialData.globalConstraints).onConflictDoUpdate({
                    target: schema.globalConstraints.id,
                    set: {
                        studentGapWeight: initialData.globalConstraints.studentGapWeight,
                        facultyGapWeight: initialData.globalConstraints.facultyGapWeight,
                        facultyWorkloadDistributionWeight: initialData.globalConstraints.facultyWorkloadDistributionWeight,
                        facultyPreferenceWeight: initialData.globalConstraints.facultyPreferenceWeight,
                        aiStudentGapWeight: initialData.globalConstraints.aiStudentGapWeight,
                        aiFacultyGapWeight: initialData.globalConstraints.aiFacultyGapWeight,
                        aiFacultyWorkloadDistributionWeight: initialData.globalConstraints.aiFacultyWorkloadDistributionWeight,
                        aiFacultyPreferenceWeight: initialData.globalConstraints.aiFacultyPreferenceWeight,
                    }
                });

                await db.insert(schema.timetableSettings).values(initialData.timetableSettings).onConflictDoUpdate({
                    target: schema.timetableSettings.id,
                    set: initialData.timetableSettings
                });
                
                if (initialData.constraints.pinnedAssignments.length > 0) {
                    await db.insert(schema.pinnedAssignments).values(initialData.constraints.pinnedAssignments).onConflictDoNothing();
                }
                if (initialData.constraints.plannedLeaves.length > 0) {
                    await db.insert(schema.plannedLeaves).values(initialData.constraints.plannedLeaves).onConflictDoNothing();
                }
                if (initialData.constraints.facultyAvailability.length > 0) {
                    // facultyAvailability has a unique constraint on facultyId, so we update on conflict.
                    for (const fa of initialData.constraints.facultyAvailability) {
                        await db.insert(schema.facultyAvailability)
                            .values(fa)
                            .onConflictDoUpdate({ 
                                target: schema.facultyAvailability.facultyId, 
                                set: { availability: fa.availability } 
                            });
                    }
                }

                console.log('Database seeding process complete.');
            } else {
                console.log('Database already seeded.');
            }
            isSeeded = true;
        } catch (error: any) {
            console.error('CRITICAL: Database connection or seeding failed:', error);
            
            // FIX: Add specific check for "relation does not exist" error (code 42P01).
            // This indicates the DB schema has not been pushed.
            if (error.cause?.code === '42P01') {
                const tableName = (error.cause.message || '').match(/relation "([^"]+)"/)?.[1] || 'a required table';
                const detailedMessage = `Database schema is missing. The table '${tableName}' was not found. If you are running locally, please push your schema to the database by running the command: npx drizzle-kit push`;
                return c.json({ 
                    message: detailedMessage, 
                    error: 'Database not initialized.' 
                }, 503);
            }

            return c.json({ message: 'Could not connect to the database. Please verify credentials and network accessibility.', error: (error as Error).message }, 503);
        }
    }
    await next();
});


app.post('/login', zValidator('json', z.object({ email: z.string().email() })), async (c) => {
  const { email } = c.req.valid('json');
  const userResult = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const user = userResult[0];
  if (user) {
    return c.json(user);
  }
  return c.json({ message: 'User not found' }, 404);
});

// --- GRANULAR DATA FETCHING ENDPOINTS ---
app.get('/subjects', async c => c.json(await db.select().from(schema.subjects)));
app.get('/faculty', async c => c.json(await db.select().from(schema.faculty)));
app.get('/rooms', async c => c.json(await db.select().from(schema.rooms)));
app.get('/departments', async c => c.json(await db.select().from(schema.departments)));
app.get('/batches', async c => c.json(await db.select().from(schema.batches)));
app.get('/users', async c => c.json(await db.select().from(schema.users)));

app.get('/timetables', async (c) => {
    const timetablesWithFeedback = await db.query.timetables.findMany({ with: { feedback: true } });
    const timetables = timetablesWithFeedback.map(tt => ({
        ...tt,
        createdAt: tt.createdAt.toISOString(),
        feedback: (tt.feedback || []).map((fb: TimetableFeedbackFromDB) => ({
            ...fb,
            createdAt: fb.createdAt.toISOString()
        }))
    }));
    return c.json(timetables);
});

app.get('/constraints', async (c) => {
    const [pinnedAssignments, plannedLeaves, facultyAvailability] = await Promise.all([
        db.select().from(schema.pinnedAssignments),
        db.select().from(schema.plannedLeaves),
        db.select().from(schema.facultyAvailability),
    ]);
    return c.json({ pinnedAssignments, plannedLeaves, facultyAvailability });
});

app.get('/settings', async (c) => {
    const [globalConstraintsResult, timetableSettingsResult] = await Promise.all([
        db.select().from(schema.globalConstraints).limit(1),
        db.select().from(schema.timetableSettings).limit(1),
    ]);
    return c.json({
        globalConstraints: globalConstraintsResult[0] || initialData.globalConstraints,
        timetableSettings: timetableSettingsResult[0] || initialData.timetableSettings,
    });
});


app.post('/scheduler', zValidator('json', z.object({ batchIds: z.array(z.string()).min(1) })), async (c) => {
    try {
        const { batchIds } = c.req.valid('json');
        console.log(`[API /scheduler] Received request for batchIds: ${JSON.stringify(batchIds)}`);
        
        // FIX: Renamed 'results' to 'dbResults' to avoid redeclaration conflict later in the function.
        const dbResults = await Promise.all([
            db.select().from(schema.batches).where(inArray(schema.batches.id, batchIds)),
            db.select().from(schema.subjects),
            db.select().from(schema.faculty),
            db.select().from(schema.rooms),
            db.select().from(schema.globalConstraints).limit(1),
            db.select().from(schema.pinnedAssignments),
            db.select().from(schema.plannedLeaves),
            db.select().from(schema.facultyAvailability),
            db.query.timetables.findMany({
                where: eq(schema.timetables.status, 'Approved'),
                with: { feedback: true },
            }),
            db.select().from(schema.timetableSettings).limit(1),
        ]);
        
        const batches = dbResults[0];
        const allSubjects = dbResults[1];
        const allFaculty: Faculty[] = dbResults[2]; // Explicitly type to fix build error
        const allRooms = dbResults[3];
        const globalConstraintsResult = dbResults[4];
        const pinnedAssignments = dbResults[5];
        const plannedLeaves = dbResults[6];
        const facultyAvailability = dbResults[7];
        const approvedTimetablesFromDb = dbResults[8];
        const timetableSettings = (dbResults[9] || [])[0] || initialData.timetableSettings;


        if (batches.length !== batchIds.length) {
            return c.json({ message: 'One or more batches not found' }, 404);
        }
        
        // FIX: Convert Date objects to ISO strings for internal logic consistency.
        const approvedTimetables = approvedTimetablesFromDb.map(tt => ({
            ...tt,
            createdAt: tt.createdAt.toISOString(),
            feedback: (tt.feedback || []).map((fb: TimetableFeedbackFromDB) => ({
                ...fb,
                createdAt: fb.createdAt.toISOString()
            }))
        }));

        const baseGlobalConstraints = globalConstraintsResult[0] || initialData.globalConstraints;
        const allFeedback = approvedTimetables.flatMap(tt => tt.feedback || []);

        // --- SELF-TUNING STEP ---
        const tunedConstraints = await tuneConstraintWeightsWithGemini(baseGlobalConstraints, allFeedback, allFaculty);
        
        // Persist the AI's new learned weights
        await db.update(schema.globalConstraints)
            .set({
                aiStudentGapWeight: tunedConstraints.aiStudentGapWeight,
                aiFacultyGapWeight: tunedConstraints.aiFacultyGapWeight,
                aiFacultyWorkloadDistributionWeight: tunedConstraints.aiFacultyWorkloadDistributionWeight,
                aiFacultyPreferenceWeight: tunedConstraints.aiFacultyPreferenceWeight,
            })
            .where(eq(schema.globalConstraints.id, baseGlobalConstraints.id));
        
        // --- Prerequisite Validation ---
        const validationErrors: string[] = [];
        const uniqueSubjectsInSelection = new Map<string, Subject>();
        batches.forEach(batch => {
          batch.subjectIds.forEach(subId => {
            const subject = allSubjects.find(s => s.id === subId);
            if (subject && !uniqueSubjectsInSelection.has(subId)) {
              uniqueSubjectsInSelection.set(subId, subject);
            }
          });
        });

        if (uniqueSubjectsInSelection.size === 0 && batches.length > 0) {
            validationErrors.push("Selected batches have no subjects assigned.");
        }

        for (const [subjectId, subject] of uniqueSubjectsInSelection.entries()) {
          const canBeTaught = allFaculty.some(f => f.subjectIds.includes(subjectId));
          if (!canBeTaught) {
            validationErrors.push(`No faculty member is assigned to teach ${subject.code} - ${subject.name}.`);
          }

          const batchesNeedingSubject = batches.filter(b => b.subjectIds.includes(subjectId));
          for (const batch of batchesNeedingSubject) {
            const requiredType = subject.type === 'Practical' ? 'Lab' : subject.type === 'Workshop' ? 'Workshop' : 'Lecture Hall';
            const hasSuitableRoom = allRooms.some(r => r.type === requiredType && r.capacity >= batch.studentCount);
            if (!hasSuitableRoom) {
              validationErrors.push(`No suitable room found for ${subject.code} (${requiredType}, capacity >= ${batch.studentCount}) for batch ${batch.name}.`);
            }
          }
        }

        if (validationErrors.length > 0) {
          const errorMessage = `Prerequisites for timetable generation not met:\n- ${validationErrors.join('\n- ')}`;
          return c.json({ message: errorMessage }, 400);
        }
        // --- End Validation ---

        // Use the newly tuned weights for the optimization run
        const candidates = await runOptimization({
          batches,
          allSubjects, allFaculty, allRooms,
          approvedTimetables,
          constraints: { pinnedAssignments, plannedLeaves, facultyAvailability },
          globalConstraints: tunedConstraints, // Use the tuned constraints
          days: DAYS_OF_WEEK, 
          timetableSettings,
          candidateCount: 5,
        });
      
        // FIX: Fully construct the GeneratedTimetable object to match the required type.
        const results: GeneratedTimetable[] = candidates.map((candidate) => ({
          id: `tt_cand_${batchIds.join('_')}_${Date.now()}_${Math.random()}`,
          batchIds,
          version: 1,
          status: 'Draft',
          comments: [],
          createdAt: new Date().toISOString(),
          metrics: candidate.metrics,
          timetable: candidate.timetable,
        }));
        
        return c.json(results);
    } catch (error) {
        console.error(`[API /scheduler] Error:`, error);
        return c.json({ message: 'An unexpected error occurred during timetable generation.', error: (error as Error).message }, 500);
    }
});

// FIX: Add missing /reset-db endpoint to allow database resets from the UI.
app.post('/reset-db', async (c) => {
    try {
        console.log('Resetting database with explicit child-to-parent order...');
        
        // FIX: Reworked the deletion logic to follow a safer, explicit order.
        // This prevents foreign key constraint violations by deleting "child" records before "parent" records.

        // 1. Delete all records from tables that have foreign key constraints pointing to other tables.
        // This ensures no records are left pointing to data that will be deleted.
        await db.delete(schema.timetableFeedback);
        await db.delete(schema.users);
        await db.delete(schema.batches);

        // 2. Now delete records from tables that were being pointed to.
        // The circular dependency between users and faculty is broken since users are gone.
        await db.delete(schema.faculty);
        await db.delete(schema.timetables);
        await db.delete(schema.departments);
        
        // 3. Delete all constraint and settings tables.
        await db.delete(schema.pinnedAssignments);
        await db.delete(schema.plannedLeaves);
        await db.delete(schema.facultyAvailability);
        await db.delete(schema.globalConstraints);
        await db.delete(schema.timetableSettings);
        
        // 4. Finally, delete the remaining base data tables.
        await db.delete(schema.subjects);
        await db.delete(schema.rooms);

        isSeeded = false; // Flag for re-seeding on the next API request.

        console.log('Database reset complete.');
        return c.json({ success: true, message: 'Database has been reset.' });
    } catch (error) {
        console.error('CRITICAL: Database reset failed:', error);
        return c.json({ message: 'Failed to reset the database.', error: (error as Error).message }, 500);
    }
});

// FIX: Add all missing CRUD and update endpoints called by the frontend service.
// --- TIMETABLE MANAGEMENT ---
app.post('/timetables', async (c) => {
    const timetable: GeneratedTimetable = await c.req.json();
    if (timetable.status === 'Approved') {
        const existingTimetables = await db.select().from(schema.timetables);
        for (const tt of existingTimetables) {
            if (tt.status === 'Approved' && tt.id !== timetable.id) {
                const hasOverlap = tt.batchIds.some(bId => timetable.batchIds.includes(bId));
                if (hasOverlap) {
                    await db.update(schema.timetables).set({ status: 'Archived' }).where(eq(schema.timetables.id, tt.id));
                }
            }
        }
    }
    const result = await db.insert(schema.timetables).values(timetable).onConflictDoUpdate({ target: schema.timetables.id, set: timetable }).returning();
    return c.json(result[0]);
});

app.post('/timetables/feedback', async (c) => {
    const feedback: Omit<TimetableFeedback, 'id' | 'createdAt'> = await c.req.json();
    const newId = `fb_${Date.now()}`;
    const result = await db.insert(schema.timetableFeedback).values({ ...feedback, id: newId }).returning();
    return c.json(result[0]);
});

// --- GENERIC CRUD FOR CORE DATA ---
const tables = {
    subjects: schema.subjects, faculty: schema.faculty, rooms: schema.rooms,
    batches: schema.batches, departments: schema.departments, users: schema.users,
};
for (const [path, table] of Object.entries(tables)) {
    app.post(`/${path}`, async (c) => {
        const item = await c.req.json();
        const result = await db.insert(table).values(item).onConflictDoUpdate({ target: (table as any).id, set: item }).returning();
        return c.json(result[0]);
    });
    app.delete(`/${path}/:id`, async (c) => {
        const { id } = c.req.param();
        await db.delete(table).where(eq((table as any).id, id));
        return c.json({ success: true });
    });
}

// --- CONSTRAINTS & SETTINGS ---
app.post('/constraints/pinned', async c => {
    const item: PinnedAssignment = await c.req.json();
    const result = await db.insert(schema.pinnedAssignments).values(item).onConflictDoUpdate({ target: schema.pinnedAssignments.id, set: item }).returning();
    return c.json(result[0]);
});
app.delete('/constraints/pinned/:id', async c => {
    const { id } = c.req.param();
    await db.delete(schema.pinnedAssignments).where(eq(schema.pinnedAssignments.id, id));
    return c.json({ success: true });
});

app.post('/constraints/leaves', async c => {
    const item: PlannedLeave = await c.req.json();
    const result = await db.insert(schema.plannedLeaves).values(item).onConflictDoUpdate({ target: schema.plannedLeaves.id, set: item }).returning();
    return c.json(result[0]);
});
app.delete('/constraints/leaves/:id', async c => {
    const { id } = c.req.param();
    await db.delete(schema.plannedLeaves).where(eq(schema.plannedLeaves.id, id));
    return c.json({ success: true });
});

app.post('/constraints/availability', async (c) => {
    const data: FacultyAvailability = await c.req.json();
    const result = await db.insert(schema.facultyAvailability)
        .values({ facultyId: data.facultyId, availability: data.availability })
        .onConflictDoUpdate({ target: schema.facultyAvailability.facultyId, set: { availability: data.availability } })
        .returning();
    return c.json(result[0]);
});

app.post('/settings/global', async (c) => {
    const data: GlobalConstraints = await c.req.json();
    try {
        // Use a more robust UPSERT pattern. This will update the row if it exists,
        // or insert it if it doesn't (which is unlikely but safe).
        // This is more reliable than a separate UPDATE then SELECT.
        const { id, ...constraintsToUpdate } = data;
        const result = await db.insert(schema.globalConstraints)
            .values(data)
            .onConflictDoUpdate({
                target: schema.globalConstraints.id,
                set: constraintsToUpdate
            })
            .returning();
        
        if (result && result.length > 0) {
            return c.json(result[0]);
        }
        // Fallback for drivers that don't support returning() on upsert well.
        const fallbackResult = await db.select().from(schema.globalConstraints).where(eq(schema.globalConstraints.id, 1));
        if (fallbackResult.length > 0) return c.json(fallbackResult[0]);

        return c.json({ message: 'Failed to save or retrieve constraints after update.' }, 500);

    } catch (error: any) {
        console.error('Error updating global constraints:', error);
        return c.json({ message: 'Database error during constraints update.', error: error.message }, 500);
    }
});

app.post('/settings/timetable', async (c) => {
    const data: TimetableSettings = await c.req.json();
    try {
        // Use a more robust UPSERT pattern. This will update the row if it exists,
        // or insert it if it doesn't (which is unlikely but safe).
        // This is more reliable than a separate UPDATE then SELECT.
        const { id, ...settingsToUpdate } = data;
        const result = await db.insert(schema.timetableSettings)
            .values(data)
            .onConflictDoUpdate({
                target: schema.timetableSettings.id,
                set: settingsToUpdate
            })
            .returning();

        if (result && result.length > 0) {
            return c.json(result[0]);
        }
        
        // Fallback for drivers that don't support returning() on upsert well.
        const fallbackResult = await db.select().from(schema.timetableSettings).where(eq(schema.timetableSettings.id, 1));
        if (fallbackResult.length > 0) return c.json(fallbackResult[0]);

        return c.json({ message: 'Failed to save or retrieve settings after update.' }, 500);

    } catch (error: any) {
        console.error('Error updating timetable settings:', error);
        return c.json({ message: 'Database error during settings update.', error: error.message }, 500);
    }
});

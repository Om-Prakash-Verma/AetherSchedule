import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../db/schema';
import { initialData } from './seedData';
import { runOptimization, tuneConstraintWeightsWithGemini } from '../core/schedulerEngine';
import { DAYS_OF_WEEK, TIME_SLOTS } from '../constants';
import { eq, and, inArray, InferSelectModel } from 'drizzle-orm';
import type { GeneratedTimetable, Batch, User, FacultyAvailability, Subject, TimetableFeedback, GlobalConstraints, Faculty } from '../types';

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


const app = new Hono().basePath('/api');

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
            
            if (userCountResult.length === 0) {
                console.log('Database is empty. Seeding...');
                await db.insert(schema.users).values(initialData.users);
                await db.insert(schema.departments).values(initialData.departments);
                await db.insert(schema.subjects).values(initialData.subjects);
                await db.insert(schema.faculty).values(initialData.faculty);
                await db.insert(schema.rooms).values(initialData.rooms);
                await db.insert(schema.batches).values(initialData.batches);
                await db.insert(schema.globalConstraints).values(initialData.globalConstraints);
                console.log('Database seeded successfully!');
            } else {
                console.log('Database already seeded.');
            }
            isSeeded = true;
        } catch (error) {
            console.error('CRITICAL: Database connection or seeding failed:', error);
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

app.get('/data', async (c) => {
    try {
        const dataResults = await Promise.all([
            db.select().from(schema.users),
            db.select().from(schema.subjects),
            db.select().from(schema.faculty),
            db.select().from(schema.rooms),
            db.select().from(schema.departments),
            db.select().from(schema.batches),
            db.query.timetables.findMany({ with: { feedback: true } }),
            db.select().from(schema.globalConstraints).limit(1),
            db.select().from(schema.pinnedAssignments),
            db.select().from(schema.plannedLeaves),
            db.select().from(schema.facultyAvailability),
        ]);

        const users = dataResults[0];
        const subjects = dataResults[1];
        const faculty = dataResults[2];
        const rooms = dataResults[3];
        const departments = dataResults[4];
        const batches = dataResults[5];
        const timetablesWithFeedback = dataResults[6];
        const globalConstraintsResult = dataResults[7];
        const pinnedAssignments = dataResults[8];
        const plannedLeaves = dataResults[9];
        const facultyAvailability = dataResults[10];


        // FIX: Convert Date objects to ISO strings for API compatibility.
        // The database returns Date objects, but the frontend/shared types expect strings.
        const timetables = timetablesWithFeedback.map(tt => ({
            ...tt,
            createdAt: tt.createdAt.toISOString(),
            feedback: (tt.feedback || []).map((fb: TimetableFeedbackFromDB) => ({
                ...fb,
                createdAt: fb.createdAt.toISOString()
            }))
        }));

        return c.json({
            users,
            subjects,
            faculty,
            rooms,
            departments,
            batches,
            generatedTimetables: timetables,
            globalConstraints: globalConstraintsResult[0] || initialData.globalConstraints,
            constraints: {
                pinnedAssignments,
                plannedLeaves,
                facultyAvailability,
            }
        });
    } catch (error) {
        console.error('Failed to fetch initial application data:', error);
        return c.json({ message: 'Failed to fetch application data.', error: (error as Error).message }, 500);
    }
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
            })
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
          days: DAYS_OF_WEEK, slots: TIME_SLOTS,
          candidateCount: 5,
        });
      
        const results: GeneratedTimetable[] = candidates.map((candidate) => ({
          id: `tt_cand_${batchIds.join('_')}_${Date.now()}_${Math.random()}`,
          batchIds, version: 1, status: 'Draft', comments: [],
          createdAt: new Date().toISOString(),
          metrics: candidate.metrics, timetable: candidate.timetable,
        }));
      
        console.log(`[API /scheduler] Successfully generated ${results.length} candidates.`);
        return c.json(results);
    } catch (error) {
        console.error('[API /scheduler] An unexpected error occurred:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown internal server error occurred.';
        return c.json({ message: `Scheduler failed: ${errorMessage}` }, 500);
    }
});

app.post('/timetables', async (c) => {
    const timetable = await c.req.json() as GeneratedTimetable;
    
    if (timetable.status === 'Approved') {
        const existingApproved = await db.select().from(schema.timetables).where(eq(schema.timetables.status, 'Approved'));
        const toArchiveIds = existingApproved
            .filter(tt => tt.batchIds.some(bId => timetable.batchIds.includes(bId)))
            .map(tt => tt.id);
        
        if (toArchiveIds.length > 0) {
            await db.update(schema.timetables)
              .set({ status: 'Archived' })
              .where(inArray(schema.timetables.id, toArchiveIds));
        }
    }

    // FIX: Convert incoming string date to a Date object for the database.
    const { createdAt, feedback, ...dataForDb } = timetable;
    const dataForDbWithDate = {
        ...dataForDb,
        createdAt: new Date(createdAt),
    };

    // FIX: Renamed 'results' to 'insertResults' to avoid a redeclaration error.
    const insertResults = await db.insert(schema.timetables).values(dataForDbWithDate).onConflictDoUpdate({
        target: schema.timetables.id,
        set: dataForDbWithDate
    }).returning();
    
    // FIX: Convert outgoing Date object back to a string for the client.
    const savedTimetable = {
        ...insertResults[0],
        createdAt: insertResults[0].createdAt.toISOString(),
    };
    return c.json(savedTimetable);
});

app.post('/timetables/feedback', async (c) => {
    const feedbackData = await c.req.json() as Omit<TimetableFeedback, 'id' | 'createdAt'>;
    
    // FIX: Use a Date object for database insertion, not an ISO string.
    const newFeedbackForDb = {
        ...feedbackData,
        id: `fb_${Date.now()}`,
        createdAt: new Date(),
    };
    const results = await db.insert(schema.timetableFeedback).values(newFeedbackForDb).returning();

    // FIX: Convert outgoing Date object back to a string for the client.
    const savedFeedback = {
        ...results[0],
        createdAt: results[0].createdAt.toISOString(),
    };
    return c.json(savedFeedback);
});

app.post('/reset-db', async (c) => {
    // FIX: Completely clear all tables in the correct dependency order.
    // This ensures a true clean slate for re-seeding.
    await db.delete(schema.timetableFeedback);
    await db.delete(schema.facultyAvailability);
    await db.delete(schema.plannedLeaves);
    await db.delete(schema.pinnedAssignments);
    await db.delete(schema.globalConstraints);
    await db.delete(schema.timetables);
    // FIX: Delete ALL users, not just students, to prevent unique constraint errors on re-seed.
    await db.delete(schema.users);
    await db.delete(schema.batches);
    await db.delete(schema.departments);
    await db.delete(schema.rooms);
    await db.delete(schema.faculty);
    await db.delete(schema.subjects);
    
    isSeeded = false;
    
    // Re-run the seeding logic from the middleware's perspective on the next API call
    // This is safer than re-seeding directly here.
    try {
        console.log('Database tables cleared. Re-seeding will occur on the next API request.');
    } catch(error) {
         console.error('An error occurred during DB reset:', error);
    }

    return c.json({ success: true, message: 'Database reset. It will be re-seeded on the next action.' });
});

// Generic CRUD factory
const createCrudEndpoints = (table: any) => {
    const crudApp = new Hono();
    crudApp.post('/', async (c) => {
        const item = await c.req.json();
        const results = await db.insert(table).values(item).onConflictDoUpdate({ target: table.id, set: item }).returning();
        return c.json(results[0]);
    });
    crudApp.delete('/:id', async (c) => {
        const id = c.req.param('id');
        await db.delete(table).where(eq(table.id, id));
        return c.json({ success: true });
    });
    return crudApp;
};

app.route('/subjects', createCrudEndpoints(schema.subjects));
app.route('/rooms', createCrudEndpoints(schema.rooms));
app.route('/departments', createCrudEndpoints(schema.departments));
app.route('/users', createCrudEndpoints(schema.users));
app.route('/constraints/pinned', createCrudEndpoints(schema.pinnedAssignments));
app.route('/constraints/leaves', createCrudEndpoints(schema.plannedLeaves));


// Custom Faculty Routes to handle user creation/deletion
const facultyApp = new Hono();

facultyApp.post('/', async (c) => {
    const facultyRecord = await c.req.json() as Faculty;
    const existingFaculty = facultyRecord.id ? await db.query.faculty.findFirst({ where: eq(schema.faculty.id, facultyRecord.id) }) : null;

    // --- UPDATE existing faculty ---
    if (existingFaculty) {
        const updatedFaculty = await db.update(schema.faculty).set(facultyRecord).where(eq(schema.faculty.id, facultyRecord.id)).returning();
        
        // Also update the linked user's name if it has changed
        if (existingFaculty.userId) {
            const linkedUser = await db.query.users.findFirst({ where: eq(schema.users.id, existingFaculty.userId) });
            if (linkedUser && linkedUser.name !== facultyRecord.name) {
                await db.update(schema.users).set({ name: facultyRecord.name }).where(eq(schema.users.id, linkedUser.id));
            }
        }
        return c.json(updatedFaculty[0]);
    }
    // --- CREATE new faculty ---
    else {
        if (!facultyRecord.name) {
            return c.json({ message: 'Faculty name is required.' }, 400);
        }

        // Auto-generate a unique email
        let baseEmail = facultyRecord.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
        let finalEmail = `${baseEmail}@test.com`;
        let counter = 1;
        let existingUser = await db.query.users.findFirst({ where: eq(schema.users.email, finalEmail) });
        while (existingUser) {
            finalEmail = `${baseEmail}${counter}@test.com`;
            counter++;
            existingUser = await db.query.users.findFirst({ where: eq(schema.users.email, finalEmail) });
        }
        
        try {
            // Generate IDs first
            const newFacultyId = `fac_${Date.now()}`;
            const newUserId = `user_fac_${Date.now()}`;
        
            // 1. Create Faculty record first, with a null userId to break the circular dependency
            const facultyToInsert = { ...facultyRecord, id: newFacultyId, userId: null };
            await db.insert(schema.faculty).values(facultyToInsert);
        
            // 2. Create the User, correctly linking to the new faculty's ID
            await db.insert(schema.users).values({
                id: newUserId,
                name: facultyRecord.name,
                email: finalEmail,
                role: 'Faculty',
                facultyId: newFacultyId,
            });
            
            // 3. Update the Faculty record with the new user's ID
            const updatedFaculty = await db.update(schema.faculty)
                .set({ userId: newUserId })
                .where(eq(schema.faculty.id, newFacultyId))
                .returning();
            
            return c.json(updatedFaculty[0], 201);
        } catch (error) {
            console.error("Error creating faculty without transaction:", error);
            return c.json({ message: "Failed to create faculty due to a server error.", error: (error as Error).message }, 500);
        }
    }
});

facultyApp.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const facultyToDelete = await db.query.faculty.findFirst({ where: eq(schema.faculty.id, id) });
    
    if (!facultyToDelete) {
        return c.json({ message: 'Faculty not found' }, 404);
    }
    
    try {
        // First, delete the linked user account to avoid foreign key violations.
        // The schema's `onDelete: 'set null'` would handle this, but explicit deletion is cleaner.
        if (facultyToDelete.userId) {
            await db.delete(schema.users).where(eq(schema.users.id, facultyToDelete.userId));
        }
        // Then, delete the faculty record itself
        await db.delete(schema.faculty).where(eq(schema.faculty.id, id));

        return c.json({ success: true });
    } catch (error) {
        console.error("Error deleting faculty without transaction:", error);
        return c.json({ message: "Failed to delete faculty due to a server error.", error: (error as Error).message }, 500);
    }
});

app.route('/faculty', facultyApp);


const batchesApp = new Hono();
batchesApp.post('/', async (c) => {
    const batch = await c.req.json() as Batch;
    const results = await db.insert(schema.batches).values(batch).onConflictDoUpdate({ target: schema.batches.id, set: batch }).returning();
    const savedBatch = results[0];

    if (savedBatch) {
        const studentUserForBatch = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.batchId, savedBatch.id)).limit(1);

        if (studentUserForBatch.length === 0) {
            const userEmail = `${savedBatch.name.toLowerCase().replace(/\s+/g, '_')}@test.com`;
            const newUser: User = {
                id: `user_batch_${savedBatch.id}`,
                name: `${savedBatch.name} Student Rep`,
                email: userEmail,
                role: 'Student',
                batchId: savedBatch.id,
            };
            const existingUserByEmail = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, userEmail)).limit(1);
            if (existingUserByEmail.length === 0) {
                await db.insert(schema.users).values(newUser);
            }
        }
    }
    
    return c.json(savedBatch);
});
batchesApp.delete('/:id', async (c) => {
    const id = c.req.param('id');
    await db.delete(schema.users).where(eq(schema.users.batchId, id));
    await db.delete(schema.batches).where(eq(schema.batches.id, id));
    return c.json({ success: true });
});
app.route('/batches', batchesApp);


app.post('/constraints/availability', async (c) => {
    const item = await c.req.json() as FacultyAvailability;
    const results = await db.insert(schema.facultyAvailability).values(item).onConflictDoUpdate({ target: schema.facultyAvailability.facultyId, set: { availability: item.availability } }).returning();
    return c.json(results[0]);
});

app.post('/settings/global', async (c) => {
    const newGlobalConstraints = await c.req.json() as GlobalConstraints;
    const { id, ...dataToUpdate } = newGlobalConstraints;
    
    // When a user saves, reset the AI weights to match the new base weights.
    // This lets the AI learn from a new baseline.
    const updatePayload = {
        ...dataToUpdate,
        aiStudentGapWeight: dataToUpdate.studentGapWeight,
        aiFacultyGapWeight: dataToUpdate.facultyGapWeight,
        aiFacultyWorkloadDistributionWeight: dataToUpdate.facultyWorkloadDistributionWeight,
        aiFacultyPreferenceWeight: dataToUpdate.facultyPreferenceWeight,
    };

    const results = await db.update(schema.globalConstraints)
        .set(updatePayload)
        .where(eq(schema.globalConstraints.id, id || 1))
        .returning();

    return c.json(results[0]);
});

export { app };
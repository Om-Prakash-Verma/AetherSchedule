import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { initialData } from './seedData';
import { runOptimization, runPreflightDiagnostics, applyNaturalLanguageCommand } from '../core/schedulerEngine';
import { generateAnalyticsReport, compareTimetablesWithGemini } from '../core/analyticsEngine';
import { findRankedSubstitutes } from '../core/substituteFinder';
import { DAYS_OF_WEEK } from '../constants';
import type { Batch, Constraints, Faculty, FacultyAllocation, FacultyAvailability, GeneratedTimetable, GlobalConstraints, PinnedAssignment, PlannedLeave, Room, Subject, Substitution, TimetableFeedback, TimetableSettings, User, Department, AnalyticsReport, TimetableGrid, ClassAssignment } from '../types';

export const app = new Hono().basePath('/api');

// CORS for local development
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:4173'], // Vite dev and preview ports
  credentials: true,
}));


// --- SEEDING LOGIC ---
export const seedDatabaseIfEmpty = async () => {
    try {
        const userCountResult = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
        const userCount = userCountResult[0]?.count ?? 0;

        if (userCount > 0) {
            console.log('[db:seed] Database already contains data. Skipping seed.');
            return;
        }

        console.log('[db:seed] Database is empty. Seeding with initial data...');
        
        const { users, departments, subjects, faculty, rooms, batches, globalConstraints, timetableSettings, constraints, facultyAllocations } = initialData;

        // Correct insertion order to respect foreign key constraints
        
        // 1. Insert tables with no dependencies on other seeded tables
        await db.insert(schema.departments).values(departments);
        await db.insert(schema.subjects).values(subjects);
        await db.insert(schema.rooms).values(rooms);
        await db.insert(schema.globalConstraints).values(globalConstraints);
        await db.insert(schema.timetableSettings).values(timetableSettings);
        await db.insert(schema.constraints).values({ id: 1, ...constraints });

        // 2. Insert batches (depends on departments)
        await db.insert(schema.batches).values(batches);
        
        // 3. Break the circular dependency between users and faculty
        //  a. Insert faculty records WITHOUT their user_id link (it's nullable)
        const facultyForInsert = faculty.map(({ userId, ...rest }) => rest);
        await db.insert(schema.faculty).values(facultyForInsert);
        
        //  b. Now insert ALL users. The 'faculty' users can now link to the faculty records created above.
        await db.insert(schema.users).values(users);
        
        //  c. Finally, update the faculty records to add the link back to the users.
        for (const f of faculty) {
            if (f.userId) {
                await db.update(schema.faculty)
                    .set({ userId: f.userId })
                    .where(eq(schema.faculty.id, f.id));
            }
        }

        // 4. Insert remaining dependent tables
        if(facultyAllocations.length > 0) await db.insert(schema.facultyAllocations).values(facultyAllocations);


        console.log('[db:seed] Seeding complete.');

    } catch (error) {
        console.error('[db:seed] Error seeding database:', error);
        // Re-throw the error to be handled by the calling script (e.g., scripts/seed.ts)
        // This prevents the application from exiting unexpectedly when used as a module.
        throw error;
    }
};

// --- ERROR HANDLING ---
app.onError((err, c) => {
  console.error(`${c.req.method} ${c.req.url}`, err);
  return c.json({ message: err.message || 'An internal server error occurred' }, 500);
});

// --- ROUTES ---

// Auth
app.post('/login', async (c) => {
  const { email } = await c.req.json();
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user) {
    return c.json({ message: 'User not found' }, 404);
  }
  return c.json(user);
});


// Data Getters
app.get('/subjects', async (c) => c.json(await db.query.subjects.findMany()));
app.get('/faculty', async (c) => c.json(await db.query.faculty.findMany()));
app.get('/rooms', async (c) => c.json(await db.query.rooms.findMany()));
app.get('/departments', async (c) => c.json(await db.query.departments.findMany()));
app.get('/batches', async (c) => c.json(await db.query.batches.findMany()));
app.get('/users', async (c) => c.json(await db.query.users.findMany()));
app.get('/timetables', async (c) => c.json(await db.query.timetables.findMany()));
app.get('/faculty-allocations', async (c) => c.json(await db.query.facultyAllocations.findMany()));

app.get('/constraints', async (c) => {
    const result = await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) });
    return c.json(result || { pinnedAssignments: [], plannedLeaves: [], facultyAvailability: [], substitutions: [] });
});

app.get('/settings', async (c) => {
    const globalConstraints = await db.query.globalConstraints.findFirst({ where: eq(schema.globalConstraints.id, 1) });
    const timetableSettings = await db.query.timetableSettings.findFirst({ where: eq(schema.timetableSettings.id, 1) });
    return c.json({ globalConstraints, timetableSettings });
});


// CRUD operations
const createCrudEndpoints = <T extends { id: string }>(
    path: string, 
    table: typeof schema.subjects | typeof schema.faculty | typeof schema.rooms | typeof schema.users | typeof schema.departments
) => {
    app.post(`/${path}`, async (c) => {
        const item = await c.req.json();
        // Drizzle's onConflictDoUpdate needs a unique constraint to work, so we do a manual upsert.
        // @ts-ignore
        const existing = await db.query[table.name].findFirst({ where: eq(table.id, item.id) });
        if (existing) {
             // @ts-ignore
            const [updatedItem] = await db.update(table).set(item).where(eq(table.id, item.id)).returning();
            return c.json(updatedItem);
        } else {
             // @ts-ignore
            const [newItem] = await db.insert(table).values(item).returning();
            return c.json(newItem, 201);
        }
    });
    app.delete(`/${path}/:id`, async (c) => {
        const { id } = c.req.param();
         // @ts-ignore
        await db.delete(table).where(eq(table.id, id));
        return c.json({ success: true });
    });
};

createCrudEndpoints('subjects', schema.subjects);
createCrudEndpoints('faculty', schema.faculty);
createCrudEndpoints('rooms', schema.rooms);
createCrudEndpoints('users', schema.users);
createCrudEndpoints('departments', schema.departments);

// Special case for Batches due to 'allocations' virtual property
app.post('/batches', async (c) => {
    const { allocations, ...batchData }: Batch & { allocations?: Record<string, string[]> } = await c.req.json();
    
    await db.transaction(async (tx) => {
        // Upsert batch
        const existing = await tx.query.batches.findFirst({ where: eq(schema.batches.id, batchData.id) });
        if (existing) {
            await tx.update(schema.batches).set(batchData).where(eq(schema.batches.id, batchData.id));
        } else {
            await tx.insert(schema.batches).values(batchData);
        }

        // Update faculty allocations for this batch
        if (allocations) {
            // Delete old allocations for this batch
            await tx.delete(schema.facultyAllocations).where(eq(schema.facultyAllocations.batchId, batchData.id));
            
            // Insert new ones
            const newAllocations = Object.entries(allocations).map(([subjectId, facultyIds]) => ({
                id: `fa_${batchData.id}_${subjectId}`,
                batchId: batchData.id,
                subjectId,
                facultyIds: Array.isArray(facultyIds) ? facultyIds : [facultyIds],
            })).filter(a => a.facultyIds.length > 0 && a.facultyIds[0] !== '');

            if (newAllocations.length > 0) {
                await tx.insert(schema.facultyAllocations).values(newAllocations);
            }
        }
    });

    return c.json(batchData);
});
app.delete('/batches/:id', async (c) => {
    const { id } = c.req.param();
    await db.transaction(async (tx) => {
        await tx.delete(schema.facultyAllocations).where(eq(schema.facultyAllocations.batchId, id));
        await tx.delete(schema.batches).where(eq(schema.batches.id, id));
    });
    return c.json({ success: true });
});


// Timetable management
app.post('/timetables', async (c) => {
    const timetable: GeneratedTimetable = await c.req.json();
    
    await db.transaction(async (tx) => {
        if (timetable.status === 'Approved') {
            const conflictingBatchIds = timetable.batchIds;
            const existingApproved = await tx.query.timetables.findMany({
                where: eq(schema.timetables.status, 'Approved')
            });

            const toArchive = existingApproved.filter(tt => tt.batchIds.some(bId => conflictingBatchIds.includes(bId)));
            if (toArchive.length > 0) {
                await tx.update(schema.timetables)
                    .set({ status: 'Archived' })
                    .where(inArray(schema.timetables.id, toArchive.map(t => t.id)));
            }
        }
        
        const existing = await tx.query.timetables.findFirst({ where: eq(schema.timetables.id, timetable.id) });
        if (existing) {
            await tx.update(schema.timetables).set(timetable).where(eq(schema.timetables.id, timetable.id));
        } else {
            await tx.insert(schema.timetables).values(timetable);
        }
    });

    return c.json(timetable);
});

app.post('/timetables/feedback', async (c) => {
    const feedbackData: Omit<TimetableFeedback, 'id' | 'createdAt'> = await c.req.json();
    const newFeedback = {
        ...feedbackData,
        id: `fb_${Date.now()}`
    };
    const [result] = await db.insert(schema.feedback).values(newFeedback).returning();
    return c.json(result, 201);
});


// Constraints
app.post('/constraints/pinned', async (c) => {
    const item: PinnedAssignment = await c.req.json();
    const currentConstraints: Partial<Constraints> = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
    const updatedList = currentConstraints.pinnedAssignments || [];
    const index = updatedList.findIndex(i => i.id === item.id);
     if (index > -1) updatedList[index] = item; else updatedList.push(item);
    await db.update(schema.constraints).set({ pinnedAssignments: updatedList }).where(eq(schema.constraints.id, 1));
    return c.json(item);
});
app.delete('/constraints/pinned/:id', async (c) => {
    const { id } = c.req.param();
    const currentConstraints: Partial<Constraints> = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
    const updatedList = (currentConstraints.pinnedAssignments || []).filter(i => i.id !== id);
    await db.update(schema.constraints).set({ pinnedAssignments: updatedList }).where(eq(schema.constraints.id, 1));
    return c.json({ success: true });
});

app.post('/constraints/leaves', async (c) => {
    const item: PlannedLeave = await c.req.json();
    const currentConstraints: Partial<Constraints> = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
    const updatedList = currentConstraints.plannedLeaves || [];
    const index = updatedList.findIndex(i => i.id === item.id);
     if (index > -1) updatedList[index] = item; else updatedList.push(item);
    await db.update(schema.constraints).set({ plannedLeaves: updatedList }).where(eq(schema.constraints.id, 1));
    return c.json(item);
});
app.delete('/constraints/leaves/:id', async (c) => {
    const { id } = c.req.param();
    const currentConstraints: Partial<Constraints> = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
    const updatedList = (currentConstraints.plannedLeaves || []).filter(i => i.id !== id);
    await db.update(schema.constraints).set({ plannedLeaves: updatedList }).where(eq(schema.constraints.id, 1));
    return c.json({ success: true });
});

app.post('/constraints/availability', async (c) => {
    const availability: FacultyAvailability = await c.req.json();
    const currentConstraints: Partial<Constraints> = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
    const availabilities = currentConstraints.facultyAvailability || [];
    const index = availabilities.findIndex(i => i.facultyId === availability.facultyId);
    if (index > -1) {
        availabilities[index] = availability;
    } else {
        availabilities.push(availability);
    }
    await db.update(schema.constraints).set({ facultyAvailability: availabilities }).where(eq(schema.constraints.id, 1));
    return c.json(availability);
});

// Substitutions
app.post('/substitutes/find', async (c) => {
    const { assignmentId } = await c.req.json();

    const allTimetables: GeneratedTimetable[] = await db.query.timetables.findMany();
    const allAssignments: ClassAssignment[] = allTimetables.flatMap(tt =>
        Object.values(tt.timetable as TimetableGrid).flatMap(batchGrid =>
            Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
        )
    );

    const targetAssignment = allAssignments.find(a => a.id === assignmentId);
    if (!targetAssignment) return c.json({ message: "Target assignment not found" }, 404);

    const allFaculty: Faculty[] = await db.query.faculty.findMany();
    const allSubjects: Subject[] = await db.query.subjects.findMany();
    const allBatches: Batch[] = await db.query.batches.findMany();
    const allFacultyAllocations: FacultyAllocation[] = await db.query.facultyAllocations.findMany();
    const constraintsData: Partial<Constraints> = (await db.query.constraints.findFirst()) || {};
    
    const rankedSubstitutes = await findRankedSubstitutes(targetAssignment, allFaculty, allSubjects, allAssignments, constraintsData.facultyAvailability || [], allFacultyAllocations, allBatches);
    return c.json(rankedSubstitutes);
});

app.post('/substitutes', async (c) => {
    const substitution: Substitution = await c.req.json();
    const currentConstraints: Partial<Constraints> = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
    const substitutions = currentConstraints.substitutions || [];
    substitutions.push(substitution);
    await db.update(schema.constraints).set({ substitutions }).where(eq(schema.constraints.id, 1));
    return c.json(substitution, 201);
});

// Settings
app.post('/settings/global', async (c) => {
    const newGlobalConstraints: GlobalConstraints = await c.req.json();
    await db.update(schema.globalConstraints).set(newGlobalConstraints).where(eq(schema.globalConstraints.id, 1));
    return c.json(newGlobalConstraints);
});

app.post('/settings/timetable', async (c) => {
    const newTimetableSettings: TimetableSettings = await c.req.json();
    await db.update(schema.timetableSettings).set(newTimetableSettings).where(eq(schema.timetableSettings.id, 1));
    return c.json(newTimetableSettings);
});


// Scheduler Engine
app.post('/scheduler', async (c) => {
    const { batchIds, baseTimetable } = await c.req.json();
    
    const batchesForScheduler: Batch[] = await db.query.batches.findMany({ where: inArray(schema.batches.id, batchIds) });
    const allSubjects: Subject[] = await db.query.subjects.findMany();
    const allFaculty: Faculty[] = await db.query.faculty.findMany();
    const allRooms: Room[] = await db.query.rooms.findMany();
    const approvedTimetables: GeneratedTimetable[] = await db.query.timetables.findMany({ where: eq(schema.timetables.status, 'Approved') });
    const constraints: Constraints = (await db.query.constraints.findFirst())!;
    const facultyAllocations: FacultyAllocation[] = await db.query.facultyAllocations.findMany();
    const globalConstraints: GlobalConstraints = (await db.query.globalConstraints.findFirst())!;
    const timetableSettings: TimetableSettings = (await db.query.timetableSettings.findFirst())!;

    const dbData = {
        batches: batchesForScheduler,
        allSubjects,
        allFaculty,
        allRooms,
        approvedTimetables,
        constraints,
        facultyAllocations,
        globalConstraints,
        timetableSettings,
        days: DAYS_OF_WEEK,
        candidateCount: 5,
        baseTimetable,
    };
    
    const candidates = await runOptimization(dbData);
    const results = candidates.map((candidate, index) => ({
      id: `tt_cand_${batchIds.join('_')}_${Date.now()}_${index}`,
      batchIds, version: 1, status: 'Draft' as const, comments: [],
      createdAt: new Date(),
      metrics: candidate.metrics, timetable: candidate.timetable,
    }));
    return c.json(results);
});

app.post('/scheduler/diagnostics', async (c) => {
    const { batchIds } = await c.req.json();

    const batchesForDiagnostics: Batch[] = await db.query.batches.findMany({ where: inArray(schema.batches.id, batchIds) });
    const allSubjects: Subject[] = await db.query.subjects.findMany();
    const allFaculty: Faculty[] = await db.query.faculty.findMany();
    const allRooms: Room[] = await db.query.rooms.findMany();
    const facultyAllocations: FacultyAllocation[] = await db.query.facultyAllocations.findMany();

    const input = {
        batches: batchesForDiagnostics,
        allSubjects,
        allFaculty,
        allRooms,
        facultyAllocations,
    };
    const issues = await runPreflightDiagnostics(input);
    return c.json(issues);
});

app.post('/scheduler/nlc', async (c) => {
    const { timetable, command } = await c.req.json();
    
    const allSubjects: Subject[] = await db.query.subjects.findMany();
    const allFaculty: Faculty[] = await db.query.faculty.findMany();
    const allBatches: Batch[] = await db.query.batches.findMany();
    const settings: TimetableSettings = (await db.query.timetableSettings.findFirst())!;

    const dbData = {
        allSubjects,
        allFaculty,
        allBatches,
        days: DAYS_OF_WEEK,
        settings,
    };

    const newGrid = await applyNaturalLanguageCommand(timetable, command, dbData.allSubjects, dbData.allFaculty, dbData.allBatches, dbData.days, dbData.settings);
    return c.json(newGrid);
});

app.post('/scheduler/compare', async (c) => {
    const { candidate1, candidate2 } = await c.req.json();
    const analysis = await compareTimetablesWithGemini(candidate1, candidate2);
    return c.json({ analysis });
});

// Analytics
app.get('/analytics/report/:id', async (c) => {
    const { id } = c.req.param();
    const timetable = await db.query.timetables.findFirst({ where: eq(schema.timetables.id, id) });
    if (!timetable) return c.json({ message: 'Timetable not found' }, 404);

    const allSubjects: Subject[] = await db.query.subjects.findMany();
    const allFaculty: Faculty[] = await db.query.faculty.findMany();
    const allRooms: Room[] = await db.query.rooms.findMany();
    const allBatches: Batch[] = await db.query.batches.findMany();
    const settings: TimetableSettings = (await db.query.timetableSettings.findFirst())!;

    const report = generateAnalyticsReport(
        timetable,
        allSubjects,
        allFaculty,
        allRooms,
        allBatches,
        settings
    );
    // Attach and save report to timetable for caching
    const analyticsReport = report as unknown as AnalyticsReport; // Cast for drizzle jsonb
    await db.update(schema.timetables).set({ analytics: analyticsReport }).where(eq(schema.timetables.id, id));
    return c.json(report);
});

// System
app.post('/reset-db', async (c) => {
    console.log('[db:reset] Resetting database...');
    await db.transaction(async (tx) => {
        // Correctly get table names from schema for dropping
        for (const table of Object.values(schema).reverse()) {
             // @ts-ignore
             if(table && table.dbName) {
                 // @ts-ignore
                await tx.execute(sql.raw(`DROP TABLE IF EXISTS "${table.dbName}" CASCADE;`));
             }
        }
    });

    return c.json({ success: true, message: "Database reset. Please restart the dev server to re-seed." });
});

app.post('/data/import', async (c) => {
    const data = await c.req.json();
    console.log('[db:import] Importing data...');
    
    // Simple validation
    if (!data.subjects || !data.faculty || !data.rooms || !data.batches || !data.departments) {
        return c.json({ message: "Import failed: Missing one or more required data types." }, 400);
    }
    
    await db.transaction(async (tx) => {
        // Clear existing data management tables
        await tx.delete(schema.facultyAllocations);
        await tx.delete(schema.users).where(inArray(schema.users.role, ['Faculty', 'Student']));
        await tx.delete(schema.batches);
        await tx.delete(schema.faculty);
        await tx.delete(schema.subjects);
        await tx.delete(schema.rooms);
        await tx.delete(schema.departments);
        
        // Insert new data
        if(data.departments.length > 0) await tx.insert(schema.departments).values(data.departments);
        if(data.subjects.length > 0) await tx.insert(schema.subjects).values(data.subjects);
        if(data.faculty.length > 0) await tx.insert(schema.faculty).values(data.faculty);
        if(data.rooms.length > 0) await tx.insert(schema.rooms).values(data.rooms);
        if(data.batches.length > 0) await tx.insert(schema.batches).values(data.batches);
    });

    return c.json({ success: true, message: "Data imported successfully." });
});
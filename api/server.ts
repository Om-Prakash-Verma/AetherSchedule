


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


// --- HELPERS ---
const createIdFromName = (name: string, prefix = ''): string => {
    const sanitized = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return prefix ? `${prefix}_${sanitized}` : sanitized;
};


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
    table: typeof schema.subjects | typeof schema.rooms | typeof schema.users
) => {
    app.post(`/${path}`, async (c) => {
        const item = await c.req.json();
        // Drizzle's onConflictDoUpdate needs a unique constraint to work, so we do a manual upsert.
        // @ts-ignore
        const existing = await (db.query as any)[path].findFirst({ where: eq(table.id, item.id) });
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
createCrudEndpoints('rooms', schema.rooms);
createCrudEndpoints('users', schema.users);


// Custom CRUD for Faculty with automatic user creation
app.post('/faculty', async (c) => {
    const facultyData: Faculty = await c.req.json();
    const existing = await db.query.faculty.findFirst({ where: eq(schema.faculty.id, facultyData.id) });

    if (existing) { // UPDATE
        const [updatedFaculty] = await db.update(schema.faculty).set(facultyData).where(eq(schema.faculty.id, facultyData.id)).returning();
        if (existing.userId && facultyData.name !== existing.name) {
            await db.update(schema.users).set({ name: facultyData.name }).where(eq(schema.users.id, existing.userId));
        }
        return c.json(updatedFaculty);
    } else { // CREATE
        const newFacultyId = facultyData.id || `fac_${createIdFromName(facultyData.name)}`;
        const [createdFaculty] = await db.insert(schema.faculty).values({ ...facultyData, id: newFacultyId, userId: null }).returning();

        const newUserId = `user_${createIdFromName(createdFaculty.name)}`;
        const userEmail = `${createIdFromName(createdFaculty.name)}@test.com`;
        const [newUser] = await db.insert(schema.users).values({
            id: newUserId,
            name: createdFaculty.name,
            email: userEmail,
            role: 'Faculty',
            facultyId: createdFaculty.id,
        }).onConflictDoNothing().returning();

        if (newUser) {
            const [updatedFaculty] = await db.update(schema.faculty).set({ userId: newUser.id }).where(eq(schema.faculty.id, createdFaculty.id)).returning();
            return c.json(updatedFaculty, 201);
        }
        return c.json(createdFaculty, 201);
    }
});

app.delete('/faculty/:id', async (c) => {
    const { id } = c.req.param();
    await db.delete(schema.users).where(eq(schema.users.facultyId, id));
    await db.delete(schema.faculty).where(eq(schema.faculty.id, id));
    return c.json({ success: true });
});


// Custom CRUD for Departments with automatic HOD user creation
app.post('/departments', async (c) => {
    const deptData: Department = await c.req.json();
    const existing = await db.query.departments.findFirst({ where: eq(schema.departments.id, deptData.id) });

    if (existing) { // UPDATE
        const [updatedDept] = await db.update(schema.departments).set(deptData).where(eq(schema.departments.id, deptData.id)).returning();
        if (deptData.name !== existing.name) {
            const userToUpdate = await db.query.users.findFirst({ where: eq(schema.users.departmentId, existing.id) });
            if (userToUpdate) {
                await db.update(schema.users).set({ name: `${deptData.name} Head` }).where(eq(schema.users.id, userToUpdate.id));
            }
        }
        return c.json(updatedDept);
    } else { // CREATE
        const newDeptId = deptData.id || `dept_${createIdFromName(deptData.name)}`;
        const [newDept] = await db.insert(schema.departments).values({ ...deptData, id: newDeptId }).returning();

        const userEmail = `${newDept.code.toLowerCase()}.hod@test.com`;
        await db.insert(schema.users).values({
            id: `user_${createIdFromName(newDept.name)}_hod`,
            name: `${newDept.name} Head`,
            email: userEmail,
            role: 'DepartmentHead',
            departmentId: newDept.id,
        }).onConflictDoNothing();
        
        return c.json(newDept, 201);
    }
});

app.delete('/departments/:id', async (c) => {
    const { id } = c.req.param();
    const associatedBatches = await db.query.batches.findFirst({ where: eq(schema.batches.departmentId, id) });
    if (associatedBatches) {
        return c.json({ message: 'Cannot delete department with associated batches. Please re-assign or delete them first.' }, 400);
    }
    await db.delete(schema.users).where(eq(schema.users.departmentId, id));
    await db.delete(schema.departments).where(eq(schema.departments.id, id));
    return c.json({ success: true });
});

// Custom CRUD for Batches with automatic Student Rep user creation
app.post('/batches', async (c) => {
    const { allocations, ...batchData }: Batch & { allocations?: Record<string, string[]> } = await c.req.json();
    
    // Upsert batch
    const existing = await db.query.batches.findFirst({ where: eq(schema.batches.id, batchData.id) });
    if (existing) {
        await db.update(schema.batches).set(batchData).where(eq(schema.batches.id, batchData.id));
    } else {
        const [newBatch] = await db.insert(schema.batches).values(batchData).returning();
        const userEmail = `${createIdFromName(newBatch.name)}.rep@test.com`;
        await db.insert(schema.users).values({
            id: `user_${createIdFromName(newBatch.name)}_rep`,
            name: `${newBatch.name} Student Rep`,
            email: userEmail,
            role: 'Student',
            batchId: newBatch.id,
        }).onConflictDoNothing();
    }

    // Update faculty allocations for this batch
    if (allocations) {
        // Delete old allocations for this batch
        await db.delete(schema.facultyAllocations).where(eq(schema.facultyAllocations.batchId, batchData.id));
        
        // Insert new ones
        const newAllocations = Object.entries(allocations).map(([subjectId, facultyIds]) => ({
            id: `fa_${batchData.id}_${subjectId}`,
            batchId: batchData.id,
            subjectId,
            facultyIds: Array.isArray(facultyIds) ? facultyIds : [facultyIds],
        })).filter(a => a.facultyIds.length > 0 && a.facultyIds[0] !== '');

        if (newAllocations.length > 0) {
            await db.insert(schema.facultyAllocations).values(newAllocations);
        }
    }

    return c.json(batchData);
});
app.delete('/batches/:id', async (c) => {
    const { id } = c.req.param();
    // Delete dependent faculty allocations and users first
    await db.delete(schema.facultyAllocations).where(eq(schema.facultyAllocations.batchId, id));
    await db.delete(schema.users).where(eq(schema.users.batchId, id));
    // Then the batch
    await db.delete(schema.batches).where(eq(schema.batches.id, id));
    return c.json({ success: true });
});


// Timetable management
app.post('/timetables', async (c) => {
    const timetable: GeneratedTimetable = await c.req.json();
    
    // If a timetable is approved, archive any other approved timetables for the same batches.
    if (timetable.status === 'Approved') {
        const conflictingBatchIds = timetable.batchIds;
        const existingApproved = await db.query.timetables.findMany({
            where: eq(schema.timetables.status, 'Approved')
        });

        const toArchive = existingApproved.filter(tt => tt.batchIds.some(bId => conflictingBatchIds.includes(bId)));
        if (toArchive.length > 0) {
            await db.update(schema.timetables)
                .set({ status: 'Archived' })
                .where(inArray(schema.timetables.id, toArchive.map(t => t.id)));
        }
    }
    
    const timetableForDb = {
        ...timetable,
        createdAt: new Date(timetable.createdAt),
    };

    // Upsert the timetable.
    const existing = await db.query.timetables.findFirst({ where: eq(schema.timetables.id, timetableForDb.id) });
    if (existing) {
        await db.update(schema.timetables).set(timetableForDb).where(eq(schema.timetables.id, timetableForDb.id));
    } else {
        await db.insert(schema.timetables).values(timetableForDb);
    }

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
    const { assignmentId, currentTimetableGrid } = await c.req.json();

    if (!currentTimetableGrid) {
        return c.json({ message: "Current timetable grid is required." }, 400);
    }

    const allAssignmentsInCurrentGrid: ClassAssignment[] = Object.values(currentTimetableGrid as TimetableGrid).flatMap(batchGrid =>
        Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
    );

    const targetAssignment = allAssignmentsInCurrentGrid.find(a => a.id === assignmentId);
    if (!targetAssignment) return c.json({ message: "Target assignment not found in the provided timetable." }, 404);

    const allFaculty: Faculty[] = await db.query.faculty.findMany();
    const allSubjects: Subject[] = await db.query.subjects.findMany();
    const allBatches: Batch[] = await db.query.batches.findMany();
    const allFacultyAllocations: FacultyAllocation[] = await db.query.facultyAllocations.findMany();
    const constraintsData: Partial<Constraints> = (await db.query.constraints.findFirst()) || {};
    
    const rankedSubstitutes = await findRankedSubstitutes(targetAssignment, allFaculty, allSubjects, allAssignmentsInCurrentGrid, constraintsData.facultyAvailability || [], allFacultyAllocations, allBatches);
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
    // Drop tables sequentially without a transaction
    for (const table of Object.values(schema).reverse()) {
         // @ts-ignore
         if(table && table.dbName) {
             // @ts-ignore
            await db.execute(sql.raw(`DROP TABLE IF EXISTS "${table.dbName}" CASCADE;`));
         }
    }

    return c.json({ success: true, message: "Database reset. Please restart the dev server to re-seed." });
});

app.post('/data/import', async (c) => {
    const data = await c.req.json();
    console.log('[db:import] Importing data...');
    
    // Simple validation
    if (!data.subjects || !data.faculty || !data.rooms || !data.batches || !data.departments) {
        return c.json({ message: "Import failed: Missing one or more required data types." }, 400);
    }
    
    // Perform operations sequentially without a transaction
    
    // 1. Break the circular dependency between users and faculty by nullifying links
    await db.update(schema.users).set({ facultyId: null }).where(inArray(schema.users.role, ['Faculty']));
    await db.update(schema.faculty).set({ userId: null });

    // 2. Delete data in an order that respects foreign key constraints
    await db.delete(schema.facultyAllocations);
    await db.delete(schema.users).where(inArray(schema.users.role, ['Faculty', 'Student']));
    await db.delete(schema.batches);
    await db.delete(schema.faculty);
    await db.delete(schema.subjects);
    await db.delete(schema.rooms);
    await db.delete(schema.departments);
    
    // 3. Insert new data
    if(data.departments.length > 0) await db.insert(schema.departments).values(data.departments);
    if(data.subjects.length > 0) await db.insert(schema.subjects).values(data.subjects);
    if(data.faculty.length > 0) await db.insert(schema.faculty).values(data.faculty);
    if(data.rooms.length > 0) await db.insert(schema.rooms).values(data.rooms);
    if(data.batches.length > 0) await db.insert(schema.batches).values(data.batches);

    return c.json({ success: true, message: "Data imported successfully." });
});
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { initialData } from './seedData';
import { runOptimization, runPreflightDiagnostics, applyNaturalLanguageCommand } from '../core/schedulerEngine';
import { generateAnalyticsReport, compareTimetablesWithGemini } from '../core/analyticsEngine';
import { findRankedSubstitutes } from '../core/substituteFinder';
import { DAYS_OF_WEEK } from '../constants';
import type { 
  Batch, Constraints, Faculty, FacultyAllocation, FacultyAvailability, GeneratedTimetable, 
  GlobalConstraints, PinnedAssignment, PlannedLeave, Room, Subject, Substitution, 
  TimetableFeedback, TimetableSettings, Department, AnalyticsReport, TimetableGrid, 
  ClassAssignment 
} from '../types';


// ---------------- APP ----------------
export const app = new Hono().basePath('/api');

// Middleware
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:4173'],
  credentials: true,
}));


// ---------------- SEEDING ----------------
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

    await db.insert(schema.departments).values(departments);
    await db.insert(schema.subjects).values(subjects);
    await db.insert(schema.rooms).values(rooms);
    await db.insert(schema.globalConstraints).values(globalConstraints);
    await db.insert(schema.timetableSettings).values(timetableSettings);
    await db.insert(schema.constraints).values({ id: 1, ...constraints });
    await db.insert(schema.batches).values(batches);
    
    const facultyForInsert = faculty.map(({ userId, ...rest }) => rest);
    await db.insert(schema.faculty).values(facultyForInsert);
    await db.insert(schema.users).values(users);
    
    for (const f of faculty) {
      if (f.userId) {
        await db.update(schema.faculty)
          .set({ userId: f.userId })
          .where(eq(schema.faculty.id, f.id));
      }
    }

    if (facultyAllocations.length > 0) await db.insert(schema.facultyAllocations).values(facultyAllocations);

    console.log('[db:seed] Seeding complete.');
  } catch (error) {
    console.error('[db:seed] Error seeding database:', error);
    throw error;
  }
};


// ---------------- ERROR HANDLER ----------------
app.onError((err, c) => {
  console.error(`${c.req.method} ${c.req.url}`, err);
  return c.json({ message: err.message || 'An internal server error occurred' }, 500);
});


// ---------------- HELPERS ----------------
const createIdFromName = (name: string, prefix = ''): string => {
  const sanitized = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return prefix ? `${prefix}_${sanitized}` : sanitized;
};


// ---------------- ROUTES ----------------
// --- Auth ---
app.post('/login', async (c) => {
  const { email } = await c.req.json();
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user) return c.json({ message: 'User not found' }, 404);
  return c.json(user);
});

// --- Data Getters ---
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

// --- CRUD helpers ---
const createCrudEndpoints = (
  path: string, 
  table: typeof schema.subjects | typeof schema.rooms | typeof schema.users
) => {
  app.post(`/${path}`, async (c) => {
    const item = await c.req.json();
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

// --- Faculty CRUD (with auto user creation) ---
app.post('/faculty', async (c) => {
  const facultyData: Faculty = await c.req.json();
  const existing = await db.query.faculty.findFirst({ where: eq(schema.faculty.id, facultyData.id) });

  if (existing) {
    const [updatedFaculty] = await db.update(schema.faculty).set(facultyData).where(eq(schema.faculty.id, facultyData.id)).returning();
    if (existing.userId && facultyData.name !== existing.name) {
      await db.update(schema.users).set({ name: facultyData.name }).where(eq(schema.users.id, existing.userId));
    }
    return c.json(updatedFaculty);
  } else {
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

// --- Department CRUD (with HOD creation) ---
app.post('/departments', async (c) => {
  const deptData: Department = await c.req.json();
  const existing = await db.query.departments.findFirst({ where: eq(schema.departments.id, deptData.id) });

  if (existing) {
    const [updatedDept] = await db.update(schema.departments).set(deptData).where(eq(schema.departments.id, deptData.id)).returning();
    if (deptData.name !== existing.name) {
      const userToUpdate = await db.query.users.findFirst({ where: eq(schema.users.departmentId, existing.id) });
      if (userToUpdate) {
        await db.update(schema.users).set({ name: `${deptData.name} Head` }).where(eq(schema.users.id, userToUpdate.id));
      }
    }
    return c.json(updatedDept);
  } else {
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
    return c.json({ message: 'Cannot delete department with associated batches.' }, 400);
  }
  await db.delete(schema.users).where(eq(schema.users.departmentId, id));
  await db.delete(schema.departments).where(eq(schema.departments.id, id));
  return c.json({ success: true });
});

// --- Batch CRUD (with Student Rep) ---
app.post('/batches', async (c) => {
  const { allocations, ...batchData }: Batch & { allocations?: Record<string, string[]> } = await c.req.json();
  
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

  if (allocations) {
    await db.delete(schema.facultyAllocations).where(eq(schema.facultyAllocations.batchId, batchData.id));
    const newAllocations = Object.entries(allocations).map(([subjectId, facultyIds]) => ({
      id: `fa_${batchData.id}_${subjectId}`,
      batchId: batchData.id,
      subjectId,
      facultyIds: Array.isArray(facultyIds) ? facultyIds : [facultyIds],
    })).filter(a => a.facultyIds.length > 0 && a.facultyIds[0] !== '');
    if (newAllocations.length > 0) await db.insert(schema.facultyAllocations).values(newAllocations);
  }

  return c.json(batchData);
});
app.delete('/batches/:id', async (c) => {
  const { id } = c.req.param();
  await db.delete(schema.facultyAllocations).where(eq(schema.facultyAllocations.batchId, id));
  await db.delete(schema.users).where(eq(schema.users.batchId, id));
  await db.delete(schema.batches).where(eq(schema.batches.id, id));
  return c.json({ success: true });
});

// --- Timetable management ---
app.post('/timetables', async (c) => {
  const timetable: GeneratedTimetable = await c.req.json();
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
  const timetableForDb = { ...timetable, createdAt: new Date(timetable.createdAt) };
  const existing = await db.query.timetables.findFirst({ where: eq(schema.timetables.id, timetableForDb.id) });
  if (existing) {
    await db.update(schema.timetables).set(timetableForDb).where(eq(schema.timetables.id, timetableForDb.id));
  } else {
    await db.insert(schema.timetables).values(timetableForDb);
  }
  return c.json(timetable);
});

app.delete('/timetables/:id', async (c) => {
  const { id } = c.req.param();
  const existing = await db.query.timetables.findFirst({ where: eq(schema.timetables.id, id) });
  if (!existing) return c.json({ message: 'Timetable not found' }, 404);
  await db.delete(schema.feedback).where(eq(schema.feedback.timetableId, id));
  await db.delete(schema.timetables).where(eq(schema.timetables.id, id));
  return c.json({ success: true });
});

app.post('/timetables/feedback', async (c) => {
  const feedbackData: Omit<TimetableFeedback, 'id' | 'createdAt'> = await c.req.json();
  const newFeedback = { ...feedbackData, id: `fb_${Date.now()}` };
  const [result] = await db.insert(schema.feedback).values(newFeedback).returning();
  return c.json(result, 201);
});

// --- Constraints ---
app.post('/constraints/pinned', async (c) => {
  const item: PinnedAssignment = await c.req.json();
  const current = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
  const updatedList = current.pinnedAssignments || [];
  const index = updatedList.findIndex(i => i.id === item.id);
  if (index > -1) updatedList[index] = item; else updatedList.push(item);
  await db.update(schema.constraints).set({ pinnedAssignments: updatedList }).where(eq(schema.constraints.id, 1));
  return c.json(item);
});
app.delete('/constraints/pinned/:id', async (c) => {
  const { id } = c.req.param();
  const current = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
  const updatedList = (current.pinnedAssignments || []).filter(i => i.id !== id);
  await db.update(schema.constraints).set({ pinnedAssignments: updatedList }).where(eq(schema.constraints.id, 1));
  return c.json({ success: true });
});

// Leaves
app.post('/constraints/leaves', async (c) => {
  const item: PlannedLeave = await c.req.json();
  const current = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
  const updatedList = current.plannedLeaves || [];
  const index = updatedList.findIndex(i => i.id === item.id);
  if (index > -1) updatedList[index] = item; else updatedList.push(item);
  await db.update(schema.constraints).set({ plannedLeaves: updatedList }).where(eq(schema.constraints.id, 1));
  return c.json(item);
});
app.delete('/constraints/leaves/:id', async (c) => {
  const { id } = c.req.param();
  const current = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
  const updatedList = (current.plannedLeaves || []).filter(i => i.id !== id);
  await db.update(schema.constraints).set({ plannedLeaves: updatedList }).where(eq(schema.constraints.id, 1));
  return c.json({ success: true });
});

// Availability
app.post('/constraints/availability', async (c) => {
  const availability: FacultyAvailability = await c.req.json();
  const current = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
  const availabilities = current.facultyAvailability || [];
  const index = availabilities.findIndex(i => i.facultyId === availability.facultyId);
  if (index > -1) availabilities[index] = availability; else availabilities.push(availability);
  await db.update(schema.constraints).set({ facultyAvailability: availabilities }).where(eq(schema.constraints.id, 1));
  return c.json(availability);
});

// Substitutions
app.post('/substitutes/find', async (c) => {
  const { assignmentId, currentTimetableGrid } = await c.req.json();
  if (!currentTimetableGrid) return c.json({ message: "Current timetable grid is required." }, 400);

  const assignmentsInCurrentGrid: ClassAssignment[] = Object.values(currentTimetableGrid as TimetableGrid).flatMap(batchGrid =>
    Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
  );
  const targetAssignment = assignmentsInCurrentGrid.find(a => a.id === assignmentId);
  if (!targetAssignment) return c.json({ message: "Target assignment not found in timetable." }, 404);

  const allFaculty = await db.query.faculty.findMany();
  const constraints = await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) });
  const substitutes = await findRankedSubstitutes(targetAssignment, allFaculty, assignmentsInCurrentGrid, constraints);
  return c.json(substitutes);
});

app.post('/constraints/substitutions', async (c) => {
  const substitution: Substitution = await c.req.json();
  const current = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
  const updatedSubs = current.substitutions || [];
  const index = updatedSubs.findIndex(s => s.id === substitution.id);
  if (index > -1) updatedSubs[index] = substitution; else updatedSubs.push(substitution);
  await db.update(schema.constraints).set({ substitutions: updatedSubs }).where(eq(schema.constraints.id, 1));
  return c.json(substitution);
});

// --- Scheduler ---
app.post('/scheduler/preflight', async (c) => {
  const diagnostics = await runPreflightDiagnostics(db);
  return c.json(diagnostics);
});
app.post('/scheduler/optimize', async (c) => {
  const { constraints, faculty, subjects, batches, rooms, settings, optimizationParams } = await c.req.json();
  const timetable = await runOptimization(db, constraints, faculty, subjects, batches, rooms, settings, optimizationParams);
  return c.json(timetable);
});
app.post('/scheduler/nl-command', async (c) => {
  const { command, currentTimetable } = await c.req.json();
  const constraints = await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) });
  const faculty = await db.query.faculty.findMany();
  const subjects = await db.query.subjects.findMany();
  const batches = await db.query.batches.findMany();
  const rooms = await db.query.rooms.findMany();
  const settings = await db.query.timetableSettings.findFirst();
  const result = await applyNaturalLanguageCommand(command, currentTimetable, { constraints, faculty, subjects, batches, rooms, settings });
  return c.json(result);
});

// --- Analytics ---
app.post('/analytics/report', async (c) => {
  const { timetable } = await c.req.json();
  const constraints = await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) });
  const faculty = await db.query.faculty.findMany();
  const subjects = await db.query.subjects.findMany();
  const batches = await db.query.batches.findMany();
  const rooms = await db.query.rooms.findMany();
  const settings = await db.query.timetableSettings.findFirst();
  const report: AnalyticsReport = await generateAnalyticsReport(timetable, { constraints, faculty, subjects, batches, rooms, settings });
  return c.json(report);
});
app.post('/analytics/compare', async (c) => {
  const { timetableA, timetableB } = await c.req.json();
  const comparison = await compareTimetablesWithGemini(timetableA, timetableB);
  return c.json(comparison);
});

// --- System Reset ---
app.post('/system/reset-db', async (c) => {
  await db.delete(schema.timetables);
  await db.delete(schema.facultyAllocations);
  await db.delete(schema.batches);
  await db.delete(schema.faculty);
  await db.delete(schema.users);
  await db.delete(schema.subjects);
  await db.delete(schema.rooms);
  await db.delete(schema.departments);
  await db.delete(schema.constraints);
  await db.delete(schema.globalConstraints);
  await db.delete(schema.timetableSettings);
  await db.delete(schema.feedback);
  await seedDatabaseIfEmpty();
  return c.json({ message: 'Database reset complete.' });
});

// --- Import full dataset ---
app.post('/data/import', async (c) => {
  const data = await c.req.json();
  await db.delete(schema.timetables);
  await db.delete(schema.facultyAllocations);
  await db.delete(schema.batches);
  await db.delete(schema.faculty);
  await db.delete(schema.users);
  await db.delete(schema.subjects);
  await db.delete(schema.rooms);
  await db.delete(schema.departments);
  await db.delete(schema.constraints);
  await db.delete(schema.globalConstraints);
  await db.delete(schema.timetableSettings);
  await db.delete(schema.feedback);

  if (data.departments?.length) await db.insert(schema.departments).values(data.departments);
  if (data.subjects?.length) await db.insert(schema.subjects).values(data.subjects);
  if (data.rooms?.length) await db.insert(schema.rooms).values(data.rooms);
  if (data.globalConstraints) await db.insert(schema.globalConstraints).values(data.globalConstraints);
  if (data.timetableSettings) await db.insert(schema.timetableSettings).values(data.timetableSettings);
  if (data.constraints) await db.insert(schema.constraints).values({ id: 1, ...data.constraints });
  if (data.batches?.length) await db.insert(schema.batches).values(data.batches);
  if (data.faculty?.length) {
    const facultyForInsert = data.faculty.map((f: any) => ({ ...f, userId: f.userId || null }));
    await db.insert(schema.faculty).values(facultyForInsert);
  }
  if (data.users?.length) await db.insert(schema.users).values(data.users);
  if (data.facultyAllocations?.length) await db.insert(schema.facultyAllocations).values(data.facultyAllocations);
  if (data.timetables?.length) await db.insert(schema.timetables).values(data.timetables);
  if (data.feedback?.length) await db.insert(schema.feedback).values(data.feedback);

  return c.json({ message: 'Data import complete.' });
});


// ---------------- SERVER START ----------------
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const bootstrap = async () => {
  await seedDatabaseIfEmpty();
  console.log(`[server] Running at http://localhost:${port}`);
  serve({ fetch: app.fetch, port });
};
bootstrap();

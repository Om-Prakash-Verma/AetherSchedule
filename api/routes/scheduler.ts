import { Hono } from 'hono';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { runOptimization, runPreflightDiagnostics, applyNaturalLanguageCommand } from '../../core/schedulerEngine';
import { compareTimetablesWithGemini } from '../../core/analyticsEngine';
import { DAYS_OF_WEEK } from '../../constants';
import type { Batch, Constraints, Faculty, FacultyAllocation, GeneratedTimetable, GlobalConstraints, Room, Subject, TimetableSettings } from '../../types';

export const schedulerRoutes = new Hono();

schedulerRoutes.post('/', async (c) => {
    const { batchIds, baseTimetable } = await c.req.json();
    
    const batchesForScheduler: Batch[] = await db.query.batches.findMany({ where: inArray(schema.batches.id, batchIds) }) as unknown as Batch[];
    const allSubjects: Subject[] = await db.query.subjects.findMany() as unknown as Subject[];
    const allFaculty: Faculty[] = await db.query.faculty.findMany() as unknown as Faculty[];
    const allRooms: Room[] = await db.query.rooms.findMany() as unknown as Room[];
    const approvedTimetables: GeneratedTimetable[] = await db.query.timetables.findMany({ where: eq(schema.timetables.status, 'Approved') }) as unknown as GeneratedTimetable[];
    const constraints: Constraints = (await db.query.constraints.findFirst())! as unknown as Constraints;
    const facultyAllocations: FacultyAllocation[] = await db.query.facultyAllocations.findMany() as unknown as FacultyAllocation[];
    const globalConstraints: GlobalConstraints = (await db.query.globalConstraints.findFirst())! as unknown as GlobalConstraints;
    const timetableSettings: TimetableSettings = (await db.query.timetableSettings.findFirst())! as unknown as TimetableSettings;

    const workingDaysStrings = (timetableSettings.workingDays || [0,1,2,3,4,5]).map(i => DAYS_OF_WEEK[i]);

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
        days: workingDaysStrings,
        workingDaysIndices: timetableSettings.workingDays || [0,1,2,3,4,5],
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

schedulerRoutes.post('/diagnostics', async (c) => {
    const { batchIds } = await c.req.json();

    const batchesForDiagnostics: Batch[] = await db.query.batches.findMany({ where: inArray(schema.batches.id, batchIds) }) as unknown as Batch[];
    const allSubjects: Subject[] = await db.query.subjects.findMany() as unknown as Subject[];
    const allFaculty: Faculty[] = await db.query.faculty.findMany() as unknown as Faculty[];
    const allRooms: Room[] = await db.query.rooms.findMany() as unknown as Room[];
    const facultyAllocations: FacultyAllocation[] = await db.query.facultyAllocations.findMany() as unknown as FacultyAllocation[];

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

schedulerRoutes.post('/nlc', async (c) => {
    const { timetable, command } = await c.req.json();
    
    const allSubjects: Subject[] = await db.query.subjects.findMany() as unknown as Subject[];
    const allFaculty: Faculty[] = await db.query.faculty.findMany() as unknown as Faculty[];
    const allBatches: Batch[] = await db.query.batches.findMany() as unknown as Batch[];
    const settings: TimetableSettings = (await db.query.timetableSettings.findFirst())! as unknown as TimetableSettings;

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

schedulerRoutes.post('/compare', async (c) => {
    const { candidate1, candidate2 } = await c.req.json();
    const analysis = await compareTimetablesWithGemini(candidate1, candidate2);
    return c.json({ analysis });
});

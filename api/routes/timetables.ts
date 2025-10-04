import { Hono } from 'hono';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { generateAnalyticsReport } from '../../core/analyticsEngine';
import type { Batch, GeneratedTimetable, Room, Subject, TimetableFeedback, TimetableSettings, AnalyticsReport, Faculty } from '../../types';

export const timetableRoutes = new Hono();

// --- TIMETABLE MANAGEMENT ---

timetableRoutes.get('/timetables', async (c) => c.json(await db.query.timetables.findMany()));

timetableRoutes.post('/timetables', async (c) => {
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
    
    const timetableForDb = {
        ...timetable,
        createdAt: new Date(timetable.createdAt),
    };

    const existing = await db.query.timetables.findFirst({ where: eq(schema.timetables.id, timetableForDb.id) });
    if (existing) {
        await db.update(schema.timetables).set(timetableForDb).where(eq(schema.timetables.id, timetableForDb.id));
    } else {
        await db.insert(schema.timetables).values(timetableForDb);
    }

    return c.json(timetable);
});

timetableRoutes.delete('/timetables/:id', async (c) => {
    const { id } = c.req.param();
    const existing = await db.query.timetables.findFirst({ where: eq(schema.timetables.id, id) });
    if (!existing) {
        return c.json({ message: 'Timetable not found' }, 404);
    }

    await db.delete(schema.feedback).where(eq(schema.feedback.timetableId, id));
    await db.delete(schema.timetables).where(eq(schema.timetables.id, id));
    
    return c.json({ success: true });
});

timetableRoutes.post('/timetables/feedback', async (c) => {
    const feedbackData: Omit<TimetableFeedback, 'id' | 'createdAt'> = await c.req.json();
    const newFeedback = {
        ...feedbackData,
        id: `fb_${Date.now()}`
    };
    const [result] = await db.insert(schema.feedback).values(newFeedback).returning();
    return c.json(result, 201);
});


// --- ANALYTICS ---
timetableRoutes.get('/analytics/report/:id', async (c) => {
    const { id } = c.req.param();
    const timetable = await db.query.timetables.findFirst({ where: eq(schema.timetables.id, id) });
    if (!timetable) return c.json({ message: 'Timetable not found' }, 404);

    const allSubjects: Subject[] = await db.query.subjects.findMany() as unknown as Subject[];
    const allFaculty: Faculty[] = await db.query.faculty.findMany() as unknown as Faculty[];
    const allRooms: Room[] = await db.query.rooms.findMany() as unknown as Room[];
    const allBatches: Batch[] = await db.query.batches.findMany() as unknown as Batch[];
    const settings: TimetableSettings = (await db.query.timetableSettings.findFirst())! as unknown as TimetableSettings;

    const report = generateAnalyticsReport(
        timetable as unknown as GeneratedTimetable,
        allSubjects,
        allFaculty,
        allRooms,
        allBatches,
        settings
    );
    
    const analyticsReport = report as unknown as AnalyticsReport;
    await db.update(schema.timetables).set({ analytics: analyticsReport }).where(eq(schema.timetables.id, id));
    return c.json(report);
});

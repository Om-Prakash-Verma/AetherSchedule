import { Hono } from 'hono';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { GlobalConstraints, TimetableSettings } from '../../types';

export const settingsRoutes = new Hono();

settingsRoutes.get('/', async (c) => {
    const globalConstraints = await db.query.globalConstraints.findFirst({ where: eq(schema.globalConstraints.id, 1) });
    const timetableSettings = await db.query.timetableSettings.findFirst({ where: eq(schema.timetableSettings.id, 1) });
    return c.json({ globalConstraints, timetableSettings });
});

settingsRoutes.post('/global', async (c) => {
    const newGlobalConstraints: GlobalConstraints = await c.req.json();
    await db.update(schema.globalConstraints).set(newGlobalConstraints).where(eq(schema.globalConstraints.id, 1));
    return c.json(newGlobalConstraints);
});

settingsRoutes.post('/timetable', async (c) => {
    const newTimetableSettings: TimetableSettings = await c.req.json();
    await db.update(schema.timetableSettings).set(newTimetableSettings).where(eq(schema.timetableSettings.id, 1));
    return c.json(newTimetableSettings);
});

import { Hono } from 'hono';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { sql, inArray } from 'drizzle-orm';

export const systemRoutes = new Hono();

systemRoutes.post('/reset-db', async (c) => {
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

systemRoutes.post('/data/import', async (c) => {
    const data = await c.req.json();
    console.log('[db:import] Importing data...');
    
    if (!data.subjects || !data.faculty || !data.rooms || !data.batches || !data.departments) {
        return c.json({ message: "Import failed: Missing one or more required data types." }, 400);
    }
    
    await db.update(schema.users).set({ facultyId: null }).where(inArray(schema.users.role, ['Faculty']));
    await db.update(schema.faculty).set({ userId: null });

    await db.delete(schema.facultyAllocations);
    await db.delete(schema.users).where(inArray(schema.users.role, ['Faculty', 'Student']));
    await db.delete(schema.batches);
    await db.delete(schema.faculty);
    await db.delete(schema.subjects);
    await db.delete(schema.rooms);
    await db.delete(schema.departments);
    
    if(data.departments.length > 0) await db.insert(schema.departments).values(data.departments);
    if(data.subjects.length > 0) await db.insert(schema.subjects).values(data.subjects);
    if(data.faculty.length > 0) await db.insert(schema.faculty).values(data.faculty);
    if(data.rooms.length > 0) await db.insert(schema.rooms).values(data.rooms);
    if(data.batches.length > 0) await db.insert(schema.batches).values(data.batches);

    return c.json({ success: true, message: "Data imported successfully." });
});

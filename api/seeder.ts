import { db } from '../db';
import * as schema from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { initialData } from './seedData';

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

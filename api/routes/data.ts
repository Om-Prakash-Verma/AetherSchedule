import { Hono } from 'hono';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';
// FIX: Import missing 'Subject' and 'Room' types.
import type { Faculty, Department, Batch, User, Subject, Room } from '../../types';

export const dataRoutes = new Hono();

// --- HELPERS ---
const createIdFromName = (name: string, prefix = ''): string => {
    const sanitized = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return prefix ? `${prefix}_${sanitized}` : sanitized;
};


// --- DATA GETTERS ---
dataRoutes.get('/subjects', async (c) => c.json(await db.query.subjects.findMany() as unknown as Subject[]));
dataRoutes.get('/faculty', async (c) => c.json(await db.query.faculty.findMany() as unknown as Faculty[]));
dataRoutes.get('/rooms', async (c) => c.json(await db.query.rooms.findMany() as unknown as Room[]));
dataRoutes.get('/departments', async (c) => c.json(await db.query.departments.findMany() as unknown as Department[]));
dataRoutes.get('/batches', async (c) => c.json(await db.query.batches.findMany() as unknown as Batch[]));
dataRoutes.get('/users', async (c) => c.json(await db.query.users.findMany() as unknown as User[]));
dataRoutes.get('/faculty-allocations', async (c) => c.json(await db.query.facultyAllocations.findMany()));


// --- GENERIC CRUD ---
const createCrudEndpoints = (
    path: 'subjects' | 'rooms' | 'users', 
    table: typeof schema.subjects | typeof schema.rooms | typeof schema.users
) => {
    const router = new Hono();
    router.post('/', async (c) => {
        const item = await c.req.json();
        const existing = await (db.query as any)[path].findFirst({ where: eq(table.id, item.id) });
        if (existing) {
            const [updatedItem] = await db.update(table).set(item).where(eq(table.id, item.id)).returning() as any[];
            return c.json(updatedItem);
        } else {
            const [newItem] = await db.insert(table).values(item).returning() as any[];
            return c.json(newItem, 201);
        }
    });
    router.delete('/:id', async (c) => {
        const { id } = c.req.param();
        await db.delete(table).where(eq(table.id, id));
        return c.json({ success: true });
    });
    return router;
};

dataRoutes.route('/subjects', createCrudEndpoints('subjects', schema.subjects));
dataRoutes.route('/rooms', createCrudEndpoints('rooms', schema.rooms));
dataRoutes.route('/users', createCrudEndpoints('users', schema.users));


// --- CUSTOM CRUD ---

// Custom CRUD for Faculty with automatic user creation
dataRoutes.post('/faculty', async (c) => {
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

dataRoutes.delete('/faculty/:id', async (c) => {
    const { id } = c.req.param();
    await db.delete(schema.users).where(eq(schema.users.facultyId, id));
    await db.delete(schema.faculty).where(eq(schema.faculty.id, id));
    return c.json({ success: true });
});

// Custom CRUD for Departments with automatic HOD user creation
dataRoutes.post('/departments', async (c) => {
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

dataRoutes.delete('/departments/:id', async (c) => {
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
dataRoutes.post('/batches', async (c) => {
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

        if (newAllocations.length > 0) {
            await db.insert(schema.facultyAllocations).values(newAllocations);
        }
    }

    return c.json(batchData);
});
dataRoutes.delete('/batches/:id', async (c) => {
    const { id } = c.req.param();
    await db.delete(schema.facultyAllocations).where(eq(schema.facultyAllocations.batchId, id));
    await db.delete(schema.users).where(eq(schema.users.batchId, id));
    await db.delete(schema.batches).where(eq(schema.batches.id, id));
    return c.json({ success: true });
});
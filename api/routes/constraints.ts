import { Hono } from 'hono';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';
import { findRankedSubstitutes } from '../../core/substituteFinder';
import type { Batch, Constraints, Faculty, FacultyAllocation, FacultyAvailability, GeneratedTimetable, PinnedAssignment, PlannedLeave, Room, Subject, Substitution, ClassAssignment, TimetableGrid } from '../../types';

export const constraintRoutes = new Hono();

// --- CONSTRAINTS ---

constraintRoutes.get('/constraints', async (c) => {
    const result = await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) });
    return c.json(result || { pinnedAssignments: [], plannedLeaves: [], facultyAvailability: [], substitutions: [] });
});

constraintRoutes.post('/constraints/pinned', async (c) => {
    const item: PinnedAssignment = await c.req.json();
    const currentConstraints: Partial<Constraints> = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
    const updatedList = currentConstraints.pinnedAssignments || [];
    const index = updatedList.findIndex(i => i.id === item.id);
     if (index > -1) updatedList[index] = item; else updatedList.push(item);
    await db.update(schema.constraints).set({ pinnedAssignments: updatedList }).where(eq(schema.constraints.id, 1));
    return c.json(item);
});
constraintRoutes.delete('/constraints/pinned/:id', async (c) => {
    const { id } = c.req.param();
    const currentConstraints: Partial<Constraints> = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
    const updatedList = (currentConstraints.pinnedAssignments || []).filter(i => i.id !== id);
    await db.update(schema.constraints).set({ pinnedAssignments: updatedList }).where(eq(schema.constraints.id, 1));
    return c.json({ success: true });
});

constraintRoutes.post('/constraints/leaves', async (c) => {
    const item: PlannedLeave = await c.req.json();
    const currentConstraints: Partial<Constraints> = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
    const updatedList = currentConstraints.plannedLeaves || [];
    const index = updatedList.findIndex(i => i.id === item.id);
     if (index > -1) updatedList[index] = item; else updatedList.push(item);
    await db.update(schema.constraints).set({ plannedLeaves: updatedList }).where(eq(schema.constraints.id, 1));
    return c.json(item);
});
constraintRoutes.delete('/constraints/leaves/:id', async (c) => {
    const { id } = c.req.param();
    const currentConstraints: Partial<Constraints> = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
    const updatedList = (currentConstraints.plannedLeaves || []).filter(i => i.id !== id);
    await db.update(schema.constraints).set({ plannedLeaves: updatedList }).where(eq(schema.constraints.id, 1));
    return c.json({ success: true });
});

constraintRoutes.post('/constraints/availability', async (c) => {
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

// --- SUBSTITUTIONS ---

constraintRoutes.post('/substitutes/find', async (c) => {
    const { assignmentId, currentTimetableGrid } = await c.req.json();

    if (!currentTimetableGrid) {
        return c.json({ message: "Current timetable grid is required." }, 400);
    }

    const assignmentsInCurrentGrid: ClassAssignment[] = Object.values(currentTimetableGrid as TimetableGrid).flatMap(batchGrid =>
        Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
    );

    const targetAssignment = assignmentsInCurrentGrid.find(a => a.id === assignmentId);
    if (!targetAssignment) return c.json({ message: "Target assignment not found in the provided timetable." }, 404);

    const allApprovedTimetables: GeneratedTimetable[] = await db.query.timetables.findMany({ 
        where: eq(schema.timetables.status, 'Approved') 
    }) as unknown as GeneratedTimetable[];

    const allApprovedAssignments = allApprovedTimetables.flatMap(tt => 
        Object.values(tt.timetable).flatMap(batchGrid => 
            Object.values(batchGrid).flatMap(daySlots => Object.values(daySlots))
        )
    );

    const allFaculty: Faculty[] = await db.query.faculty.findMany() as unknown as Faculty[];
    const allSubjects: Subject[] = await db.query.subjects.findMany() as unknown as Subject[];
    const allBatches: Batch[] = await db.query.batches.findMany() as unknown as Batch[];
    const allFacultyAllocations: FacultyAllocation[] = await db.query.facultyAllocations.findMany() as unknown as FacultyAllocation[];
    const constraintsData: Partial<Constraints> = (await db.query.constraints.findFirst()) as unknown as Partial<Constraints> || {};
    
    const rankedSubstitutes = await findRankedSubstitutes(
        targetAssignment, 
        allFaculty, 
        allSubjects, 
        allApprovedAssignments,
        constraintsData.facultyAvailability || [], 
        allFacultyAllocations, 
        allBatches
    );
    return c.json(rankedSubstitutes);
});

constraintRoutes.post('/substitutes', async (c) => {
    const substitution: Substitution = await c.req.json();
    const currentConstraints: Partial<Constraints> = (await db.query.constraints.findFirst({ where: eq(schema.constraints.id, 1) })) || {};
    const substitutions = currentConstraints.substitutions || [];
    substitutions.push(substitution);
    await db.update(schema.constraints).set({ substitutions }).where(eq(schema.constraints.id, 1));
    return c.json(substitution, 201);
});

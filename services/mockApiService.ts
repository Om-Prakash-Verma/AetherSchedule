// This file provides a mock API service that can be used for frontend development without a running backend.
// It simulates the API by managing an in-memory copy of the application's data using localStorage.

import type { User, Subject, Faculty, Room, Batch, Department, PinnedAssignment, PlannedLeave, FacultyAvailability, GeneratedTimetable, GlobalConstraints, TimetableGrid, TimetableSettings, FacultyAllocation } from '../types';
import { runOptimization } from '../core/schedulerEngine';
// FIX: Removed TIME_SLOTS import as it's no longer a constant and is generated from settings.
import { DAYS_OF_WEEK } from '../constants';
import { initialData } from '../api/seedData';

const DB_KEY = 'aether_schedule_db';

const getDb = () => {
    const dbString = localStorage.getItem(DB_KEY);
    if (dbString) {
        return JSON.parse(dbString);
    }
    const initialDb = JSON.parse(JSON.stringify(initialData));
    localStorage.setItem(DB_KEY, JSON.stringify(initialDb));
    return initialDb;
};

const saveDb = (db: any) => {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const mockLogin = async (email: string): Promise<User> => {
    await delay(300);
    const db = getDb();
    const user = db.users.find((u: User) => u.email === email);
    if (user) return user;
    throw new Error('User not found');
};

export const getAllData = async () => {
    await delay(500);
    return getDb();
};

export const runScheduler = async (batchIds: string[]): Promise<GeneratedTimetable[]> => {
    await delay(1500);
    const db = getDb();
    const selectedBatches = db.batches.filter((b: Batch) => batchIds.includes(b.id));
    if (selectedBatches.length !== batchIds.length) throw new Error("One or more batches not found");

    const approvedTimetables = db.generatedTimetables.filter((tt: GeneratedTimetable) => tt.status === 'Approved');

    const candidates = await runOptimization({
      batches: selectedBatches,
      allSubjects: db.subjects, 
      allFaculty: db.faculty, 
      allRooms: db.rooms,
      approvedTimetables,
      // FIX: Pass the entire constraints object from the mock DB to satisfy the `Constraints` type.
      // This also corrects the invalid property access (e.g., `db.pinnedAssignments`).
      constraints: db.constraints,
      // FIX: Add missing facultyAllocations property to satisfy the SchedulerInput type.
      facultyAllocations: db.facultyAllocations,
      globalConstraints: db.globalConstraints,
      days: DAYS_OF_WEEK, 
      // FIX: The scheduler engine now expects timetableSettings, not a static slots array.
      timetableSettings: db.timetableSettings,
      candidateCount: 5,
    });
  
    const results: GeneratedTimetable[] = candidates.map((candidate, index) => ({
      id: `tt_cand_${batchIds.join('_')}_${Date.now()}_${index}`,
      batchIds, 
      version: 1, 
      status: 'Draft', 
      comments: [],
      createdAt: new Date().toISOString(),
      metrics: candidate.metrics, 
      timetable: candidate.timetable,
    }));
    
    return results;
};

const createCrud = <T extends { id: string }>(store: keyof ReturnType<typeof getDb>) => ({
    save: async (item: T): Promise<T> => {
        await delay(200);
        const db = getDb();
        const items = db[store] as T[];
        const index = items.findIndex(i => i.id === item.id);
        if (index > -1) {
            items[index] = item;
        } else {
            items.push(item);
        }
        saveDb(db);
        return item;
    },
    delete: async (id: string): Promise<void> => {
        await delay(200);
        const db = getDb();
        db[store] = (db[store] as T[]).filter(i => i.id !== id);
        saveDb(db);
    },
});

export const { save: saveSubject, delete: deleteSubject } = createCrud<Subject>('subjects');
export const { save: saveFaculty, delete: deleteFaculty } = createCrud<Faculty>('faculty');
export const { save: saveRoom, delete: deleteRoom } = createCrud<Room>('rooms');
export const { save: saveBatch, delete: deleteBatch } = createCrud<Batch>('batches');
export const { save: saveDepartment, delete: deleteDepartment } = createCrud<Department>('departments');
export const { save: saveUser, delete: deleteUser } = createCrud<User>('users');
export const { save: savePinnedAssignment, delete: deletePinnedAssignment } = createCrud<PinnedAssignment>('pinnedAssignments');
export const { save: savePlannedLeave, delete: deletePlannedLeave } = createCrud<PlannedLeave>('plannedLeaves');


export const saveTimetable = async (timetable: GeneratedTimetable): Promise<GeneratedTimetable> => {
    const db = getDb();
     if (timetable.status === 'Approved') {
        db.generatedTimetables.forEach((tt: GeneratedTimetable) => {
            if (tt.batchIds.some(bId => timetable.batchIds.includes(bId)) && tt.status === 'Approved') {
                tt.status = 'Archived';
            }
        });
    }
    const index = db.generatedTimetables.findIndex((t: GeneratedTimetable) => t.id === timetable.id);
    if (index > -1) {
        db.generatedTimetables[index] = timetable;
    } else {
        db.generatedTimetables.push(timetable);
    }
    saveDb(db);
    return timetable;
};

export const updateTimetable = saveTimetable;

export const saveFacultyAvailability = async (data: FacultyAvailability): Promise<void> => {
    await delay(200);
    const db = getDb();
    const index = db.facultyAvailability.findIndex((fa: FacultyAvailability) => fa.facultyId === data.facultyId);
    if (index > -1) {
        db.facultyAvailability[index] = data;
    } else {
        db.facultyAvailability.push(data);
    }
    saveDb(db);
};

export const saveGlobalConstraints = async (newConstraints: GlobalConstraints): Promise<GlobalConstraints> => {
    await delay(200);
    const db = getDb();
    db.globalConstraints = newConstraints;
    saveDb(db);
    return newConstraints;
};

export const resetData = async (): Promise<{ success: boolean }> => {
    await delay(500);
    localStorage.removeItem(DB_KEY);
    getDb(); // This will re-initialize it
    return { success: true };
};
import type { User, Subject, Faculty, Room, Batch, Department, PinnedAssignment, PlannedLeave, FacultyAvailability, GeneratedTimetable, GlobalConstraints, TimetableFeedback, TimetableSettings, Constraints } from '../types';

const apiFetch = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : {};
};

// --- AUTH ---
export const login = (email: string): Promise<User> => {
    return apiFetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email }),
    });
};

// --- GRANULAR DATA FETCHING ---
export const getSubjects = (): Promise<Subject[]> => apiFetch('/api/subjects');
export const getFaculty = (): Promise<Faculty[]> => apiFetch('/api/faculty');
export const getRooms = (): Promise<Room[]> => apiFetch('/api/rooms');
export const getDepartments = (): Promise<Department[]> => apiFetch('/api/departments');
export const getBatches = (): Promise<Batch[]> => apiFetch('/api/batches');
export const getUsers = (): Promise<User[]> => apiFetch('/api/users');
export const getTimetables = (): Promise<GeneratedTimetable[]> => apiFetch('/api/timetables');
export const getConstraints = (): Promise<Constraints> => apiFetch('/api/constraints');
export const getSettings = (): Promise<{ globalConstraints: GlobalConstraints, timetableSettings: TimetableSettings}> => apiFetch('/api/settings');


// --- SCHEDULER ---
export const runScheduler = (batchIds: string[]): Promise<GeneratedTimetable[]> => {
    return apiFetch('/api/scheduler', {
        method: 'POST',
        body: JSON.stringify({ batchIds }),
    });
};

// --- TIMETABLE MANAGEMENT ---
export const saveTimetable = (timetable: GeneratedTimetable): Promise<GeneratedTimetable> => {
    return apiFetch('/api/timetables', {
        method: 'POST',
        body: JSON.stringify(timetable),
    });
};

export const updateTimetable = (updatedTimetable: GeneratedTimetable): Promise<GeneratedTimetable> => {
    return saveTimetable(updatedTimetable);
};

export const saveTimetableFeedback = (feedback: Omit<TimetableFeedback, 'id' | 'createdAt'>): Promise<TimetableFeedback> => {
    return apiFetch('/api/timetables/feedback', {
        method: 'POST',
        body: JSON.stringify(feedback),
    });
};


// --- CRUD OPERATIONS ---

const createCrudApiService = <T extends { id: string }>(path: string) => ({
    save: (item: T): Promise<T> => apiFetch(`/api/${path}`, { method: 'POST', body: JSON.stringify(item) }),
    delete: (id: string): Promise<void> => apiFetch(`/api/${path}/${id}`, { method: 'DELETE' }),
});

export const { save: saveSubject, delete: deleteSubject } = createCrudApiService<Subject>('subjects');
export const { save: saveFaculty, delete: deleteFaculty } = createCrudApiService<Faculty>('faculty');
export const { save: saveRoom, delete: deleteRoom } = createCrudApiService<Room>('rooms');
export const { save: saveBatch, delete: deleteBatch } = createCrudApiService<Batch>('batches');
export const { save: saveDepartment, delete: deleteDepartment } = createCrudApiService<Department>('departments');
export const { save: saveUser, delete: deleteUser } = createCrudApiService<User>('users');


// --- CONSTRAINTS ---
export const { save: savePinnedAssignment, delete: deletePinnedAssignment } = createCrudApiService<PinnedAssignment>('constraints/pinned');
export const { save: savePlannedLeave, delete: deletePlannedLeave } = createCrudApiService<PlannedLeave>('constraints/leaves');

export const saveFacultyAvailability = (data: FacultyAvailability): Promise<FacultyAvailability> => {
    return apiFetch('/api/constraints/availability', {
        method: 'POST',
        body: JSON.stringify(data)
    });
};

// --- SETTINGS ---
export const saveGlobalConstraints = (newGlobalConstraints: GlobalConstraints): Promise<GlobalConstraints> => {
    return apiFetch('/api/settings/global', {
        method: 'POST',
        body: JSON.stringify(newGlobalConstraints),
    });
}

export const saveTimetableSettings = (newTimetableSettings: TimetableSettings): Promise<TimetableSettings> => {
    return apiFetch('/api/settings/timetable', {
        method: 'POST',
        body: JSON.stringify(newTimetableSettings),
    });
}

export const resetData = (): Promise<{ success: boolean }> => {
    return apiFetch('/api/reset-db', {
        method: 'POST',
    });
};

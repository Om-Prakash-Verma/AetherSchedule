import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Faculty, Room, Batch, Subject, ScheduleEntry, ScheduleConflict, Department, TimetableSettings, AppData } from '../types';
import { db, auth } from '../services/firebase';
import { 
    collection, 
    onSnapshot, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    query,
    QuerySnapshot,
    DocumentData,
    orderBy
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { generateTimeSlots } from '../core/TimeUtils';

// Modular Imports
import { generateReadableId, DEFAULT_SETTINGS } from './utils';
import { detectConflicts } from './logic/conflictDetection';
import { importDataToFirebase } from './actions/importActions';
import { saveScheduleToFirebase, resetScheduleData } from './actions/scheduleActions';

interface StoreState {
  user: User | null;
  faculty: Faculty[];
  rooms: Room[];
  subjects: Subject[];
  batches: Batch[];
  departments: Department[];
  schedule: ScheduleEntry[];
  conflicts: ScheduleConflict[];
  settings: TimetableSettings;
  generatedSlots: string[]; // Computed from settings
  
  addScheduleEntry: (entry: ScheduleEntry) => Promise<void>;
  updateScheduleEntry: (entry: ScheduleEntry) => Promise<void>;
  deleteScheduleEntry: (id: string) => Promise<void>;
  
  addFaculty: (faculty: Omit<Faculty, 'id'>) => Promise<void>;
  addRoom: (room: Omit<Room, 'id'>) => Promise<void>;
  addSubject: (subject: Omit<Subject, 'id'>) => Promise<void>;
  addBatch: (batch: Omit<Batch, 'id'>) => Promise<void>;
  addDepartment: (dept: Omit<Department, 'id'>) => Promise<void>;
  
  updateFaculty: (faculty: Faculty) => Promise<void>;
  updateRoom: (room: Room) => Promise<void>;
  updateSubject: (subject: Subject) => Promise<void>;
  updateBatch: (batch: Batch) => Promise<void>;
  updateDepartment: (dept: Department) => Promise<void>;
  
  deleteFaculty: (id: string) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
  
  updateSettings: (newSettings: TimetableSettings) => Promise<void>;
  
  checkConflicts: () => void;
  resetData: () => void;
  saveGeneratedSchedule: (newSchedule: ScheduleEntry[], targetBatchId?: string) => Promise<void>;
  importData: (data: AppData) => Promise<void>;

  // Auth
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;

  loading: boolean;
}

const StoreContext = createContext<StoreState | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [settings, setSettings] = useState<TimetableSettings>(DEFAULT_SETTINGS);
  
  const [loading, setLoading] = useState(true);

  // Compute slots based on settings
  const generatedSlots = React.useMemo(() => generateTimeSlots(settings), [settings]);

  // Helper to subscribe to a collection with error handling
  const subscribe = (collectionName: string, setter: Function, ordered = false) => {
    const firestore = db;
    if (!firestore) return () => {};
    
    let q;
    if (ordered) {
        q = query(collection(firestore, collectionName), orderBy('createdAt', 'desc'));
    } else {
        q = collection(firestore, collectionName);
    }

    return onSnapshot(q, 
      (snapshot: QuerySnapshot<DocumentData>) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setter(data);
      }, 
      (error) => {
        // Suppress generic permission errors in console for public/guest users
        if (error.code !== 'permission-denied') {
            // console.warn(`Error listening to ${collectionName}:`, error.message);
        }
      }
    );
  };

  useEffect(() => {
    if (!db || !auth) {
        setLoading(false);
        return;
    }
    const firestore = db;

    let unsubFaculty: () => void;
    let unsubRooms: () => void;
    let unsubSubjects: () => void;
    let unsubBatches: () => void;
    let unsubDepartments: () => void;
    let unsubSchedule: () => void;
    let unsubSettings: () => void;

    const setupListeners = () => {
        unsubFaculty = subscribe('faculty', setFaculty);
        unsubRooms = subscribe('rooms', setRooms);
        unsubSubjects = subscribe('subjects', setSubjects);
        unsubBatches = subscribe('batches', setBatches);
        unsubDepartments = subscribe('departments', setDepartments);
        unsubSchedule = subscribe('schedule', setSchedule);
        
        // Settings listener (expecting a single doc 'config' in 'settings' collection)
        unsubSettings = onSnapshot(doc(firestore, 'settings', 'config'), (docSnap) => {
            if (docSnap.exists()) {
                // Merge with defaults to ensure robustness against partial data
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...(docSnap.data() as Partial<TimetableSettings>) } as TimetableSettings));
            }
        }, (error) => {
             // console.warn("Error fetching settings:", error.message);
        });
    };

    // Initialize listeners immediately to allow public read access
    setupListeners();

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        setLoading(false);
    });

    return () => {
        unsubAuth();
        if (unsubFaculty) unsubFaculty();
        if (unsubRooms) unsubRooms();
        if (unsubSubjects) unsubSubjects();
        if (unsubBatches) unsubBatches();
        if (unsubDepartments) unsubDepartments();
        if (unsubSchedule) unsubSchedule();
        if (unsubSettings) unsubSettings();
    };
  }, []);

  const login = async (email: string, pass: string) => {
      if (!auth) throw new Error("Auth not initialized");
      await signInWithEmailAndPassword(auth, email, pass);
  };

  const logout = async () => {
      if (!auth) return;
      await signOut(auth);
  };

  // --- Logic Wrappers ---

  const checkConflicts = () => {
      const newConflicts = detectConflicts(schedule, faculty, rooms, batches);
      setConflicts(newConflicts);
  };

  useEffect(() => {
    checkConflicts();
  }, [schedule, faculty, rooms, batches]);


  const saveGeneratedSchedule = async (newSchedule: ScheduleEntry[], targetBatchId?: string) => {
      await saveScheduleToFirebase(db, newSchedule, targetBatchId, setSchedule, setLoading);
  };

  const resetData = async () => {
      await resetScheduleData(db, setSchedule, setLoading);
  };

  const importData = async (data: AppData) => {
      const setters = {
          setFaculty, setRooms, setSubjects, setBatches, setDepartments, setSchedule, setSettings, setLoading
      };
      await importDataToFirebase(db, data, setters);
  };


  // --- CRUD Operations Helpers ---

  // Generic helper to add data with explicit ID
  const addToCollection = async <T extends { id: string }>(
      collectionName: string, 
      id: string,
      data: Omit<T, 'id'>, 
      setter: React.Dispatch<React.SetStateAction<T[]>>
  ) => {
      const newItem = { ...data, id } as T;
      
      // Optimistic update
      setter(prev => [...prev, newItem]);

      if (db) {
          try {
              await setDoc(doc(db, collectionName, id), newItem);
          } catch (e) {
              // Fail silently or handle error in UI notification system
          }
      }
  };

  // Generic helper to update data
  const updateInCollection = async <T extends { id: string }>(
      collectionName: string, 
      item: T, 
      setter: React.Dispatch<React.SetStateAction<T[]>>
  ) => {
      // Optimistic update
      setter(prev => prev.map(existing => existing.id === item.id ? item : existing));
      
      if (db) {
          try {
              const { id, ...data } = item;
              await updateDoc(doc(db, collectionName, id), data as any);
          } catch (e) {
              // Fail silently
          }
      }
  };

  // Generic helper to delete data
  const deleteFromCollection = async <T extends { id: string }>(
      collectionName: string, 
      id: string, 
      setter: React.Dispatch<React.SetStateAction<T[]>>
  ) => {
      // Optimistic update
      setter(prev => prev.filter(item => item.id !== id));
      
      if (db) {
          try {
              await deleteDoc(doc(db, collectionName, id));
          } catch (e) {
             // Fail silently
          }
      }
  };

  // Update Settings
  const updateSettings = async (newSettings: TimetableSettings) => {
      setSettings(newSettings);
      if (db) {
          try {
              await setDoc(doc(db, 'settings', 'config'), newSettings);
          } catch (e) {
              // Fail silently
          }
      }
  };

  // CRUD Operations
  const addScheduleEntry = async (entry: ScheduleEntry) => {
     // For schedule entries, a random ID is acceptable, but let's make it consistent
     const id = entry.id || `SCH-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
     const newEntry = { ...entry, id };
     
     setSchedule(prev => [...prev, newEntry]);
     if (db) {
        try {
            const { ...data } = newEntry; 
            await setDoc(doc(db, 'schedule', id), data);
        } catch (e) { 
            // Fail silently
        }
     }
  };

  const addFaculty = async (newFaculty: Omit<Faculty, 'id'>) => {
    const id = generateReadableId('FAC', newFaculty.name);
    await addToCollection<Faculty>('faculty', id, newFaculty, setFaculty);
  };
  
  const updateFaculty = async (faculty: Faculty) => {
    await updateInCollection('faculty', faculty, setFaculty);
  };

  const deleteFaculty = async (id: string) => {
    await deleteFromCollection('faculty', id, setFaculty);
  };

  const addRoom = async (newRoom: Omit<Room, 'id'>) => {
    const id = generateReadableId('RM', newRoom.name);
    await addToCollection<Room>('rooms', id, newRoom, setRooms);
  };

  const updateRoom = async (room: Room) => {
    await updateInCollection('rooms', room, setRooms);
  };

  const deleteRoom = async (id: string) => {
    await deleteFromCollection('rooms', id, setRooms);
  };

  const addSubject = async (newSubject: Omit<Subject, 'id'>) => {
    // For subjects, the code is usually more unique than the name
    const id = generateReadableId('SUB', newSubject.code || newSubject.name);
    await addToCollection<Subject>('subjects', id, newSubject, setSubjects);
  };

  const updateSubject = async (subject: Subject) => {
    await updateInCollection('subjects', subject, setSubjects);
  };

  const deleteSubject = async (id: string) => {
    await deleteFromCollection('subjects', id, setSubjects);
  };

  const addBatch = async (newBatch: Omit<Batch, 'id'>) => {
    const id = generateReadableId('BAT', newBatch.name);
    await addToCollection<Batch>('batches', id, newBatch, setBatches);
  };

  const updateBatch = async (batch: Batch) => {
    await updateInCollection('batches', batch, setBatches);
  };

  const deleteBatch = async (id: string) => {
    await deleteFromCollection('batches', id, setBatches);
  };

  const addDepartment = async (newDept: Omit<Department, 'id'>) => {
    const id = generateReadableId('DEPT', newDept.code || newDept.name);
    await addToCollection<Department>('departments', id, newDept, setDepartments);
  };

  const updateDepartment = async (dept: Department) => {
    await updateInCollection('departments', dept, setDepartments);
  };

  const deleteDepartment = async (id: string) => {
    await deleteFromCollection('departments', id, setDepartments);
  };

  const updateScheduleEntry = async (updatedEntry: ScheduleEntry) => {
    setSchedule(prev => prev.map(s => s.id === updatedEntry.id ? updatedEntry : s));

    if (db) {
        try {
            const { id, ...data } = updatedEntry;
            const docRef = doc(db, 'schedule', id);
            await updateDoc(docRef, data as any);
        } catch (e) { 
             // Fail silently
        }
    }
  };
  
  const deleteScheduleEntry = async (id: string) => {
    setSchedule(prev => prev.filter(s => s.id !== id));

    if (db) {
        try {
            await deleteDoc(doc(db, 'schedule', id));
        } catch (e) { 
             // Fail silently
        }
    }
  }

  return (
    <StoreContext.Provider value={{
      user, login, logout,
      faculty, rooms, subjects, batches, departments, schedule, conflicts, settings, generatedSlots,
      addScheduleEntry, updateScheduleEntry, deleteScheduleEntry, checkConflicts, resetData, saveGeneratedSchedule, loading, importData,
      addFaculty, addRoom, addSubject, addBatch, addDepartment,
      updateFaculty, updateRoom, updateSubject, updateBatch, updateDepartment,
      deleteFaculty, deleteRoom, deleteSubject, deleteBatch, deleteDepartment,
      updateSettings
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};
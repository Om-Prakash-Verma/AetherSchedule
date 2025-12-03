import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Faculty, Room, Batch, Subject, ScheduleEntry, ScheduleConflict, Department, TimetableSettings, ScheduleVersion } from '../types';
import { db, auth } from '../services/firebase';
import { 
    collection, 
    onSnapshot, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    writeBatch, 
    getDocs,
    query,
    where,
    QuerySnapshot,
    DocumentData,
    orderBy
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { generateTimeSlots } from '../core/TimeUtils';

// Default Settings
const DEFAULT_SETTINGS: TimetableSettings = {
    collegeStartTime: "09:00",
    collegeEndTime: "17:00",
    periodDuration: 60,
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    breaks: [
        { id: 'b1', name: 'Lunch Break', startTime: "13:00", endTime: "14:00" }
    ]
};

interface StoreState {
  faculty: Faculty[];
  rooms: Room[];
  subjects: Subject[];
  batches: Batch[];
  departments: Department[];
  schedule: ScheduleEntry[];
  conflicts: ScheduleConflict[];
  settings: TimetableSettings;
  generatedSlots: string[]; // Computed from settings
  versions: ScheduleVersion[]; // Version History
  
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
  
  // Version Control
  saveVersion: (name: string) => Promise<void>;
  restoreVersion: (versionId: string) => Promise<void>;
  deleteVersion: (versionId: string) => Promise<void>;

  loading: boolean;
}

const StoreContext = createContext<StoreState | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [settings, setSettings] = useState<TimetableSettings>(DEFAULT_SETTINGS);
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  
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
        console.warn(`Error listening to ${collectionName}:`, error.message);
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
    let unsubVersions: () => void;

    const setupListeners = () => {
        unsubFaculty = subscribe('faculty', setFaculty);
        unsubRooms = subscribe('rooms', setRooms);
        unsubSubjects = subscribe('subjects', setSubjects);
        unsubBatches = subscribe('batches', setBatches);
        unsubDepartments = subscribe('departments', setDepartments);
        unsubSchedule = subscribe('schedule', setSchedule);
        unsubVersions = subscribe('schedule_versions', setVersions, true);
        
        // Settings listener (expecting a single doc 'config' in 'settings' collection)
        unsubSettings = onSnapshot(doc(firestore, 'settings', 'config'), (docSnap) => {
            if (docSnap.exists()) {
                // Merge with defaults to ensure robustness against partial data
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...docSnap.data() } as TimetableSettings));
            } else {
                // If doesn't exist, create it
                setDoc(doc(firestore, 'settings', 'config'), DEFAULT_SETTINGS);
            }
        });
    };

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Authenticated:", user.uid);
            setLoading(false);
            setupListeners();
        } else {
            console.log("Signing in anonymously...");
            try {
                if (auth) await signInAnonymously(auth);
            } catch (error) {
                console.warn("Auth failed:", error);
                setLoading(false);
            }
        }
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
        if (unsubVersions) unsubVersions();
    };
  }, []);

  // Conflict detection
  const checkConflicts = () => {
    const newConflicts: ScheduleConflict[] = [];
    schedule.forEach((entry1, idx) => {
      schedule.forEach((entry2, idx2) => {
        if (idx >= idx2) return;
        if (entry1.day === entry2.day && entry1.slot === entry2.slot) {
          // Room Conflict
          if (entry1.roomId === entry2.roomId) {
            newConflicts.push({
              type: 'ROOM',
              description: `Room ${rooms.find(r => r.id === entry1.roomId)?.name || 'Unknown'} double booked`,
              involvedIds: [entry1.id, entry2.id]
            });
          }
          
          // Faculty Conflict (Handle arrays of faculty)
          const f1s = entry1.facultyIds || [];
          const f2s = entry2.facultyIds || [];
          
          // Check intersection of faculty arrays
          const overlappingFaculty = f1s.filter(fId => f2s.includes(fId));
          
          if (overlappingFaculty.length > 0) {
            const fName = faculty.find(f => f.id === overlappingFaculty[0])?.name || 'Unknown';
            newConflicts.push({
              type: 'FACULTY',
              description: `Faculty ${fName} double booked`,
              involvedIds: [entry1.id, entry2.id]
            });
          }

          if (entry1.batchId === entry2.batchId) {
             newConflicts.push({
              type: 'BATCH',
              description: `Batch ${batches.find(b => b.id === entry1.batchId)?.name || 'Unknown'} clash`,
              involvedIds: [entry1.id, entry2.id]
            });
          }
        }
      });
    });
    setConflicts(newConflicts);
  };

  useEffect(() => {
    checkConflicts();
  }, [schedule, faculty, rooms, batches]);

  // Generic helper to add data
  const addToCollection = async <T extends { id: string }>(
      collectionName: string, 
      data: Omit<T, 'id'>, 
      setter: React.Dispatch<React.SetStateAction<T[]>>
  ) => {
      const id = Math.random().toString(36).substr(2, 9);
      const newItem = { ...data, id } as T;
      
      // Optimistic update
      setter(prev => [...prev, newItem]);

      if (db) {
          try {
              await setDoc(doc(db, collectionName, id), newItem);
          } catch (e) {
              console.warn(`Failed to add to ${collectionName} in cloud`, e);
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
              console.warn(`Failed to update ${collectionName} in cloud`, e);
          }
      }
  };

  // Generic helper to delete data
  const deleteFromCollection = async <T extends { id: string }>(
      collectionName: string, 
      id: string, 
      setter: React.Dispatch<React.SetStateAction<T[]>>
  ) => {
      console.log(`[Store] Optimistic delete for ID: ${id} from ${collectionName}`);
      
      // Optimistic update
      setter(prev => prev.filter(item => item.id !== id));
      
      if (db) {
          try {
              console.log(`[Store] Sending delete command to Firebase for ${collectionName}/${id}`);
              await deleteDoc(doc(db, collectionName, id));
              console.log(`[Store] Successfully deleted ${id} from cloud.`);
          } catch (e) {
              console.error(`[Store] FAILED to delete from ${collectionName} in cloud`, e);
          }
      } else {
          console.warn("[Store] Database connection not available, delete is local-only.");
      }
  };

  // Update Settings
  const updateSettings = async (newSettings: TimetableSettings) => {
      setSettings(newSettings);
      if (db) {
          try {
              await setDoc(doc(db, 'settings', 'config'), newSettings);
          } catch (e) {
              console.error("Failed to save settings", e);
          }
      }
  };

  // CRUD Operations
  const addScheduleEntry = async (entry: ScheduleEntry) => {
     const id = entry.id || Math.random().toString(36).substr(2, 9);
     const newEntry = { ...entry, id };
     
     setSchedule(prev => [...prev, newEntry]);
     if (db) {
        try {
            const { ...data } = newEntry; 
            await setDoc(doc(db, 'schedule', id), data);
        } catch (e) { 
            console.warn("Failed to add schedule entry to cloud", e);
        }
     }
  };

  const addFaculty = async (newFaculty: Omit<Faculty, 'id'>) => {
    await addToCollection<Faculty>('faculty', newFaculty, setFaculty);
  };
  
  const updateFaculty = async (faculty: Faculty) => {
    await updateInCollection('faculty', faculty, setFaculty);
  };

  const deleteFaculty = async (id: string) => {
    await deleteFromCollection('faculty', id, setFaculty);
  };

  const addRoom = async (newRoom: Omit<Room, 'id'>) => {
    await addToCollection<Room>('rooms', newRoom, setRooms);
  };

  const updateRoom = async (room: Room) => {
    await updateInCollection('rooms', room, setRooms);
  };

  const deleteRoom = async (id: string) => {
    await deleteFromCollection('rooms', id, setRooms);
  };

  const addSubject = async (newSubject: Omit<Subject, 'id'>) => {
    await addToCollection<Subject>('subjects', newSubject, setSubjects);
  };

  const updateSubject = async (subject: Subject) => {
    await updateInCollection('subjects', subject, setSubjects);
  };

  const deleteSubject = async (id: string) => {
    await deleteFromCollection('subjects', id, setSubjects);
  };

  const addBatch = async (newBatch: Omit<Batch, 'id'>) => {
    await addToCollection<Batch>('batches', newBatch, setBatches);
  };

  const updateBatch = async (batch: Batch) => {
    await updateInCollection('batches', batch, setBatches);
  };

  const deleteBatch = async (id: string) => {
    await deleteFromCollection('batches', id, setBatches);
  };

  const addDepartment = async (newDept: Omit<Department, 'id'>) => {
    await addToCollection<Department>('departments', newDept, setDepartments);
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
             console.warn("Failed to update schedule entry in cloud", e);
        }
    }
  };
  
  const deleteScheduleEntry = async (id: string) => {
    setSchedule(prev => prev.filter(s => s.id !== id));

    if (db) {
        try {
            await deleteDoc(doc(db, 'schedule', id));
        } catch (e) { 
             console.warn("Failed to delete schedule entry from cloud", e);
        }
    }
  }

  const resetData = async () => {
      if (confirm("Reset all schedule data? This will clear the timetable but keep your resources.")) {
          setSchedule([]);
          if (db) {
              const firestore = db;
              setLoading(true);
              try {
                const schSnapshot = await getDocs(collection(firestore, 'schedule'));
                const batch = writeBatch(firestore);
                schSnapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
              } catch(e) {
                  console.warn("Cloud reset failed.", e);
              } finally {
                setLoading(false);
              }
          }
      }
  }

  // Bulk save generated schedule using batched writes
  // supports targetBatchId for partial updates
  const saveGeneratedSchedule = async (newSchedule: ScheduleEntry[], targetBatchId?: string) => {
      setLoading(true);
      
      // 1. Optimistic Update
      if (targetBatchId) {
          // Remove old entries for this batch, add new ones, keep others
          setSchedule(prev => [
              ...prev.filter(s => s.batchId !== targetBatchId), 
              ...newSchedule
          ]);
      } else {
          // Replace everything
          setSchedule(newSchedule);
      }

      if (db) {
          const firestore = db;
          try {
              // 2. Identify what to delete
              let q;
              if (targetBatchId) {
                  q = query(collection(firestore, 'schedule'), where('batchId', '==', targetBatchId));
              } else {
                  q = query(collection(firestore, 'schedule'));
              }
              
              const snapshot = await getDocs(q);
              
              // Firestore batch limit is 500 operations
              const CHUNK_SIZE = 400; 

              // Delete in chunks
              const deleteChunks = [];
              for (let i = 0; i < snapshot.docs.length; i += CHUNK_SIZE) {
                  deleteChunks.push(snapshot.docs.slice(i, i + CHUNK_SIZE));
              }

              for (const chunk of deleteChunks) {
                  const batch = writeBatch(firestore);
                  chunk.forEach(doc => batch.delete(doc.ref));
                  await batch.commit();
              }
              
              console.log(targetBatchId ? `Cleared existing schedule for batch ${targetBatchId}` : "Cleared master schedule.");

              // 3. Write new schedule in chunks
              const writeChunks = [];
              for (let i = 0; i < newSchedule.length; i += CHUNK_SIZE) {
                  writeChunks.push(newSchedule.slice(i, i + CHUNK_SIZE));
              }

              for (const chunk of writeChunks) {
                  const batch = writeBatch(firestore);
                  chunk.forEach(entry => {
                      const docRef = doc(firestore, 'schedule', entry.id);
                      batch.set(docRef, entry);
                  });
                  await batch.commit();
              }

              console.log("New schedule saved successfully.");

          } catch (e) {
              console.error("Error saving generated schedule:", e);
              alert("Error saving schedule to cloud. Check console for details.");
          } finally {
              setLoading(false);
          }
      } else {
          setLoading(false);
          console.warn("Database not connected, schedule only saved locally.");
      }
  }

  // Version Control Methods
  const saveVersion = async (name: string) => {
      if (!db) {
          alert("Cannot save versions in offline mode.");
          return;
      }
      
      try {
          setLoading(true);
          const versionId = Math.random().toString(36).substr(2, 9);
          const newVersion: ScheduleVersion = {
              id: versionId,
              name,
              createdAt: new Date().toISOString(),
              entries: schedule
          };
          
          await setDoc(doc(db, 'schedule_versions', versionId), newVersion);
          setVersions(prev => [newVersion, ...prev]);
          console.log("Version saved:", name);
      } catch (e) {
          console.error("Failed to save version:", e);
          alert("Failed to save version.");
      } finally {
          setLoading(false);
      }
  };

  const restoreVersion = async (versionId: string) => {
      const version = versions.find(v => v.id === versionId);
      if (!version) return;
      
      if (confirm(`Are you sure you want to restore "${version.name}"? This will overwrite the current live schedule.`)) {
          // Full restore implies wiping everything and replacing, so no targetBatchId
          await saveGeneratedSchedule(version.entries);
      }
  };

  const deleteVersion = async (versionId: string) => {
      if (confirm("Are you sure you want to delete this saved version?")) {
          await deleteFromCollection('schedule_versions', versionId, setVersions);
      }
  };

  return (
    <StoreContext.Provider value={{
      faculty, rooms, subjects, batches, departments, schedule, conflicts, settings, generatedSlots, versions,
      addScheduleEntry, updateScheduleEntry, deleteScheduleEntry, checkConflicts, resetData, saveGeneratedSchedule, loading,
      addFaculty, addRoom, addSubject, addBatch, addDepartment,
      updateFaculty, updateRoom, updateSubject, updateBatch, updateDepartment,
      deleteFaculty, deleteRoom, deleteSubject, deleteBatch, deleteDepartment,
      updateSettings,
      saveVersion, restoreVersion, deleteVersion
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
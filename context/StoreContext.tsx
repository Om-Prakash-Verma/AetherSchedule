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
    writeBatch, 
    getDocs,
    query,
    where,
    QuerySnapshot,
    DocumentData,
    orderBy
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
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

// Helper to generate readable IDs
// Format: PREFIX-SLUG-SUFFIX (e.g., FAC-JOHN-DOE-X9A)
const generateReadableId = (prefix: string, name: string): string => {
    const slug = name
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .substring(0, 20); // Limit slug length
    
    // Add short random suffix to ensure uniqueness even if names are identical
    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    
    return `${prefix}-${slug}-${suffix}`;
};

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

  // Enhanced Conflict Detection
  const checkConflicts = () => {
    const newConflicts: ScheduleConflict[] = [];
    
    // 1. Capacity Checks (Individual Entry)
    // Check if assigned room is large enough for the batch
    schedule.forEach(entry => {
        const batch = batches.find(b => b.id === entry.batchId);
        const room = rooms.find(r => r.id === entry.roomId);
        
        if (batch && room && batch.size > room.capacity) {
            newConflicts.push({
                type: 'CAPACITY',
                description: `Room Capacity Issue: ${room.name} (${room.capacity}) is too small for ${batch.name} (${batch.size} students)`,
                involvedIds: [entry.id]
            });
        }
    });

    // 2. Overlap Checks (Group by Day-Slot for O(N) efficiency instead of O(N^2))
    const slotMap = new Map<string, ScheduleEntry[]>();
    
    schedule.forEach(entry => {
        const key = `${entry.day}-${entry.slot}`;
        if (!slotMap.has(key)) slotMap.set(key, []);
        slotMap.get(key)?.push(entry);
    });

    slotMap.forEach((entriesInSlot, key) => {
        if (entriesInSlot.length < 2) return;

        // Compare every pair ONLY within this specific time slot
        for (let i = 0; i < entriesInSlot.length; i++) {
            for (let j = i + 1; j < entriesInSlot.length; j++) {
                const entry1 = entriesInSlot[i];
                const entry2 = entriesInSlot[j];

                // A. Room Conflict
                if (entry1.roomId === entry2.roomId) {
                    const roomName = rooms.find(r => r.id === entry1.roomId)?.name || 'Unknown Room';
                    const b1 = batches.find(b => b.id === entry1.batchId)?.name || 'Unknown';
                    const b2 = batches.find(b => b.id === entry2.batchId)?.name || 'Unknown';
                    
                    newConflicts.push({
                        type: 'ROOM',
                        description: `Room ${roomName} double booked (${b1} vs ${b2})`,
                        involvedIds: [entry1.id, entry2.id]
                    });
                }
                
                // B. Faculty Conflict (Intersection check for arrays)
                const f1s = entry1.facultyIds || [];
                const f2s = entry2.facultyIds || [];
                const overlappingFaculty = f1s.filter(fId => f2s.includes(fId));
                
                if (overlappingFaculty.length > 0) {
                    const fNames = overlappingFaculty.map(fid => faculty.find(f => f.id === fid)?.name).filter(Boolean).join(', ');
                    const b1 = batches.find(b => b.id === entry1.batchId)?.name || 'Unknown';
                    const b2 = batches.find(b => b.id === entry2.batchId)?.name || 'Unknown';

                    newConflicts.push({
                        type: 'FACULTY',
                        description: `Faculty ${fNames || 'Unknown'} double booked (${b1} vs ${b2})`,
                        involvedIds: [entry1.id, entry2.id]
                    });
                }

                // C. Batch Conflict (Batch cannot be in two places at once)
                if (entry1.batchId === entry2.batchId) {
                     const bName = batches.find(b => b.id === entry1.batchId)?.name || 'Unknown Batch';
                     newConflicts.push({
                        type: 'BATCH',
                        description: `Batch ${bName} has concurrent classes scheduled`,
                        involvedIds: [entry1.id, entry2.id]
                    });
                }
            }
        }
    });

    setConflicts(newConflicts);
  };

  useEffect(() => {
    checkConflicts();
  }, [schedule, faculty, rooms, batches]);

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
                  // Fail silently
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

          } catch (e) {
              alert("Error saving schedule to cloud. Please try again.");
          } finally {
              setLoading(false);
          }
      } else {
          setLoading(false);
      }
  }

  const importData = async (data: AppData) => {
      console.group("📦 Import Data Process Started");
      console.log("Raw Data Received:", data);
      
      setLoading(true);
      try {
          if (!data.faculty || !data.rooms || !data.subjects) {
              console.error("❌ Validation Failed: Missing required collections (faculty/rooms/subjects)");
              throw new Error("Invalid data format");
          }

          console.log(`📊 Statistics:
          - Faculty: ${data.faculty.length}
          - Rooms: ${data.rooms.length}
          - Subjects: ${data.subjects.length}
          - Batches: ${data.batches.length}
          - Departments: ${data.departments.length}
          - Schedule Entries: ${data.schedule?.length || 0}
          `);

          // --- ID MIGRATION STRATEGY ---
          console.time("ID Migration & Processing");
          
          const idMaps = {
              faculty: new Map<string, string>(),
              rooms: new Map<string, string>(),
              subjects: new Map<string, string>(),
              batches: new Map<string, string>(),
              departments: new Map<string, string>(),
          };

          // 1. Process Departments
          const processedDepartments = (data.departments || []).map(d => {
              const needsMigration = !d.id.startsWith('DEPT-');
              const newId = needsMigration ? generateReadableId('DEPT', d.code || d.name) : d.id;
              if (needsMigration) idMaps.departments.set(d.id, newId);
              return { ...d, id: newId };
          });

          // 2. Process Rooms
          const processedRooms = (data.rooms || []).map(r => {
              const needsMigration = !r.id.startsWith('RM-');
              const newId = needsMigration ? generateReadableId('RM', r.name) : r.id;
              if (needsMigration) idMaps.rooms.set(r.id, newId);
              return { ...r, id: newId };
          });

          // 3. Process Subjects
          const processedSubjects = (data.subjects || []).map(s => {
              const needsMigration = !s.id.startsWith('SUB-');
              const newId = needsMigration ? generateReadableId('SUB', s.code || s.name) : s.id;
              if (needsMigration) idMaps.subjects.set(s.id, newId);
              return { ...s, id: newId };
          });

          // 4. Process Faculty (AndUpdate subject refs)
          const processedFaculty = (data.faculty || []).map(f => {
              const needsMigration = !f.id.startsWith('FAC-');
              const newId = needsMigration ? generateReadableId('FAC', f.name) : f.id;
              if (needsMigration) idMaps.faculty.set(f.id, newId);
              
              // Update subject references within faculty
              const updatedSubjects = (f.subjects || []).map(subId => idMaps.subjects.get(subId) || subId);

              return { ...f, id: newId, subjects: updatedSubjects };
          });

          // 5. Process Batches (Update Room/Subject/Faculty refs)
          const processedBatches = (data.batches || []).map(b => {
              const needsMigration = !b.id.startsWith('BAT-');
              const newId = needsMigration ? generateReadableId('BAT', b.name) : b.id;
              if (needsMigration) idMaps.batches.set(b.id, newId);

              // Update Fixed Room
              const updatedFixedRoom = b.fixedRoomId ? (idMaps.rooms.get(b.fixedRoomId) || b.fixedRoomId) : b.fixedRoomId;

              // Update Simple Subject List (Deprecated but handle it)
              const updatedSubjects = (b.subjects || []).map(subId => idMaps.subjects.get(subId) || subId);

              // Update Assignments (Complex)
              const updatedAssignments = (b.subjectAssignments || []).map(assign => ({
                  subjectId: idMaps.subjects.get(assign.subjectId) || assign.subjectId,
                  facultyIds: (assign.facultyIds || []).map(fid => idMaps.faculty.get(fid) || fid)
              }));

              return { 
                  ...b, 
                  id: newId, 
                  fixedRoomId: updatedFixedRoom,
                  subjects: updatedSubjects,
                  subjectAssignments: updatedAssignments
              };
          });

          // 6. Process Schedule (Update ALL Refs)
          // Note: We typically don't migrate Schedule IDs as they are ephemeral, but we update their foreign keys
          const processedSchedule = (data.schedule || []).map(s => {
              // Ensure consistent Schedule ID format if missing
              const schId = s.id && s.id.startsWith('SCH-') ? s.id : `SCH-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
              
              return {
                  ...s,
                  id: schId,
                  batchId: idMaps.batches.get(s.batchId) || s.batchId,
                  roomId: idMaps.rooms.get(s.roomId) || s.roomId,
                  subjectId: idMaps.subjects.get(s.subjectId) || s.subjectId,
                  facultyIds: (s.facultyIds || []).map(fid => idMaps.faculty.get(fid) || fid)
              };
          });

          console.timeEnd("ID Migration & Processing");

          // Optimistic Update
          console.log("🔄 Updating Local State...");
          setFaculty(processedFaculty);
          setRooms(processedRooms);
          setSubjects(processedSubjects);
          setBatches(processedBatches);
          setDepartments(processedDepartments);
          setSchedule(processedSchedule); // Don't forget schedule!
          setSettings(data.settings || DEFAULT_SETTINGS);

          if (db) {
              const firestore = db;
              console.log("🔥 Starting Firestore Sync...");
              
              // Define collections to batch write
              const collections = [
                  { name: 'faculty', data: processedFaculty },
                  { name: 'rooms', data: processedRooms },
                  { name: 'subjects', data: processedSubjects },
                  { name: 'batches', data: processedBatches },
                  { name: 'departments', data: processedDepartments },
                  { name: 'schedule', data: processedSchedule }
              ];

              const allOps: { col: string, data: any }[] = [];
              
              collections.forEach(c => {
                  c.data.forEach(item => {
                      allOps.push({ col: c.name, data: item });
                  });
              });

              if(data.settings) {
                  allOps.push({ col: 'settings', data: { ...data.settings, id: 'config' } });
              }

              console.log(`📝 Total Documents to Write: ${allOps.length}`);

              const CHUNK_SIZE = 400;
              const chunks = [];
              for (let i = 0; i < allOps.length; i += CHUNK_SIZE) {
                  chunks.push(allOps.slice(i, i + CHUNK_SIZE));
              }

              console.log(`📦 Batched into ${chunks.length} transactions`);

              for (let i = 0; i < chunks.length; i++) {
                  const chunk = chunks[i];
                  console.log(`... Committing batch ${i + 1}/${chunks.length} (${chunk.length} docs)`);
                  const batch = writeBatch(firestore);
                  chunk.forEach(op => {
                      if (op.col === 'settings') {
                           batch.set(doc(firestore, 'settings', 'config'), op.data);
                      } else {
                           batch.set(doc(firestore, op.col, op.data.id), op.data);
                      }
                  });
                  await batch.commit();
              }
              console.log("✅ Firestore Sync Complete");
          } else {
              console.warn("⚠️ Database connection not available, only updated local state.");
          }
      } catch (e) {
          console.error("❌ Import Failed:", e);
          alert("Failed to import data. Check console for details.");
      } finally {
          setLoading(false);
          console.groupEnd();
      }
  };

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
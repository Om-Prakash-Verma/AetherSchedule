
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Faculty, Room, Batch, Subject, ScheduleEntry, ScheduleConflict, Department, TimetableSettings, ScheduleVersion, AdminProfile } from '../types';
import { db, auth } from '../services/firebase';
import { saveScheduleSecurely } from '../services/geminiService';
import firebase from 'firebase/compat/app';
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
  user: firebase.User | null;
  isAdmin: boolean;
  
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
  admins: AdminProfile[]; // List of admins
  
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
  
  // Admin Management
  addAdmin: (uid: string, email?: string) => Promise<void>;
  removeAdmin: (uid: string) => Promise<void>;
  
  // Version Control
  saveVersion: (name: string) => Promise<void>;
  restoreVersion: (versionId: string) => Promise<void>;
  deleteVersion: (versionId: string) => Promise<void>;

  // Auth
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;

  loading: boolean;
}

const StoreContext = createContext<StoreState | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [settings, setSettings] = useState<TimetableSettings>(DEFAULT_SETTINGS);
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Compute slots based on settings
  const generatedSlots = React.useMemo(() => generateTimeSlots(settings), [settings]);

  // Helper to subscribe to a collection with error handling
  const subscribe = (collectionName: string, setter: Function, ordered = false) => {
    if (!db) return () => {};
    
    let q: firebase.firestore.Query | firebase.firestore.CollectionReference = db.collection(collectionName);
    if (ordered) {
        q = q.orderBy('createdAt', 'desc');
    }

    return q.onSnapshot(
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setter(data);
      }, 
      (error) => {
        if ((error as any).code === 'permission-denied') {
            console.warn(`Permission denied for collection: ${collectionName}. Check Firestore Rules.`);
        } else {
            console.error(`Error listening to ${collectionName}:`, error.message);
        }
      }
    );
  };

  // 1. Auth & Admin Status Effect
  useEffect(() => {
    if (!auth || !db) {
        setLoading(false);
        return;
    }

    let unsubAdminCheck: () => void;

    const unsubAuth = auth.onAuthStateChanged((currentUser) => {
        setUser(currentUser);
        
        if (currentUser) {
            // Subscribe to admin document to check permissions in real-time
            unsubAdminCheck = db!.collection('admins').doc(currentUser.uid).onSnapshot(
                (snap) => {
                    const isNowAdmin = snap.exists;
                    // Avoid unnecessary state updates to prevent re-renders
                    setIsAdmin(prev => {
                        if (prev !== isNowAdmin) {
                            console.log(`Admin status changed: ${isNowAdmin}`);
                            return isNowAdmin;
                        }
                        return prev;
                    });
                },
                (err) => {
                    console.warn("Error checking admin status doc:", (err as any).code);
                    setIsAdmin(false);
                }
            );
        } else {
            setIsAdmin(false);
            if (unsubAdminCheck) unsubAdminCheck();
        }
        setLoading(false);
    });

    return () => {
        unsubAuth();
        if (unsubAdminCheck) unsubAdminCheck();
    };
  }, []);

  // 2. Data Subscription Effect (Depends on user + isAdmin)
  useEffect(() => {
    if (!db) return;

    let unsubFaculty: () => void;
    let unsubRooms: () => void;
    let unsubSubjects: () => void;
    let unsubBatches: () => void;
    let unsubDepartments: () => void;
    let unsubSchedule: () => void;
    let unsubSettings: () => void;
    let unsubVersions: () => void;
    let unsubAdmins: () => void;

    const setupPublicListeners = () => {
        unsubFaculty = subscribe('faculty', setFaculty);
        unsubRooms = subscribe('rooms', setRooms);
        unsubSubjects = subscribe('subjects', setSubjects);
        unsubBatches = subscribe('batches', setBatches);
        unsubDepartments = subscribe('departments', setDepartments);
        unsubSchedule = subscribe('schedule', setSchedule);
        
        unsubSettings = db!.collection('settings').doc('config').onSnapshot((docSnap) => {
            if (docSnap.exists) {
                setSettings(prev => ({ ...DEFAULT_SETTINGS, ...(docSnap.data() as Partial<TimetableSettings>) } as TimetableSettings));
            }
        }, (error) => {
             if((error as any).code !== 'permission-denied') console.warn("Error fetching settings:", error.message);
        });
    };

    const setupAdminListeners = () => {
        // Double check admin status before subscribing to avoid race conditions
        if (!isAdmin) return; 

        console.log("Initializing admin subscriptions...");
        unsubVersions = subscribe('schedule_versions', setVersions, true);
        unsubAdmins = subscribe('admins', setAdmins);
    };

    // Always run public listeners (they are allowed by rules 'if true')
    setupPublicListeners();

    // Only run admin listeners if we are confirmed admin
    if (user && isAdmin) {
        setupAdminListeners();
    } else {
        // Clear sensitive data if not admin
        setVersions([]);
        setAdmins([]);
    }

    return () => {
        if (unsubFaculty) unsubFaculty();
        if (unsubRooms) unsubRooms();
        if (unsubSubjects) unsubSubjects();
        if (unsubBatches) unsubBatches();
        if (unsubDepartments) unsubDepartments();
        if (unsubSchedule) unsubSchedule();
        if (unsubSettings) unsubSettings();
        if (unsubVersions) unsubVersions();
        if (unsubAdmins) unsubAdmins();
    };
  }, [user, isAdmin]); // Re-run when Admin status changes

  const login = async (email: string, pass: string) => {
      if (!auth) throw new Error("Auth not initialized");
      await auth.signInWithEmailAndPassword(email, pass);
  };

  const logout = async () => {
      if (!auth) return;
      await auth.signOut();
      setVersions([]);
      setAdmins([]);
      setIsAdmin(false);
  };

  // Enhanced Conflict Detection (Client side for instant feedback)
  const checkConflicts = () => {
    const newConflicts: ScheduleConflict[] = [];
    
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

    const slotMap = new Map<string, ScheduleEntry[]>();
    schedule.forEach(entry => {
        const key = `${entry.day}-${entry.slot}`;
        if (!slotMap.has(key)) slotMap.set(key, []);
        slotMap.get(key)?.push(entry);
    });

    slotMap.forEach((entriesInSlot, key) => {
        if (entriesInSlot.length < 2) return;
        for (let i = 0; i < entriesInSlot.length; i++) {
            for (let j = i + 1; j < entriesInSlot.length; j++) {
                const entry1 = entriesInSlot[i];
                const entry2 = entriesInSlot[j];
                if (entry1.roomId === entry2.roomId) {
                    const roomName = rooms.find(r => r.id === entry1.roomId)?.name || 'Unknown Room';
                    newConflicts.push({ type: 'ROOM', description: `Room ${roomName} double booked`, involvedIds: [entry1.id, entry2.id] });
                }
                const f1s = entry1.facultyIds || [];
                const f2s = entry2.facultyIds || [];
                const overlappingFaculty = f1s.filter(fId => f2s.includes(fId));
                if (overlappingFaculty.length > 0) {
                    const fNames = overlappingFaculty.map(fid => faculty.find(f => f.id === fid)?.name).join(', ');
                    newConflicts.push({ type: 'FACULTY', description: `Faculty ${fNames} double booked`, involvedIds: [entry1.id, entry2.id] });
                }
                if (entry1.batchId === entry2.batchId) {
                     const bName = batches.find(b => b.id === entry1.batchId)?.name || 'Unknown Batch';
                     newConflicts.push({ type: 'BATCH', description: `Batch ${bName} has concurrent classes`, involvedIds: [entry1.id, entry2.id] });
                }
            }
        }
    });

    setConflicts(newConflicts);
  };

  useEffect(() => {
    checkConflicts();
  }, [schedule, faculty, rooms, batches]);

  // Generic helpers
  const addToCollection = async <T extends { id: string }>(colName: string, data: Omit<T, 'id'>, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      const id = Math.random().toString(36).substr(2, 9);
      const newItem = { ...data, id } as T;
      setter(prev => [...prev, newItem]);
      if (db && user && isAdmin) await db.collection(colName).doc(id).set(newItem);
  };

  const updateInCollection = async <T extends { id: string }>(colName: string, item: T, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      setter(prev => prev.map(existing => existing.id === item.id ? item : existing));
      if (db && user && isAdmin) {
          const { id, ...data } = item;
          await db.collection(colName).doc(id).update(data);
      }
  };

  const deleteFromCollection = async <T extends { id: string }>(colName: string, id: string, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      setter(prev => prev.filter(item => item.id !== id));
      if (db && user && isAdmin) await db.collection(colName).doc(id).delete();
  };

  const updateSettings = async (newSettings: TimetableSettings) => {
      setSettings(newSettings);
      if (db && user && isAdmin) await db.collection('settings').doc('config').set(newSettings);
  };

  // CRUD
  const addScheduleEntry = async (entry: ScheduleEntry) => {
     const id = entry.id || Math.random().toString(36).substr(2, 9);
     const newEntry = { ...entry, id };
     setSchedule(prev => [...prev, newEntry]);
     if (db && user && isAdmin) {
        const { ...data } = newEntry; 
        await db.collection('schedule').doc(id).set(data);
     }
  };

  const addFaculty = (d: Omit<Faculty, 'id'>) => addToCollection('faculty', d, setFaculty);
  const updateFaculty = (d: Faculty) => updateInCollection('faculty', d, setFaculty);
  const deleteFaculty = (id: string) => deleteFromCollection('faculty', id, setFaculty);

  const addRoom = (d: Omit<Room, 'id'>) => addToCollection('rooms', d, setRooms);
  const updateRoom = (d: Room) => updateInCollection('rooms', d, setRooms);
  const deleteRoom = (id: string) => deleteFromCollection('rooms', id, setRooms);

  const addSubject = (d: Omit<Subject, 'id'>) => addToCollection('subjects', d, setSubjects);
  const updateSubject = (d: Subject) => updateInCollection('subjects', d, setSubjects);
  const deleteSubject = (id: string) => deleteFromCollection('subjects', id, setSubjects);

  const addBatch = (d: Omit<Batch, 'id'>) => addToCollection('batches', d, setBatches);
  const updateBatch = (d: Batch) => updateInCollection('batches', d, setBatches);
  const deleteBatch = (id: string) => deleteFromCollection('batches', id, setBatches);

  const addDepartment = (d: Omit<Department, 'id'>) => addToCollection('departments', d, setDepartments);
  const updateDepartment = (d: Department) => updateInCollection('departments', d, setDepartments);
  const deleteDepartment = (id: string) => deleteFromCollection('departments', id, setDepartments);

  const updateScheduleEntry = async (updatedEntry: ScheduleEntry) => {
    setSchedule(prev => prev.map(s => s.id === updatedEntry.id ? updatedEntry : s));
    if (db && user && isAdmin) {
        const { id, ...data } = updatedEntry;
        await db.collection('schedule').doc(id).update(data);
    }
  };
  
  const deleteScheduleEntry = async (id: string) => {
    setSchedule(prev => prev.filter(s => s.id !== id));
    if (db && user && isAdmin) await db.collection('schedule').doc(id).delete();
  }

  const resetData = async () => {
      if (!isAdmin) return;
      if (confirm("Reset all schedule data?")) {
          setSchedule([]);
          if (db && user) {
              setLoading(true);
              try {
                // We'll use the backend for bulk delete if simpler, or just loop here
                const schSnapshot = await db.collection('schedule').get();
                const batch = db.batch();
                schSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
                await batch.commit();
              } finally {
                setLoading(false);
              }
          }
      }
  }

  // UPDATED: Save via Backend for Security
  const saveGeneratedSchedule = async (newSchedule: ScheduleEntry[], targetBatchId?: string) => {
      if (!isAdmin) return;
      setLoading(true);
      
      // Optimistic update for UI responsiveness
      if (targetBatchId) {
          setSchedule(prev => [...prev.filter(s => s.batchId !== targetBatchId), ...newSchedule]);
      } else {
          setSchedule(newSchedule);
      }

      if (db && user) {
          try {
              // Call secure backend function
              await saveScheduleSecurely(newSchedule, targetBatchId);
              console.log("Schedule saved securely via backend.");
          } catch (e) {
              console.error("Error saving generated schedule:", e);
              alert("Error saving schedule to cloud. See console.");
              // Revert optimistic update? For now we assume eventual consistency
          } finally {
              setLoading(false);
          }
      } else {
          setLoading(false);
      }
  }

  const saveVersion = async (name: string) => {
      if (!db || !user || !isAdmin) return;
      setLoading(true);
      const versionId = Math.random().toString(36).substr(2, 9);
      const newVersion: ScheduleVersion = { id: versionId, name, createdAt: new Date().toISOString(), entries: schedule };
      await db.collection('schedule_versions').doc(versionId).set(newVersion);
      setVersions(prev => [newVersion, ...prev]);
      setLoading(false);
  };

  const restoreVersion = async (versionId: string) => {
      if (!isAdmin) return;
      const version = versions.find(v => v.id === versionId);
      if (!version) return;
      if (confirm(`Restore "${version.name}"?`)) {
          await saveGeneratedSchedule(version.entries);
      }
  };

  const deleteVersion = async (versionId: string) => {
      if (!isAdmin) return;
      if (confirm("Delete version?")) {
          await deleteFromCollection('schedule_versions', versionId, setVersions);
      }
  };

  // ADMIN MANAGEMENT
  const addAdmin = async (uid: string, email?: string) => {
      if (!db || !user || !isAdmin) return;
      // Using set to create the admin entry
      const newAdmin: AdminProfile = {
          id: uid,
          email: email || '',
          addedAt: new Date().toISOString()
      };
      // Optimistically update
      setAdmins(prev => [...prev, newAdmin]);
      
      try {
        await db.collection('admins').doc(uid).set(newAdmin);
      } catch (err) {
          console.error("Failed to add admin", err);
          setAdmins(prev => prev.filter(a => a.id !== uid));
          throw err;
      }
  };

  const removeAdmin = async (uid: string) => {
      if (!db || !user || !isAdmin) return;
      // Optimistically update
      setAdmins(prev => prev.filter(a => a.id !== uid));
      try {
        await db.collection('admins').doc(uid).delete();
      } catch (err) {
         console.error("Failed to remove admin", err);
         // Revert on failure needs a refetch or careful state management
         throw err;
      }
  };

  return (
    <StoreContext.Provider value={{
      user, isAdmin, login, logout,
      faculty, rooms, subjects, batches, departments, schedule, conflicts, settings, generatedSlots, versions, admins,
      addScheduleEntry, updateScheduleEntry, deleteScheduleEntry, checkConflicts, resetData, saveGeneratedSchedule, loading,
      addFaculty, addRoom, addSubject, addBatch, addDepartment,
      updateFaculty, updateRoom, updateSubject, updateBatch, updateDepartment,
      deleteFaculty, deleteRoom, deleteSubject, deleteBatch, deleteDepartment,
      updateSettings,
      saveVersion, restoreVersion, deleteVersion,
      addAdmin, removeAdmin
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

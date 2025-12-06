import { Firestore, writeBatch, doc } from 'firebase/firestore';
import { AppData, TimetableSettings, Faculty, Room, Subject, Batch, ScheduleEntry, Department } from '../../types';
import { generateReadableId, DEFAULT_SETTINGS } from '../utils';

// Helper type for Setters to avoid passing 20 arguments individually
interface Setters {
    setFaculty: (data: Faculty[]) => void;
    setRooms: (data: Room[]) => void;
    setSubjects: (data: Subject[]) => void;
    setBatches: (data: Batch[]) => void;
    setDepartments: (data: Department[]) => void;
    setSchedule: (data: ScheduleEntry[]) => void;
    setSettings: (data: TimetableSettings) => void;
    setLoading: (loading: boolean) => void;
}

export const importDataToFirebase = async (
    db: Firestore | undefined,
    data: AppData,
    setters: Setters
) => {
    console.group("📦 Import Data Process Started");
    console.log("Raw Data Received:", data);
    
    setters.setLoading(true);
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
        setters.setFaculty(processedFaculty);
        setters.setRooms(processedRooms);
        setters.setSubjects(processedSubjects);
        setters.setBatches(processedBatches);
        setters.setDepartments(processedDepartments);
        setters.setSchedule(processedSchedule); // Don't forget schedule!
        setters.setSettings(data.settings || DEFAULT_SETTINGS);

        if (db) {
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
                const batch = writeBatch(db);
                chunk.forEach(op => {
                    if (op.col === 'settings') {
                         batch.set(doc(db, 'settings', 'config'), op.data);
                    } else {
                         batch.set(doc(db, op.col, op.data.id), op.data);
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
        setters.setLoading(false);
        console.groupEnd();
    }
};
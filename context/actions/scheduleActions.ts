import { Firestore, writeBatch, doc, query, collection, where, getDocs } from 'firebase/firestore';
import { ScheduleEntry } from '../../types';
import React from 'react';

export const saveScheduleToFirebase = async (
    db: Firestore | undefined,
    newSchedule: ScheduleEntry[],
    targetBatchId: string | undefined,
    setSchedule: React.Dispatch<React.SetStateAction<ScheduleEntry[]>>,
    setLoading: (loading: boolean) => void
) => {
    setLoading(true);
      
    // 1. Optimistic Update
    setSchedule(prev => {
        if (targetBatchId) {
             // Remove old entries for this batch, add new ones, keep others
             return [
                 ...prev.filter(s => s.batchId !== targetBatchId), 
                 ...newSchedule
             ];
        } else {
             // Replace everything
             return newSchedule;
        }
    });

    if (db) {
        try {
            // 2. Identify what to delete
            let q;
            if (targetBatchId) {
                q = query(collection(db, 'schedule'), where('batchId', '==', targetBatchId));
            } else {
                q = query(collection(db, 'schedule'));
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
                const batch = writeBatch(db);
                chunk.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
            
            // 3. Write new schedule in chunks
            const writeChunks = [];
            for (let i = 0; i < newSchedule.length; i += CHUNK_SIZE) {
                writeChunks.push(newSchedule.slice(i, i + CHUNK_SIZE));
            }

            for (const chunk of writeChunks) {
                const batch = writeBatch(db);
                chunk.forEach(entry => {
                    const docRef = doc(db, 'schedule', entry.id);
                    batch.set(docRef, entry);
                });
                await batch.commit();
            }

        } catch (e) {
            console.error(e);
            alert("Error saving schedule to cloud. Please try again.");
        } finally {
            setLoading(false);
        }
    } else {
        setLoading(false);
    }
};

export const resetScheduleData = async (
    db: Firestore | undefined,
    setSchedule: React.Dispatch<React.SetStateAction<ScheduleEntry[]>>,
    setLoading: (loading: boolean) => void
) => {
    if (confirm("Reset all schedule data? This will clear the timetable but keep your resources.")) {
        setSchedule([]);
        if (db) {
            setLoading(true);
            try {
              const schSnapshot = await getDocs(collection(db, 'schedule'));
              const batch = writeBatch(db);
              schSnapshot.docs.forEach((doc) => {
                  batch.delete(doc.ref);
              });
              await batch.commit();
            } catch(e) {
                console.error(e);
                // Fail silently
            } finally {
              setLoading(false);
            }
        }
    }
};
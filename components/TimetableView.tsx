import React, { useState, useMemo } from 'react';
import { GlassPanel } from './GlassPanel';
import { useAppContext } from '../hooks/useAppContext';
import { DAYS_OF_WEEK, TIME_SLOTS } from '../constants';
import type { GeneratedTimetable, ClassAssignment, Conflict, DropChange, SingleBatchTimetableGrid } from '../types';
import { GripVertical, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/Popover';

interface TimetableViewProps {
  // This component now receives a timetable object where the grid is for a single batch
  timetableData: Omit<GeneratedTimetable, 'timetable'> & { timetable: SingleBatchTimetableGrid };
  isEditable?: boolean;
  onDropAssignment?: (change: DropChange) => void;
  conflictMap: Map<string, Conflict[]>;
}

const BATCH_COLORS = [
  'border-blue-500/50 bg-blue-500/10',
  'border-green-500/50 bg-green-500/10',
  'border-purple-500/50 bg-purple-500/10',
  'border-orange-500/50 bg-orange-500/10',
  'border-pink-500/50 bg-pink-500/10',
  'border-teal-500/50 bg-teal-500/10',
  'border-yellow-500/50 bg-yellow-500/10',
  'border-indigo-500/50 bg-indigo-500/10',
];

export const TimetableView: React.FC<TimetableViewProps> = ({ timetableData, isEditable = false, onDropAssignment, conflictMap }) => {
  const { subjects, faculty, rooms, batches } = useAppContext();
  
  const [draggingItem, setDraggingItem] = useState<ClassAssignment | null>(null);

  const batchColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const allBatchIds = batches.map(b => b.id);
    (timetableData.batchIds || []).forEach((batchId) => {
        const index = allBatchIds.indexOf(batchId);
        map.set(batchId, BATCH_COLORS[index % BATCH_COLORS.length]);
    });
    return map;
  }, [timetableData.batchIds, batches]);

  const getBatchForAssignment = (assignment: ClassAssignment) => {
    return batches.find(b => b.id === assignment.batchId);
  }
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, assignment: ClassAssignment) => {
    if (!isEditable) return;
    setDraggingItem(assignment);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetDay: number, targetSlot: number) => {
    e.preventDefault();
    if (!draggingItem || !isEditable || !onDropAssignment) {
        setDraggingItem(null);
        return;
    }

    const targetAssignment = timetableData.timetable[targetDay]?.[targetSlot];

    if (draggingItem.day === targetDay && draggingItem.slot === targetSlot) {
        setDraggingItem(null);
        return;
    }

    if (targetAssignment) { // SWAP logic
        onDropAssignment({
            type: 'swap',
            assignment1: draggingItem,
            assignment2: targetAssignment,
        });
    } else { // MOVE logic
        onDropAssignment({
            type: 'move',
            assignment: draggingItem,
            to: { day: targetDay, slot: targetSlot },
        });
    }
    
    setDraggingItem(null);
  };

  return (
    <div className="overflow-x-auto relative printable-area">
      <div className="grid grid-cols-[auto_repeat(6,minmax(120px,1fr))] gap-1 min-w-[900px]">
        {/* Header */}
        <div className="sticky top-0 left-0 z-20 bg-panel/80 backdrop-blur-sm" />
        {DAYS_OF_WEEK.map(day => (
          <div key={day} className="text-center font-bold text-white p-2 sticky top-0 z-10 bg-panel/80 backdrop-blur-sm text-sm sm:text-base">
            {day}
          </div>
        ))}

        {/* Body */}
        {TIME_SLOTS.map((slot, slotIndex) => (
          <React.Fragment key={slot}>
            <div className="text-right text-text-muted p-2 text-xs sticky left-0 z-10 bg-panel/80 backdrop-blur-sm flex items-center justify-end font-mono">
              <span>{slot}</span>
            </div>
            {DAYS_OF_WEEK.map((_, dayIndex) => {
              const assignment = timetableData.timetable[dayIndex]?.[slotIndex];
              const assignmentConflicts = assignment ? conflictMap.get(assignment.id) : undefined;
              const batchColor = assignment ? batchColorMap.get(assignment.batchId) || '' : '';
              
              return (
                <div 
                  key={`${dayIndex}-${slotIndex}`} 
                  className="h-28 bg-panel/5 border border-transparent hover:border-accent/20 transition-colors"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, dayIndex, slotIndex)}
                >
                  {assignment && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <div
                              draggable={isEditable}
                              onDragStart={(e) => handleDragStart(e, assignment)}
                              className="group w-full h-full"
                            >
                                <GlassPanel 
                                  className={`h-full w-full p-2 flex flex-col justify-between text-left text-xs relative overflow-hidden transition-all duration-200 border
                                  ${isEditable ? 'cursor-grab active:cursor-grabbing' : ''}
                                  ${assignmentConflicts ? 'border-2 border-danger shadow-lg shadow-danger/20' : batchColor }
                                  ${draggingItem?.id === assignment.id ? 'opacity-50 scale-95' : ''}`}
                                >
                                  <div className="flex-1">
                                    <p className="font-bold text-white truncate">{subjects.find(s => s.id === assignment.subjectId)?.name || 'Unknown'}</p>
                                    <p className="text-text-muted truncate">{faculty.find(f => f.id === assignment.facultyId)?.name || 'Unknown'}</p>
                                    <p className="text-text-muted truncate">@{rooms.find(r => r.id === assignment.roomId)?.name || 'Unknown'}</p>
                                    { (timetableData.batchIds.length > 1 || timetableData.batchIds.length === 0) && (
                                        <p className="text-[var(--accent)] text-xs truncate mt-1">{getBatchForAssignment(assignment)?.name || 'Unknown'}</p>
                                    )}
                                  </div>
                                  <div className="absolute top-1 right-1 flex items-center gap-1">
                                    {assignmentConflicts && <AlertTriangle className="text-danger animate-pulse-danger" size={16} />}
                                    {isEditable && <GripVertical className="text-text-muted/20 group-hover:text-text-muted" size={16} />}
                                  </div>
                                </GlassPanel>
                            </div>
                        </PopoverTrigger>
                        {assignmentConflicts && (
                            <PopoverContent>
                                <div className="space-y-2 p-4">
                                    <h4 className="font-bold text-white">Conflicts Detected</h4>
                                    {assignmentConflicts.map((conflict, i) => (
                                        <p key={i} className="text-sm text-red-400">{conflict.message}</p>
                                    ))}
                                </div>
                            </PopoverContent>
                        )}
                    </Popover>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
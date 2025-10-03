import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GlassPanel } from './GlassPanel';
import { useAppContext } from '../hooks/useAppContext';
import { DAYS_OF_WEEK } from '../constants';
import type { GeneratedTimetable, ClassAssignment, Conflict, DropChange, SingleBatchTimetableGrid, Substitution } from '../types';
import { GripVertical, AlertTriangle, Replace, UserCheck } from 'lucide-react';
// FIX: Import useQuery and api to fetch data directly.
import { useQuery } from '@tanstack/react-query';
import * as api from '../services';

interface TimetableViewProps {
  timetableData: Omit<GeneratedTimetable, 'timetable'> & { timetable: SingleBatchTimetableGrid };
  isEditable?: boolean;
  onDropAssignment?: (change: DropChange) => void;
  onFindSubstitute?: (assignment: ClassAssignment) => void;
  conflictMap: Map<string, Conflict[]>;
  substitutions: Substitution[];
  viewDate?: Date; // To check if a substitution is active
}

const BATCH_COLORS = [
  'border-blue-500/50 bg-blue-900/30',
  'border-green-500/50 bg-green-900/30',
  'border-purple-500/50 bg-purple-900/30',
  'border-orange-500/50 bg-orange-900/30',
  'border-pink-500/50 bg-pink-900/30',
  'border-teal-500/50 bg-teal-900/30',
  'border-yellow-500/50 bg-yellow-900/30',
  'border-indigo-500/50 bg-indigo-900/30',
];

const toYyyyMmDd = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const TimetableView: React.FC<TimetableViewProps> = ({ 
    timetableData, isEditable = false, onDropAssignment, onFindSubstitute, conflictMap, substitutions = [], viewDate = new Date() 
}) => {
  // FIX: Fetch data with useQuery instead of getting it from context.
  const { timeSlots, workingDays, workingDaysIndices } = useAppContext();
  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: api.getSubjects });
  const { data: faculty = [] } = useQuery({ queryKey: ['faculty'], queryFn: api.getFaculty });
  const { data: rooms = [] } = useQuery({ queryKey: ['rooms'], queryFn: api.getRooms });
  const { data: batches = [] } = useQuery({ queryKey: ['batches'], queryFn: api.getBatches });
  
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
  
  const handleSubstituteButtonClick = (e: React.MouseEvent, assignment: ClassAssignment) => {
    e.stopPropagation();
    if (onFindSubstitute) {
      onFindSubstitute(assignment);
    }
  };

  const viewDateStr = toYyyyMmDd(viewDate);

  return (
    <div className="overflow-x-auto relative printable-area">
      <div className="grid grid-cols-[auto_repeat(6,minmax(120px,1fr))] gap-1 min-w-[900px]" style={{ gridTemplateColumns: `auto repeat(${workingDays.length}, minmax(120px, 1fr))` }}>
        {/* Header */}
        <div className="sticky top-0 left-0 z-20 bg-panel/80 backdrop-blur-sm" />
        {workingDays.map(day => (
          <div key={day} className="text-center font-bold text-white p-2 sticky top-0 z-10 bg-panel/80 backdrop-blur-sm text-sm sm:text-base">
            {day}
          </div>
        ))}

        {/* Body */}
        {timeSlots.map((slot, slotIndex) => (
          <React.Fragment key={slot}>
            <div className="text-right text-text-muted p-2 text-xs sticky left-0 z-10 bg-panel/80 backdrop-blur-sm flex items-center justify-end font-mono">
              <span>{slot}</span>
            </div>
            {workingDaysIndices.map((dayIndex) => {
              const assignment = timetableData.timetable[dayIndex]?.[slotIndex];
              const assignmentConflicts = assignment ? conflictMap.get(assignment.id) : undefined;
              
              const activeSubstitution = assignment ? substitutions.find(sub => 
                  sub.originalAssignmentId === assignment.id &&
                  viewDateStr >= sub.startDate &&
                  viewDateStr <= sub.endDate
              ) : undefined;
              
              const batchColor = assignment ? batchColorMap.get(assignment.batchId) || '' : '';
              
              let displaySubject = assignment ? subjects.find(s => s.id === assignment.subjectId) : null;
              let displayFaculty = assignment ? faculty.filter(f => assignment.facultyIds.includes(f.id)) : [];
              
              if (activeSubstitution && assignment) {
                  // In a substitution, one original faculty is replaced by the substitute.
                  displayFaculty = faculty.filter(f => 
                      (assignment.facultyIds.includes(f.id) && f.id !== activeSubstitution.originalFacultyId) || 
                      f.id === activeSubstitution.substituteFacultyId
                  );
              }
              
              return (
                <div 
                  key={`${dayIndex}-${slotIndex}`} 
                  className="h-28 bg-panel-strong border border-transparent hover:border-accent/20 transition-colors relative group"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, dayIndex, slotIndex)}
                >
                  {assignment && displayFaculty.length > 0 && (
                      <div
                        draggable={isEditable}
                        onDragStart={(e) => handleDragStart(e, assignment)}
                        className="w-full h-full"
                      >
                          <GlassPanel 
                            title={activeSubstitution ? `Original Teachers: ${faculty.filter(f => assignment.facultyIds.includes(f.id)).map(f => f.name).join(', ')}` : ''}
                            className={`h-full w-full p-2 flex flex-col justify-between text-left text-xs relative overflow-hidden transition-all duration-200 border
                            ${isEditable ? 'cursor-grab active:cursor-grabbing' : ''}
                            ${assignmentConflicts ? 'border-2 border-danger shadow-lg shadow-danger/20' : activeSubstitution ? 'border-2 border-teal-500/80' : batchColor }
                            ${draggingItem?.id === assignment.id ? 'opacity-50 scale-95' : ''}`}
                          >
                            {/* NEW: Add a subtle pulsing background overlay for conflicting assignments to make them more prominent. */}
                            {assignmentConflicts && (
                                <div className="absolute inset-0 animate-pulse-bg-danger rounded-xl pointer-events-none" />
                            )}
                            {activeSubstitution && (
                              <div className="absolute top-1 left-1 flex items-center gap-1 text-teal-400 bg-teal-900/50 px-1.5 py-0.5 rounded-full text-[10px] font-bold z-10">
                                  <UserCheck size={10}/>
                                  <span>SUB</span>
                              </div>
                            )}
                            <div className="flex-1 relative z-10">
                              <p className="font-bold text-white truncate">{displaySubject?.name || 'Unknown'}</p>
                              <p className="text-text-muted truncate" title={displayFaculty.map(f => f.name).join(', ')}>{displayFaculty.map(f => f.name).join(', ') || 'Unknown'}</p>
                              <p className="text-text-muted truncate">@{rooms.find(r => r.id === assignment.roomId)?.name || 'Unknown'}</p>
                              { (timetableData.batchIds.length > 1 || timetableData.batchIds.length === 0) && (
                                  <p className="text-[var(--accent)] text-xs truncate mt-1">{getBatchForAssignment(assignment)?.name || 'Unknown'}</p>
                              )};
                            </div>
                            <div className="absolute top-1 right-1 flex items-center gap-1 z-10">
                              {/* FIX: Added a detailed tooltip to the conflict icon for better UX. */}
                              {assignmentConflicts && (
                                <div className="relative group/tooltip">
                                  <AlertTriangle className="text-danger animate-pulse-danger" size={16} />
                                  <div className="absolute bottom-full mb-2 right-0 w-max max-w-xs px-3 py-2 text-xs text-white bg-panel-strong rounded-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-20 border border-[var(--border)] shadow-lg">
                                    <ul className="list-disc list-inside space-y-1 text-left">
                                      {assignmentConflicts.map((c, i) => <li key={i}>{c.message}</li>)}
                                    </ul>
                                  </div>
                                </div>
                              )}
                              {isEditable && <GripVertical className="text-text-muted/20 group-hover:text-text-muted" size={16} />}
                            </div>
                            {onFindSubstitute && assignment.facultyIds.length === 1 && (
                                <button
                                    onClick={(e) => handleSubstituteButtonClick(e, assignment)}
                                    className="absolute bottom-1 right-1 z-10 p-1.5 rounded-md bg-panel-strong/50 hover:bg-panel text-text-muted hover:text-accent opacity-0 group-hover:opacity-100 transition-all duration-200"
                                    title={activeSubstitution ? "Change Substitute" : "Find Substitute"}
                                >
                                    <Replace size={14} />
                                </button>
                            )}
                          </GlassPanel>
                      </div>
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
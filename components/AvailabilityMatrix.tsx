import React, { useState, useEffect, useCallback } from 'react';
import { DAYS_OF_WEEK } from '../constants';
import { useAppContext } from '../hooks/useAppContext';
import { Check, Plus } from 'lucide-react';

interface AvailabilityMatrixProps {
  availability: Record<number, number[]>; // day -> slots[]
  onChange: (newAvailability: Record<number, number[]>) => void;
}

export const AvailabilityMatrix: React.FC<AvailabilityMatrixProps> = ({ availability, onChange }) => {
  const { timeSlots } = useAppContext();
  const [localAvailability, setLocalAvailability] = useState(availability);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'available' | 'unavailable' | null>(null);

  // Sync with parent state when the selected faculty changes
  useEffect(() => {
    setLocalAvailability(availability || {});
  }, [availability]);

  // A memoized function to update a single cell's state locally
  const updateCellState = useCallback((day: number, slot: number, makeAvailable: boolean) => {
    setLocalAvailability(prev => {
      const newAvailability = JSON.parse(JSON.stringify(prev));
      if (!newAvailability[day]) {
        newAvailability[day] = [];
      }
      const slotIndex = newAvailability[day].indexOf(slot);
      const isCurrentlyAvailable = slotIndex > -1;

      // Only update if the state is different from what's intended
      if (makeAvailable && !isCurrentlyAvailable) {
        newAvailability[day].push(slot);
        newAvailability[day].sort((a: number, b: number) => a - b);
      } else if (!makeAvailable && isCurrentlyAvailable) {
        newAvailability[day].splice(slotIndex, 1);
      } else {
        return prev; // No change needed, return the original state
      }
      return newAvailability;
    });
  }, []);

  const handleMouseDown = (day: number, slot: number) => {
    setIsDragging(true);
    const isCurrentlyAvailable = localAvailability?.[day]?.includes(slot);
    const newDragMode = isCurrentlyAvailable ? 'unavailable' : 'available';
    setDragMode(newDragMode);
    updateCellState(day, slot, newDragMode === 'available');
  };

  const handleMouseEnter = (day: number, slot: number) => {
    if (isDragging && dragMode) {
      updateCellState(day, slot, dragMode === 'available');
    }
  };

  // Finalize changes on mouse up, anywhere on the page
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      // The localAvailability is now up-to-date from the drag operation
      // We pass this final state up to the parent to trigger the save.
      onChange(localAvailability);
      setIsDragging(false);
      setDragMode(null);
    }
  }, [isDragging, localAvailability, onChange]);

  useEffect(() => {
    // Listen for mouseup globally to end the drag session
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseUp]);


  return (
    <div className="overflow-x-auto" onMouseLeave={isDragging ? handleMouseUp : undefined}>
      <div className="grid grid-cols-[auto_repeat(6,minmax(100px,1fr))] gap-1 min-w-[700px] select-none">
        {/* Header */}
        <div />
        {DAYS_OF_WEEK.map(day => (
          <div key={day} className="text-center font-semibold text-white p-2 text-sm sticky top-0 bg-panel z-10">
            {day}
          </div>
        ))}

        {/* Body */}
        {timeSlots.map((slot, slotIndex) => (
          <React.Fragment key={slot}>
            <div className="text-right text-text-muted p-2 text-xs flex items-center justify-end font-mono sticky left-0 bg-panel z-10">
              <span>{slot}</span>
            </div>
            {DAYS_OF_WEEK.map((_, dayIndex) => {
              const isAvailable = localAvailability?.[dayIndex]?.includes(slotIndex);
              return (
                <div
                  key={`${dayIndex}-${slotIndex}`}
                  onMouseDown={() => handleMouseDown(dayIndex, slotIndex)}
                  onMouseEnter={() => handleMouseEnter(dayIndex, slotIndex)}
                  className={`group h-16 flex items-center justify-center rounded-lg transition-all duration-150 cursor-pointer border
                    ${
                      isAvailable 
                        ? 'bg-green-500/20 border-green-500/40' 
                        : 'bg-panel/50 border-transparent hover:bg-white/10 hover:border-dashed hover:border-text-muted/30'
                    }`
                  }
                >
                  {isAvailable ? (
                    <div className="text-center">
                      <Check className="mx-auto h-5 w-5 text-green-400" />
                      <span className="text-xs text-green-400/80">Available</span>
                    </div>
                  ) : (
                    <div className="text-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <Plus className="mx-auto h-5 w-5 text-text-muted" />
                       <span className="text-xs text-text-muted">Set</span>
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
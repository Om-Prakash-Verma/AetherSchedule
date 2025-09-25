import React from 'react';
import { DAYS_OF_WEEK, TIME_SLOTS } from '../constants';

interface AvailabilityMatrixProps {
  availability: Record<number, number[]>; // day -> slots[]
  onChange: (newAvailability: Record<number, number[]>) => void;
}

export const AvailabilityMatrix: React.FC<AvailabilityMatrixProps> = ({ availability, onChange }) => {

  const handleToggle = (day: number, slot: number) => {
    const newAvailability = JSON.parse(JSON.stringify(availability || {}));
    if (!newAvailability[day]) {
      newAvailability[day] = [];
    }
    const slotIndex = newAvailability[day].indexOf(slot);
    if (slotIndex > -1) {
      newAvailability[day].splice(slotIndex, 1);
    } else {
      newAvailability[day].push(slot);
      newAvailability[day].sort((a:number, b:number) => a-b);
    }
    onChange(newAvailability);
  };

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-[auto_repeat(6,minmax(60px,1fr))] gap-1 min-w-[500px]">
        {/* Header */}
        <div />
        {DAYS_OF_WEEK.map(day => (
          <div key={day} className="text-center font-semibold text-white p-2 text-xs sm:text-sm">
            {day.substring(0,3)}
          </div>
        ))}

        {/* Body */}
        {TIME_SLOTS.map((slot, slotIndex) => (
          <React.Fragment key={slot}>
            <div className="text-right text-text-muted p-2 text-xs flex items-center justify-end">
              <span>{slot.split(' ')[0]}</span>
            </div>
            {DAYS_OF_WEEK.map((_, dayIndex) => {
              const isAvailable = availability?.[dayIndex]?.includes(slotIndex);
              return (
                <div key={`${dayIndex}-${slotIndex}`} className="h-12 flex items-center justify-center">
                  <button
                    onClick={() => handleToggle(dayIndex, slotIndex)}
                    className={`w-10 h-10 rounded-md transition-colors ${
                      isAvailable ? 'bg-green-500/30 hover:bg-green-500/50' : 'bg-panel/75 hover:bg-white/10'
                    }`}
                    title={`Day: ${dayIndex}, Slot: ${slotIndex}, Available: ${isAvailable ? 'Yes' : 'No'}`}
                  />
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

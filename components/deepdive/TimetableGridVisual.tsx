import React from 'react';
import { cn } from '../../utils/cn';

export const TimetableGridVisual: React.FC<{ slots: (number | null)[]; highlight?: number | number[]; className?: string }> = ({ slots, highlight, className }) => (
    <div className={cn("grid grid-cols-5 gap-1 p-2 bg-panel rounded-md transition-all duration-300", className)}>
        {slots.map((slot, i) => {
            const isHighlighted = Array.isArray(highlight) ? highlight.includes(i) : highlight === i;
            return (
                <div key={i} className={cn(
                    'h-4 w-4 rounded-sm transition-all duration-300',
                    slot === 1 ? 'bg-accent/80' : slot === 2 ? 'bg-green-500/80' : 'bg-panel-strong',
                    isHighlighted && 'ring-2 ring-yellow-400 scale-125'
                )} />
            );
        })}
    </div>
);

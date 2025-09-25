import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { ChevronDown, Check } from 'lucide-react';

interface MultiSelectDropdownProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({ label, options, selected, onChange }) => {
  const handleSelect = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter(item => item !== value)
      : [...selected, value];
    onChange(newSelected);
  };
  
  const selectedLabels = options
    .filter(opt => selected.includes(opt.value))
    .map(opt => opt.label)
    .join(', ');

  return (
    <div>
        <label className="block text-sm font-medium text-text-muted mb-1">{label}</label>
        <Popover>
        <PopoverTrigger asChild>
            <button type="button" className="glass-input w-full flex justify-between items-center text-left">
                <span className="truncate pr-2">{selectedLabels || `Select ${label}...`}</span>
                <ChevronDown className="h-4 w-4 text-text-muted shrink-0"/>
            </button>
        </PopoverTrigger>
        <PopoverContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
            {options.map(option => (
                <label key={option.value} className="flex items-center space-x-3 text-sm text-white cursor-pointer p-2 rounded-md hover:bg-white/10">
                <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => handleSelect(option.value)}
                    className="h-4 w-4 rounded border-gray-300 text-[var(--accent)] focus:ring-[var(--accent)] accent-[var(--accent)] bg-panel"
                />
                <span>{option.label}</span>
                </label>
            ))}
            </div>
        </PopoverContent>
        </Popover>
    </div>
  );
};
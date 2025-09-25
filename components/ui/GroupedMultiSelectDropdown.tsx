import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { ChevronDown } from 'lucide-react';
import { GlassButton } from '../GlassButton';

interface Option {
    value: string;
    label: string;
}

interface GroupedOption {
    label: string;
    options: Option[];
}

interface GroupedMultiSelectDropdownProps {
  label: string;
  groupedOptions: GroupedOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export const GroupedMultiSelectDropdown: React.FC<GroupedMultiSelectDropdownProps> = ({ label, groupedOptions, selected, onChange }) => {
  const handleSelect = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter(item => item !== value)
      : [...selected, value];
    onChange(newSelected);
  };
  
  const allOptionValues = groupedOptions.flatMap(g => g.options.map(o => o.value));
  const areAllSelected = allOptionValues.length > 0 && selected.length === allOptionValues.length;

  const handleToggleSelectAll = () => {
    if (areAllSelected) {
      onChange([]);
    } else {
      onChange(allOptionValues);
    }
  };

  const selectedCount = selected.length;

  return (
    <div>
        <label className="block text-sm font-medium text-text-muted mb-1">{label}</label>
        <Popover>
        <PopoverTrigger asChild>
            <button type="button" className="glass-input w-full flex justify-between items-center text-left">
                <span className="truncate pr-2">
                    {selectedCount > 0 ? `${selectedCount} batch(es) selected` : `Select ${label}...`}
                </span>
                <ChevronDown className="h-4 w-4 text-text-muted shrink-0"/>
            </button>
        </PopoverTrigger>
        <PopoverContent>
            <div>
              <div className="p-2 border-b border-[var(--border)]">
                <GlassButton 
                    variant="secondary" 
                    className="w-full text-xs py-1.5 bg-panel hover:bg-white/10"
                    onClick={handleToggleSelectAll}
                >
                  {areAllSelected ? 'Deselect All' : 'Select All'}
                </GlassButton>
              </div>
              <div className="p-2 space-y-2 max-h-60 overflow-y-auto">
              {groupedOptions.map(group => (
                  <div key={group.label}>
                      <h4 className="text-xs font-bold text-text-muted uppercase px-2 pt-2">{group.label}</h4>
                      {group.options.map(option => (
                          <label key={option.value} className="flex items-center space-x-3 text-sm text-white cursor-pointer p-2 rounded-md hover:bg-panel">
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
              ))}
              </div>
            </div>
        </PopoverContent>
        </Popover>
    </div>
  );
};
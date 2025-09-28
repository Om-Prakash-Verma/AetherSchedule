import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SelectionModal } from './SelectionModal';

interface MultiSelectDropdownProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({ label, options, selected, onChange }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const getTriggerLabel = () => {
    if (selected.length === 0) {
      return `Select ${label}...`;
    }
    if (selected.length === 1) {
        const selectedOption = options.find(opt => opt.value === selected[0]);
        return selectedOption ? selectedOption.label : '1 item selected';
    }
    return `${selected.length} items selected`;
  };

  const handleConfirm = (newSelected: string[]) => {
    onChange(newSelected);
    setIsModalOpen(false);
  };

  return (
    <div>
        <label className="block text-sm font-medium text-text-muted mb-1">{label}</label>
        <button type="button" onClick={() => setIsModalOpen(true)} className="glass-input w-full flex justify-between items-center text-left">
            <span className="truncate pr-2">{getTriggerLabel()}</span>
            <ChevronDown className="h-4 w-4 text-text-muted shrink-0"/>
        </button>

        <SelectionModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onConfirm={handleConfirm}
            options={options}
            initialValue={selected || []}
            mode="multi"
            title={`Select ${label}`}
        />
    </div>
  );
};

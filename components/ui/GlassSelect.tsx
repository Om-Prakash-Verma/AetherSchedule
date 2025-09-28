import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SelectionModal } from './SelectionModal';

interface GlassSelectOption {
  value: string | number;
  label: string;
}

interface GlassSelectProps {
  options: GlassSelectOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  className?: string;
}

export const GlassSelect: React.FC<GlassSelectProps> = ({ options, value, onChange, placeholder = 'Select an option', className }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const selectedOption = options.find(option => option.value === value);

  const handleConfirm = (selectedValue: string | number) => {
    onChange(selectedValue);
    setIsModalOpen(false);
  };

  return (
    <>
      <button type="button" onClick={() => setIsModalOpen(true)} className={`glass-input w-full flex justify-between items-center text-left ${className}`}>
        <span className="truncate pr-2">{selectedOption?.label || placeholder}</span>
        <ChevronDown className="h-4 w-4 text-text-muted shrink-0"/>
      </button>

      <SelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirm}
        options={options}
        initialValue={value}
        mode="single"
        title={placeholder}
      />
    </>
  );
};

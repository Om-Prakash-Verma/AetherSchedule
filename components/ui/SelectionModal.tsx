import React, { useState, useEffect, useMemo } from 'react';
import { GlassButton } from '../GlassButton';
import { Search } from 'lucide-react';
import { Modal } from './Modal';

interface Option {
  value: string | number;
  label: string;
}

interface SelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selected: any) => void;
  options: Option[];
  initialValue: string | number | string[];
  mode: 'single' | 'multi';
  title: string;
}

export const SelectionModal: React.FC<SelectionModalProps> = ({ isOpen, onClose, onConfirm, options, initialValue, mode, title }) => {
  const [selectedValue, setSelectedValue] = useState(initialValue);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedValue(initialValue);
      setSearchTerm('');
    }
  }, [initialValue, isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  const handleSelect = (value: string | number) => {
    if (mode === 'single') {
      setSelectedValue(value);
    } else {
      const currentSelected = (selectedValue as string[]) || [];
      const newSelected = currentSelected.includes(String(value))
        ? currentSelected.filter(item => item !== String(value))
        : [...currentSelected, String(value)];
      setSelectedValue(newSelected);
    }
  };
  
  const isSelected = (value: string | number) => {
      if (mode === 'single') {
          return selectedValue === value;
      }
      return (selectedValue as string[])?.includes(String(value));
  }

  const renderOption = (option: Option) => {
      if (mode === 'single') {
          return (
             <label key={String(option.value)} className="flex items-center space-x-3 text-sm text-[var(--text-white)] cursor-pointer p-2 rounded-md hover:bg-panel-strong">
                <input
                    type="radio"
                    name="selection-modal-option"
                    checked={isSelected(option.value)}
                    onChange={() => handleSelect(option.value)}
                    className="h-4 w-4 border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] accent-[var(--accent)] bg-panel"
                />
                <span className="truncate">{option.label}</span>
            </label>
          )
      }
      return (
         <label key={String(option.value)} className="flex items-center space-x-3 text-sm text-[var(--text-white)] cursor-pointer p-2 rounded-md hover:bg-panel-strong">
            <input
                type="checkbox"
                checked={isSelected(option.value)}
                onChange={() => handleSelect(option.value)}
                className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] accent-[var(--accent)] bg-panel"
            />
            <span className="truncate">{option.label}</span>
        </label>
      )
  }

  const footer = (
    <>
      <GlassButton type="button" variant="secondary" onClick={onClose}>Cancel</GlassButton>
      <GlassButton type="button" onClick={() => onConfirm(selectedValue)}>Confirm</GlassButton>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="glass-input w-full !py-1.5 pl-9 text-sm"
          />
        </div>
        <div className="space-y-1 overflow-y-auto max-h-64 pr-2">
          {filteredOptions.length > 0 ? filteredOptions.map(renderOption) : (
              <p className="text-center text-xs text-[var(--text-muted)] py-8">No results found.</p>
          )}
        </div>
      </div>
    </Modal>
  );
};
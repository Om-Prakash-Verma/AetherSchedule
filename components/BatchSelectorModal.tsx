import React, { useState, useEffect } from 'react';
import { GlassButton } from './GlassButton';
import { Modal } from './ui/Modal';

interface Option {
    value: string;
    label: string;
}

interface GroupedOption {
    label: string;
    options: Option[];
}

interface BatchSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selected: string[]) => void;
  groupedOptions: GroupedOption[];
  initialSelected: string[];
}

export const BatchSelectorModal: React.FC<BatchSelectorModalProps> = ({ isOpen, onClose, onConfirm, groupedOptions, initialSelected }) => {
    const [selected, setSelected] = useState(initialSelected);

    useEffect(() => {
        if (isOpen) {
            setSelected(initialSelected);
        }
    }, [initialSelected, isOpen]);

    const handleSelect = (value: string) => {
        const newSelected = selected.includes(value)
          ? selected.filter(item => item !== value)
          : [...selected, value];
        setSelected(newSelected);
    };
    
    const allOptionValues = groupedOptions.flatMap(g => g.options.map(o => o.value));
    const areAllSelected = allOptionValues.length > 0 && selected.length === allOptionValues.length;
  
    const handleToggleSelectAll = () => {
      if (areAllSelected) {
        setSelected([]);
      } else {
        setSelected(allOptionValues);
      }
    };

    const footer = (
      <>
        <GlassButton type="button" variant="secondary" onClick={onClose}>Cancel</GlassButton>
        <GlassButton type="button" onClick={() => onConfirm(selected)}>Confirm Selection</GlassButton>
      </>
    );

    return (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title="Select Batches to Schedule"
          footer={footer}
        >
            <div className="flex flex-col gap-4">
                <GlassButton 
                    variant="secondary" 
                    className="w-full text-sm py-2 bg-panel hover:bg-panel-strong"
                    onClick={handleToggleSelectAll}
                >
                  {areAllSelected ? 'Deselect All' : 'Select All'}
                </GlassButton>

                <div className="space-y-4 overflow-y-auto max-h-72 pr-2">
                    {groupedOptions.map(group => (
                        <div key={group.label}>
                            <h4 className="text-sm font-bold text-text-muted uppercase px-2 pt-2 mb-1">{group.label}</h4>
                            <div className="space-y-1">
                                {group.options.map(option => (
                                    <label key={option.value} className="flex items-center space-x-3 text-sm text-white cursor-pointer p-2 rounded-md hover:bg-panel-strong">
                                        <input
                                            type="checkbox"
                                            checked={selected.includes(option.value)}
                                            onChange={() => handleSelect(option.value)}
                                            className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] accent-[var(--accent)] bg-panel"
                                        />
                                        <span>{option.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
};
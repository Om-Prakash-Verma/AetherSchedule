import React from 'react';
import { MultiSelectDropdown } from '../../ui/MultiSelectDropdown';
import { FormProps } from './types';
import type { Faculty } from '../../../types';

export const FacultyForm: React.FC<FormProps<Faculty>> = ({ formData, handleChange, handleMultiSelectChange, subjects }) => {
    const subjectOptions = subjects.map(s => ({ value: s.id, label: `${s.code} - ${s.name}`}));
    
    return (
        <>
            <input name="name" placeholder="Name" value={formData.name || ''} onChange={handleChange} className="glass-input" required />
            <MultiSelectDropdown label="Subjects Taught" options={subjectOptions} selected={formData.subjectIds || []} onChange={(s) => handleMultiSelectChange('subjectIds', s)} />
        </>
    );
};

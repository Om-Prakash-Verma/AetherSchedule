import React from 'react';
import { GlassSelect } from '../../ui/GlassSelect';
import { FormProps } from './types';
import type { Subject } from '../../../types';

export const SubjectForm: React.FC<FormProps<Subject>> = ({ formData, handleChange, handleMultiSelectChange }) => {
    const handleSelectChange = (name: string, value: string | number) => {
        handleChange({ target: { name, value: String(value) } } as any);
    };

    return (
        <>
            <input name="code" placeholder="Code (e.g., CS301)" value={formData.code || ''} onChange={handleChange} className="glass-input" required />
            <input name="name" placeholder="Name" value={formData.name || ''} onChange={handleChange} className="glass-input" required />
            <GlassSelect 
                placeholder="Select Type" value={formData.type || ''}
                onChange={(value) => handleSelectChange('type', value)}
                options={[{ value: 'Theory', label: 'Theory'}, { value: 'Practical', label: 'Practical'}, { value: 'Workshop', label: 'Workshop'}]}
            />
            <input name="credits" type="number" placeholder="Credits" value={formData.credits || ''} onChange={handleChange} className="glass-input" required/>
            <input name="hoursPerWeek" type="number" placeholder="Hours/Week" value={formData.hoursPerWeek || ''} onChange={handleChange} className="glass-input" required/>
        </>
    );
};

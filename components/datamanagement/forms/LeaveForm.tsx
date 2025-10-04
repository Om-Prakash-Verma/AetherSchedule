import React from 'react';
import { GlassSelect } from '../../ui/GlassSelect';
import { FormProps } from './types';
import type { PlannedLeave } from '../../../types';

export const LeaveForm: React.FC<FormProps<PlannedLeave>> = ({ formData, handleChange, faculty }) => {
    const facultyOptions = faculty.map(f => ({ value: f.id, label: f.name }));
    
    const handleSelectChange = (name: string, value: string | number) => {
        handleChange({ target: { name, value: String(value) } } as any);
    };

    return (
        <>
            <GlassSelect placeholder="Select Faculty" value={formData.facultyId || ''} onChange={(v) => handleSelectChange('facultyId', v)} options={facultyOptions} />
            <input name="startDate" type="date" placeholder="Start Date" value={formData.startDate || ''} onChange={handleChange} className="glass-input" required />
            <input name="endDate" type="date" placeholder="End Date" value={formData.endDate || ''} onChange={handleChange} className="glass-input" required />
            <input name="reason" placeholder="Reason for leave" value={formData.reason || ''} onChange={handleChange} className="glass-input" required />
        </>
    );
};

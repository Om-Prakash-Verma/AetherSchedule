import React, { useMemo } from 'react';
import { GlassSelect } from '../../ui/GlassSelect';
import { ROLES } from '../../../constants';
import { FormProps } from './types';
import type { User } from '../../../types';
import { Info } from 'lucide-react';

export const UserForm: React.FC<FormProps<User>> = ({ formData, handleChange, batches, faculty, users }) => {
    const handleSelectChange = (name: string, value: string | number) => {
        handleChange({ target: { name, value: String(value) } } as any);
    };

    const unlinkedFacultyOptions = useMemo(() => {
        const linkedFacultyIds = users.filter(u => u.facultyId).map(u => u.facultyId);
        return faculty
            .filter(f => !linkedFacultyIds.includes(f.id) || f.id === formData.facultyId)
            .map(f => ({ value: f.id, label: f.name }));
    }, [faculty, users, formData]);

    return (
        <>
            <div className="mb-2 p-3 bg-accent/10 border border-accent/20 rounded-lg text-sm text-accent flex items-center gap-3">
                <Info size={18} />
                <span>Faculty, Student, and HOD accounts are created automatically.</span>
            </div>
            <input name="name" placeholder="Full Name" value={formData.name || ''} onChange={handleChange} className="glass-input" required />
            <input name="email" type="email" placeholder="Email Address" value={formData.email || ''} onChange={handleChange} className="glass-input" required />
            <GlassSelect
                placeholder="Select Role" value={formData.role || ''}
                onChange={(value) => handleSelectChange('role', value)}
                options={ROLES.filter(r => ['SuperAdmin', 'TimetableManager'].includes(r)).map(role => ({ value: role, label: role }))}
            />
            {formData.role === 'Student' && (
                <GlassSelect placeholder="Select Batch" value={formData.batchId || ''} onChange={(value) => handleSelectChange('batchId', value)} options={batches.map(batch => ({ value: batch.id, label: batch.name }))} />
            )}
            {formData.role === 'Faculty' && (
                <GlassSelect placeholder="Link to Faculty Record" value={formData.facultyId || ''} onChange={(value) => handleSelectChange('facultyId', value)} options={unlinkedFacultyOptions} />
            )}
        </>
    );
};

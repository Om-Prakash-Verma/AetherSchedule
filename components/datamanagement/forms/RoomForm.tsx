import React from 'react';
import { GlassSelect } from '../../ui/GlassSelect';
import { FormProps } from './types';
import type { Room } from '../../../types';

export const RoomForm: React.FC<FormProps<Room>> = ({ formData, handleChange }) => {
    const handleSelectChange = (name: string, value: string | number) => {
        handleChange({ target: { name, value: String(value) } } as any);
    };
    
    return (
        <>
            <input name="name" placeholder="Name (e.g., LH-1)" value={formData.name || ''} onChange={handleChange} className="glass-input" required />
            <GlassSelect
                placeholder="Select Type" value={formData.type || ''}
                onChange={(value) => handleSelectChange('type', value)}
                options={[{ value: 'Lecture Hall', label: 'Lecture Hall'}, { value: 'Lab', label: 'Lab'}, { value: 'Workshop', label: 'Workshop'}]}
            />
            <input name="capacity" type="number" placeholder="Capacity" value={formData.capacity || ''} onChange={handleChange} className="glass-input" required/>
        </>
    );
};

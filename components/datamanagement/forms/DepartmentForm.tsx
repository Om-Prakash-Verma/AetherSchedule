import React from 'react';
import { FormProps } from './types';
import type { Department } from '../../../types';

export const DepartmentForm: React.FC<FormProps<Department>> = ({ formData, handleChange }) => {
    return (
        <>
            <input name="code" placeholder="Code (e.g., CS)" value={formData.code || ''} onChange={handleChange} className="glass-input" required />
            <input name="name" placeholder="Name" value={formData.name || ''} onChange={handleChange} className="glass-input" required />
        </>
    );
};

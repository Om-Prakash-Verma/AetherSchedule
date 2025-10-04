import React, { useMemo } from 'react';
import { GlassSelect } from '../../ui/GlassSelect';
import { MultiSelectDropdown } from '../../ui/MultiSelectDropdown';
import { DAYS_OF_WEEK } from '../../../constants';
import { FormProps } from './types';
import type { PinnedAssignment } from '../../../types';
import { generateTimeSlots } from '../../../utils/time';

export const PinnedAssignmentForm: React.FC<FormProps<PinnedAssignment>> = ({ formData, handleChange, handleMultiSelectChange, subjects, faculty, rooms, batches, settings }) => {
    const timeSlots = useMemo(() => settings?.timetableSettings ? generateTimeSlots(settings.timetableSettings) : [], [settings]);

    const subjectOptions = subjects.map(s => ({ value: s.id, label: `${s.code} - ${s.name}`}));
    const facultyOptions = faculty.map(f => ({ value: f.id, label: f.name }));
    const roomOptions = rooms.map(r => ({ value: r.id, label: r.name }));
    const batchOptions = batches.map(b => ({ value: b.id, label: b.name }));

    const handleSelectChange = (name: string, value: string | number) => {
        handleChange({ target: { name, value: String(value) } } as any);
    };
    
    return (
        <>
            <input name="name" placeholder="Event Name (e.g., Placement Talk)" value={formData.name || ''} onChange={handleChange} className="glass-input" required />
            <GlassSelect placeholder="Select Batch" value={formData.batchId || ''} onChange={(v) => handleSelectChange('batchId', v)} options={batchOptions} />
            <GlassSelect placeholder="Select Subject" value={formData.subjectId || ''} onChange={(v) => handleSelectChange('subjectId', v)} options={subjectOptions} />
            <GlassSelect placeholder="Select Faculty" value={formData.facultyId || ''} onChange={(v) => handleSelectChange('facultyId', v)} options={facultyOptions} />
            <GlassSelect placeholder="Select Room" value={formData.roomId || ''} onChange={(v) => handleSelectChange('roomId', v)} options={roomOptions} />
            <MultiSelectDropdown label="Select Day(s)" options={DAYS_OF_WEEK.map((d,i)=>({value: String(i), label: d}))} selected={formData.days?.map(String) || []} onChange={(s) => handleMultiSelectChange('days', s)} />
            <MultiSelectDropdown label="Select Start Time(s)" options={timeSlots.map((t,i)=>({value: String(i), label: t}))} selected={formData.startSlots?.map(String) || []} onChange={(s) => handleMultiSelectChange('startSlots', s)} />
            <input name="duration" type="number" placeholder="Duration (in slots)" value={formData.duration || ''} onChange={handleChange} className="glass-input" required/>
        </>
    );
};

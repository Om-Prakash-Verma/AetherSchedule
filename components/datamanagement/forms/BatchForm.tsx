import React, { useMemo } from 'react';
import { GlassSelect } from '../../ui/GlassSelect';
import { MultiSelectDropdown } from '../../ui/MultiSelectDropdown';
import { FormProps } from './types';
import type { Batch, Subject } from '../../../types';

export const BatchForm: React.FC<FormProps<Batch>> = ({ formData, handleChange, handleMultiSelectChange, handleAllocationChange, subjects, departments, rooms, faculty }) => {
    
    const subjectOptions = subjects.map(s => ({ value: s.id, label: `${s.code} - ${s.name}`}));
    const roomOptions = rooms.map(r => ({ value: r.id, label: r.name }));
    const departmentOptions = departments.map(d => ({ value: d.id, label: d.name }));
    
    const allocatedSubjects = useMemo(() => {
        if (!formData.subjectIds) return [];
        return subjects.filter(s => formData.subjectIds!.includes(s.id));
    }, [formData.subjectIds, subjects]);

    const getQualifiedFacultyForSubject = (subjectId: string) => {
        return faculty.filter(f => f.subjectIds.includes(subjectId)).map(f => ({ value: f.id, label: f.name }));
    }

    const handleSelectChange = (name: string, value: string | number) => {
        handleChange({ target: { name, value: String(value) } } as any);
    };

    return (
        <>
            <input name="name" placeholder="Name (e.g., CS S5 A)" value={formData.name || ''} onChange={handleChange} className="glass-input" required />
            <GlassSelect placeholder="Select Department" value={formData.departmentId || ''} onChange={(value) => handleSelectChange('departmentId', value)} options={departmentOptions}/>
            <input name="semester" type="number" placeholder="Semester" value={formData.semester || ''} onChange={handleChange} className="glass-input" required/>
            <input name="studentCount" type="number" placeholder="Student Count" value={formData.studentCount || ''} onChange={handleChange} className="glass-input" required/>
            <MultiSelectDropdown label="Curriculum Subjects" options={subjectOptions} selected={formData.subjectIds || []} onChange={(s) => handleMultiSelectChange('subjectIds', s)} />
            <MultiSelectDropdown label="Allocated Rooms (Optional)" options={roomOptions} selected={formData.allocatedRoomIds || []} onChange={(s) => handleMultiSelectChange('allocatedRoomIds', s)} />
            <p className="text-xs text-text-muted -mt-3 pl-1">If set, the AI will only use these rooms for this batch.</p>

            {allocatedSubjects.length > 0 && handleAllocationChange && (
                <div className="pt-4 mt-4 border-t border-[var(--border)]">
                    <h3 className="text-lg font-semibold text-white mb-2">Faculty Allocations</h3>
                    <p className="text-sm text-text-muted mb-4">Assign faculty for each subject. For labs, you can select multiple teachers.</p>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {allocatedSubjects.map((subject: Subject) => {
                            const qualifiedFaculty = getQualifiedFacultyForSubject(subject.id);
                            return (
                                <div key={subject.id} className="grid grid-cols-[1fr,1.2fr] gap-4 items-center">
                                    <label className="font-medium text-white truncate text-sm" title={subject.name}>{subject.name} {subject.type === 'Practical' && <span className="text-xs text-text-muted ml-1">(Lab)</span>}</label>
                                    {subject.type === 'Practical' ? (
                                        <MultiSelectDropdown label="" options={qualifiedFaculty} selected={(formData as any).allocations?.[subject.id] || []} onChange={(value) => handleAllocationChange(subject.id, value)} />
                                    ) : (
                                        <GlassSelect placeholder="Auto-Assign" value={(formData as any).allocations?.[subject.id] || ''} onChange={(value) => handleAllocationChange(subject.id, value)} options={qualifiedFaculty} />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </>
    );
};

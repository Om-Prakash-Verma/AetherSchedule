import React, { useState, useEffect, useMemo } from 'react';
import { GlassButton } from './GlassButton';
import { useAppContext } from '../hooks/useAppContext';
import { MultiSelectDropdown } from './ui/MultiSelectDropdown';
import { ROLES, DAYS_OF_WEEK } from '../constants';
import { useToast } from '../hooks/useToast';
import { GlassSelect } from './ui/GlassSelect';
import { Modal } from './ui/Modal';
import type { Subject } from '../types';

type DataType = 'subjects' | 'faculty' | 'rooms' | 'batches' | 'departments' | 'users' | 'pinned' | 'leaves';

interface DataFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: any) => void;
  dataType: DataType;
  initialData?: any | null;
}

export const DataFormModal: React.FC<DataFormModalProps> = ({ isOpen, onClose, onSave, dataType, initialData }) => {
  const { subjects, departments, faculty, rooms, batches, timeSlots, facultyAllocations } = useAppContext();
  const [formData, setFormData] = useState<any>({});
  const toast = useToast();
  
  useEffect(() => {
    const data = initialData || {};
    if (dataType === 'users' && data.role !== 'Student') {
        delete data.batchId;
    }
     // When editing a batch, preload its existing faculty allocations into the form state.
    if (dataType === 'batches' && data.id) {
        const existingAllocations = facultyAllocations.filter(fa => fa.batchId === data.id);
        const allocationsMap = existingAllocations.reduce((acc, curr) => {
            // Find the subject to check if it's a practical/lab
            const subject = subjects.find(s => s.id === curr.subjectId);
            // If it's a lab, the value is an array. Otherwise, it's the first (and only) ID.
            acc[curr.subjectId] = subject?.type === 'Practical' ? curr.facultyIds : (curr.facultyIds[0] || '');
            return acc;
        }, {} as Record<string, string | string[]>);
        data.allocations = allocationsMap;
    }

    setFormData(data);
  }, [initialData, isOpen, dataType, facultyAllocations, subjects]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    if (type === 'number') {
        finalValue = value === '' ? '' : Number(value);
    }
    
    const newFormData = { ...formData, [name]: finalValue };

    if (name === 'role' && value !== 'Student') {
        delete newFormData.batchId;
    }

    setFormData(newFormData);
  };

  const handleSelectChange = (name: string, value: string | number) => {
    handleChange({
      target: { name, value: String(value) }
    } as React.ChangeEvent<HTMLSelectElement>);
  };
  
  const handleMultiSelectChange = (name: string, selected: string[]) => {
      if (name === 'days' || name === 'startSlots') {
          const numericValues = selected.map(Number).sort((a,b) => a - b);
          setFormData({ ...formData, [name]: numericValues });
      } else {
        setFormData({ ...formData, [name]: selected });
      }
  }

  const handleAllocationChange = (subjectId: string, value: string | number | string[]) => {
      setFormData((prev: any) => ({
          ...prev,
          allocations: {
              ...prev.allocations,
              [subjectId]: value,
          }
      }))
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (dataType === 'faculty' && (!formData.subjectIds || formData.subjectIds.length === 0)) {
        toast.error('Please assign at least one subject to the faculty member.');
        return;
    }

    const dataToSave = { ...formData };

    // Normalize faculty allocations before saving
    if (dataType === 'batches' && dataToSave.allocations) {
        const finalAllocations: Record<string, string[]> = {};
        for (const [subjectId, value] of Object.entries(dataToSave.allocations)) {
            if (Array.isArray(value)) {
                finalAllocations[subjectId] = value;
            } else if (value) { // A single string from GlassSelect
                finalAllocations[subjectId] = [String(value)];
            }
        }
        dataToSave.allocations = finalAllocations;
    }


    if (!initialData?.id) {
        const prefix = dataType === 'pinned' ? 'pin' : dataType === 'leaves' ? 'leave' : dataType.slice(0, 1);
        dataToSave.id = `${prefix}_${Date.now()}`;
    }
    onSave(dataToSave);
  };
  
  const subjectOptions = subjects.map(s => ({ value: s.id, label: `${s.code} - ${s.name}`}));
  const facultyOptions = faculty.map(f => ({ value: f.id, label: f.name }));
  const roomOptions = rooms.map(r => ({ value: r.id, label: r.name }));
  const batchOptions = batches.map(b => ({ value: b.id, label: b.name }));
  const departmentOptions = departments.map(d => ({ value: d.id, label: d.name }));

  const allocatedSubjects = useMemo(() => {
    if (dataType !== 'batches' || !formData.subjectIds) return [];
    return subjects.filter(s => formData.subjectIds.includes(s.id));
  }, [dataType, formData.subjectIds, subjects]);

  const getQualifiedFacultyForSubject = (subjectId: string) => {
    return faculty.filter(f => f.subjectIds.includes(subjectId)).map(f => ({ value: f.id, label: f.name }));
  }


  const renderFields = () => {
    switch (dataType) {
      case 'subjects': return (
        <>
          <input name="code" placeholder="Code (e.g., CS301)" value={formData.code || ''} onChange={handleChange} className="glass-input" required />
          <input name="name" placeholder="Name" value={formData.name || ''} onChange={handleChange} className="glass-input" required />
          <GlassSelect 
            placeholder="Select Type"
            value={formData.type || ''}
            onChange={(value) => handleSelectChange('type', value)}
            options={[
              { value: 'Theory', label: 'Theory'},
              { value: 'Practical', label: 'Practical'},
              { value: 'Workshop', label: 'Workshop'},
            ]}
          />
          <input name="credits" type="number" placeholder="Credits" value={formData.credits || ''} onChange={handleChange} className="glass-input" required/>
          <input name="hoursPerWeek" type="number" placeholder="Hours/Week" value={formData.hoursPerWeek || ''} onChange={handleChange} className="glass-input" required/>
        </>
      );
      case 'faculty':
        return (
        <>
          <input name="name" placeholder="Name" value={formData.name || ''} onChange={handleChange} className="glass-input" required />
          <MultiSelectDropdown label="Subjects Taught" options={subjectOptions} selected={formData.subjectIds || []} onChange={(s) => handleMultiSelectChange('subjectIds', s)} />
        </>
      );
      case 'rooms': return (
        <>
          <input name="name" placeholder="Name (e.g., LH-1)" value={formData.name || ''} onChange={handleChange} className="glass-input" required />
          <GlassSelect
            placeholder="Select Type"
            value={formData.type || ''}
            onChange={(value) => handleSelectChange('type', value)}
            options={[
              { value: 'Lecture Hall', label: 'Lecture Hall'},
              { value: 'Lab', label: 'Lab'},
              { value: 'Workshop', label: 'Workshop'},
            ]}
          />
          <input name="capacity" type="number" placeholder="Capacity" value={formData.capacity || ''} onChange={handleChange} className="glass-input" required/>
        </>
      );
      case 'batches': return (
        <>
          <input name="name" placeholder="Name (e.g., CS S5 A)" value={formData.name || ''} onChange={handleChange} className="glass-input" required />
          <GlassSelect
            placeholder="Select Department"
            value={formData.departmentId || ''}
            onChange={(value) => handleSelectChange('departmentId', value)}
            options={departmentOptions}
          />
          <input name="semester" type="number" placeholder="Semester" value={formData.semester || ''} onChange={handleChange} className="glass-input" required/>
          <input name="studentCount" type="number" placeholder="Student Count" value={formData.studentCount || ''} onChange={handleChange} className="glass-input" required/>
          <MultiSelectDropdown label="Curriculum Subjects" options={subjectOptions} selected={formData.subjectIds || []} onChange={(s) => handleMultiSelectChange('subjectIds', s)} />
          
          <MultiSelectDropdown label="Allocated Rooms (Optional)" options={roomOptions} selected={formData.allocatedRoomIds || []} onChange={(s) => handleMultiSelectChange('allocatedRoomIds', s)} />
          <p className="text-xs text-text-muted -mt-3 pl-1">If rooms are allocated, the AI will only use these specific rooms for this batch's classes.</p>

          {/* NEW: Faculty Allocation Section with multi-teacher support for labs */}
          {allocatedSubjects.length > 0 && (
              <div className="pt-4 mt-4 border-t border-[var(--border)]">
                  <h3 className="text-lg font-semibold text-white mb-2">Subject-Faculty Allocations</h3>
                  <p className="text-sm text-text-muted mb-4">Assign a specific faculty member for each subject. For labs, you can select multiple teachers.</p>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                      {allocatedSubjects.map((subject: Subject) => {
                          const qualifiedFaculty = getQualifiedFacultyForSubject(subject.id);
                          return (
                            <div key={subject.id} className="grid grid-cols-[1fr,1.2fr] gap-4 items-center">
                                <label className="font-medium text-white truncate text-sm" title={subject.name}>
                                    {subject.name}
                                    {subject.type === 'Practical' && <span className="text-xs text-text-muted ml-1">(Lab)</span>}
                                </label>
                                {subject.type === 'Practical' ? (
                                    <MultiSelectDropdown
                                        label={subject.name}
                                        options={qualifiedFaculty}
                                        selected={formData.allocations?.[subject.id] || []}
                                        onChange={(value) => handleAllocationChange(subject.id, value)}
                                    />
                                ) : (
                                    <GlassSelect
                                        placeholder="Auto-Assign"
                                        value={formData.allocations?.[subject.id] || ''}
                                        onChange={(value) => handleAllocationChange(subject.id, value)}
                                        options={qualifiedFaculty}
                                    />
                                )}
                            </div>
                        )
                      })}
                  </div>
              </div>
          )}
        </>
      );
      case 'departments': return (
        <>
          <input name="code" placeholder="Code (e.g., CS)" value={formData.code || ''} onChange={handleChange} className="glass-input" required />
          <input name="name" placeholder="Name" value={formData.name || ''} onChange={handleChange} className="glass-input" required />
        </>
      );
      case 'users': return (
          <>
            <input name="name" placeholder="Full Name" value={formData.name || ''} onChange={handleChange} className="glass-input" required />
            <input name="email" type="email" placeholder="Email Address" value={formData.email || ''} onChange={handleChange} className="glass-input" required />
            <GlassSelect
              placeholder="Select Role"
              value={formData.role || ''}
              onChange={(value) => handleSelectChange('role', value)}
              options={ROLES.map(role => ({ value: role, label: role }))}
            />
            {formData.role === 'Student' && (
                <GlassSelect
                  placeholder="Select Batch"
                  value={formData.batchId || ''}
                  onChange={(value) => handleSelectChange('batchId', value)}
                  options={batches.map(batch => ({ value: batch.id, label: batch.name }))}
                />
            )}
          </>
      );
      case 'pinned': return (
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
      case 'leaves': return (
          <>
             <GlassSelect placeholder="Select Faculty" value={formData.facultyId || ''} onChange={(v) => handleSelectChange('facultyId', v)} options={facultyOptions} />
             <input name="startDate" type="date" placeholder="Start Date" value={formData.startDate || ''} onChange={handleChange} className="glass-input" required />
             <input name="endDate" type="date" placeholder="End Date" value={formData.endDate || ''} onChange={handleChange} className="glass-input" required />
             <input name="reason" placeholder="Reason for leave" value={formData.reason || ''} onChange={handleChange} className="glass-input" required />
          </>
      );
      default: return null;
    }
  };

  const getTitle = () => {
      const action = initialData ? 'Edit' : 'Add';
      const typeName = dataType === 'pinned' ? 'Pinned Assignment' : dataType === 'leaves' ? 'Planned Leave' : dataType.charAt(0).toUpperCase() + dataType.slice(1, -1);
      return `${action} ${typeName}`;
  }

  const footer = (
    <>
      <GlassButton type="button" variant="secondary" onClick={onClose}>Cancel</GlassButton>
      <GlassButton type="submit" form="data-form">Save</GlassButton>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
      footer={footer}
      className={dataType === 'batches' ? 'max-w-2xl' : 'max-w-lg'}
    >
        <form id="data-form" onSubmit={handleSubmit} className="space-y-4">
          {renderFields()}
        </form>
    </Modal>
  );
};
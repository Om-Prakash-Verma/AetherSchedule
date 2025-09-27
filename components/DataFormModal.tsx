import React, { useState, useEffect } from 'react';
import { GlassButton } from './GlassButton';
import { X } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { MultiSelectDropdown } from './ui/MultiSelectDropdown';
import { ROLES, DAYS_OF_WEEK, TIME_SLOTS } from '../constants';
import { useToast } from '../hooks/useToast';

type DataType = 'subjects' | 'faculty' | 'rooms' | 'batches' | 'departments' | 'users' | 'pinned' | 'leaves';

interface DataFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: any) => void;
  dataType: DataType;
  initialData?: any | null;
}

export const DataFormModal: React.FC<DataFormModalProps> = ({ isOpen, onClose, onSave, dataType, initialData }) => {
  const { subjects, departments, faculty, rooms, batches, users } = useAppContext();
  const [formData, setFormData] = useState<any>({});
  const toast = useToast();
  
  useEffect(() => {
    // When opening, if the role is not student, ensure batchId is cleared.
    const data = initialData || {};
    if (dataType === 'users' && data.role !== 'Student') {
        delete data.batchId;
    }
    setFormData(data);
  }, [initialData, isOpen, dataType]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    if (type === 'number') {
        finalValue = value === '' ? '' : Number(value);
    }
    
    const newFormData = { ...formData, [name]: finalValue };

    // If the role is changed to something other than Student, remove the batchId
    if (name === 'role' && value !== 'Student') {
        delete newFormData.batchId;
    }

    setFormData(newFormData);
  };
  
  const handleMultiSelectChange = (name: string, selected: string[]) => {
      setFormData({ ...formData, [name]: selected });
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation for faculty subjects
    if (dataType === 'faculty' && (!formData.subjectIds || formData.subjectIds.length === 0)) {
        toast.error('Please assign at least one subject to the faculty member.');
        return;
    }

    const dataToSave = { ...formData };
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

  const renderFields = () => {
    switch (dataType) {
      case 'subjects': return (
        <>
          <input name="code" placeholder="Code (e.g., CS301)" value={formData.code || ''} onChange={handleChange} className="glass-input" required />
          <input name="name" placeholder="Name" value={formData.name || ''} onChange={handleChange} className="glass-input" required />
          <select name="type" value={formData.type || ''} onChange={handleChange} className="glass-input appearance-none" required>
            <option value="">Select Type</option> <option value="Theory">Theory</option> <option value="Practical">Practical</option> <option value="Workshop">Workshop</option>
          </select>
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
          <select name="type" value={formData.type || ''} onChange={handleChange} className="glass-input appearance-none" required>
            <option value="">Select Type</option> <option value="Lecture Hall">Lecture Hall</option> <option value="Lab">Lab</option> <option value="Workshop">Workshop</option>
          </select>
          <input name="capacity" type="number" placeholder="Capacity" value={formData.capacity || ''} onChange={handleChange} className="glass-input" required/>
        </>
      );
      case 'batches': return (
        <>
          <input name="name" placeholder="Name (e.g., CS S5 A)" value={formData.name || ''} onChange={handleChange} className="glass-input" required />
          <select name="departmentId" value={formData.departmentId || ''} onChange={handleChange} className="glass-input appearance-none" required>
            <option value="">Select Department</option> {departmentOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <input name="semester" type="number" placeholder="Semester" value={formData.semester || ''} onChange={handleChange} className="glass-input" required/>
          <input name="studentCount" type="number" placeholder="Student Count" value={formData.studentCount || ''} onChange={handleChange} className="glass-input" required/>
          <MultiSelectDropdown label="Subjects" options={subjectOptions} selected={formData.subjectIds || []} onChange={(s) => handleMultiSelectChange('subjectIds', s)} />
          <MultiSelectDropdown label="Allocated Faculty (Optional)" options={facultyOptions} selected={formData.allocatedFacultyIds || []} onChange={(s) => handleMultiSelectChange('allocatedFacultyIds', s)} />
          <MultiSelectDropdown label="Allocated Rooms (Optional)" options={roomOptions} selected={formData.allocatedRoomIds || []} onChange={(s) => handleMultiSelectChange('allocatedRoomIds', s)} />
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
            <select name="role" value={formData.role || ''} onChange={handleChange} className="glass-input appearance-none" required>
                <option value="">Select Role</option>
                {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
            </select>
            {formData.role === 'Student' && (
                <select name="batchId" value={formData.batchId || ''} onChange={handleChange} className="glass-input appearance-none" required>
                    <option value="">Select Batch</option>
                    {batches.map(batch => (
                        <option key={batch.id} value={batch.id}>{batch.name}</option>
                    ))}
                </select>
            )}
          </>
      );
      case 'pinned': return (
          <>
             <input name="name" placeholder="Event Name (e.g., Placement Talk)" value={formData.name || ''} onChange={handleChange} className="glass-input" required />
             <select name="batchId" value={formData.batchId || ''} onChange={handleChange} className="glass-input appearance-none" required><option value="">Select Batch</option>{batchOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
             <select name="subjectId" value={formData.subjectId || ''} onChange={handleChange} className="glass-input appearance-none" required><option value="">Select Subject</option>{subjectOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
             <select name="facultyId" value={formData.facultyId || ''} onChange={handleChange} className="glass-input appearance-none" required><option value="">Select Faculty</option>{facultyOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
             <select name="roomId" value={formData.roomId || ''} onChange={handleChange} className="glass-input appearance-none" required><option value="">Select Room</option>{roomOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
             <select name="day" value={formData.day ?? ''} onChange={handleChange} className="glass-input appearance-none" required><option value="">Select Day</option>{DAYS_OF_WEEK.map((d,i)=><option key={i} value={i}>{d}</option>)}</select>
             <select name="startSlot" value={formData.startSlot ?? ''} onChange={handleChange} className="glass-input appearance-none" required><option value="">Select Start Time</option>{TIME_SLOTS.map((t,i)=><option key={i} value={i}>{t}</option>)}</select>
             <input name="duration" type="number" placeholder="Duration (in slots)" value={formData.duration || ''} onChange={handleChange} className="glass-input" required/>
          </>
      );
      case 'leaves': return (
          <>
             <select name="facultyId" value={formData.facultyId || ''} onChange={handleChange} className="glass-input appearance-none" required><option value="">Select Faculty</option>{facultyOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-panel/95 backdrop-blur-xl border border-[var(--border)] rounded-xl shadow-lg w-full max-w-md m-4 animate-in fade-in-0 zoom-in-95 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-[var(--border)] flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-white">{getTitle()}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {renderFields()}
          <div className="flex justify-end gap-4 pt-4 sticky bottom-0 bg-panel/95 -mx-6 px-6 pb-6 -mb-6">
            <GlassButton type="button" variant="secondary" onClick={onClose}>Cancel</GlassButton>
            <GlassButton type="submit">Save</GlassButton>
          </div>
        </form>
      </div>
    </div>
  );
};
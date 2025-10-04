import React, { useState, useEffect, useMemo } from 'react';
import { GlassButton } from './GlassButton';
import { Modal } from './ui/Modal';
import { useQuery } from '@tanstack/react-query';
import * as api from '../services';
import { SubjectForm } from './datamanagement/forms/SubjectForm';
import { FacultyForm } from './datamanagement/forms/FacultyForm';
import { RoomForm } from './datamanagement/forms/RoomForm';
import { BatchForm } from './datamanagement/forms/BatchForm';
import { DepartmentForm } from './datamanagement/forms/DepartmentForm';
import { UserForm } from './datamanagement/forms/UserForm';
import { PinnedAssignmentForm } from './datamanagement/forms/PinnedAssignmentForm';
import { LeaveForm } from './datamanagement/forms/LeaveForm';
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
  const [formData, setFormData] = useState<any>({});
  const toast = useToast();

  // Fetch all necessary data for dropdowns/options within forms
  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: api.getSubjects });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: api.getDepartments });
  const { data: faculty = [] } = useQuery({ queryKey: ['faculty'], queryFn: api.getFaculty });
  const { data: rooms = [] } = useQuery({ queryKey: ['rooms'], queryFn: api.getRooms });
  const { data: batches = [] } = useQuery({ queryKey: ['batches'], queryFn: api.getBatches });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });
  const { data: facultyAllocations = [] } = useQuery({ queryKey: ['facultyAllocations'], queryFn: api.getFacultyAllocations });
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
  
  useEffect(() => {
    const data = initialData ? JSON.parse(JSON.stringify(initialData)) : {};
    // Pre-computation logic before setting form data
    if (dataType === 'batches' && data.id) {
        const existingAllocations = facultyAllocations.filter(fa => fa.batchId === data.id);
        data.allocations = existingAllocations.reduce((acc, curr) => {
            const subject = subjects.find(s => s.id === curr.subjectId);
            acc[curr.subjectId] = subject?.type === 'Practical' ? curr.facultyIds : (curr.facultyIds[0] || '');
            return acc;
        }, {} as Record<string, string | string[]>);
    }
    setFormData(data);
  }, [initialData, isOpen, dataType, facultyAllocations, subjects]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    if (type === 'number') finalValue = value === '' ? '' : Number(value);
    
    const newFormData = { ...formData, [name]: finalValue };
    if (name === 'role') {
        if (value !== 'Student') delete newFormData.batchId;
        if (value !== 'Faculty') delete newFormData.facultyId;
    }
    setFormData(newFormData);
  };
  
  const handleMultiSelectChange = (name: string, selected: string[]) => {
      const values = (name === 'days' || name === 'startSlots')
          ? selected.map(Number).sort((a,b) => a - b)
          : selected;
      setFormData({ ...formData, [name]: values });
  }

  const handleAllocationChange = (subjectId: string, value: string | number | string[]) => {
      setFormData((prev: any) => ({ ...prev, allocations: { ...prev.allocations, [subjectId]: value } }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (dataType === 'faculty' && (!formData.subjectIds || formData.subjectIds.length === 0)) {
        toast.error('Please assign at least one subject.'); return;
    }
    if (dataType === 'users' && users.some(u => u.email === formData.email && u.id !== formData.id)) {
        toast.error('A user with this email address already exists.'); return;
    }

    const dataToSave = { ...formData };
    if (dataType === 'batches' && dataToSave.allocations) {
        dataToSave.allocations = Object.entries(dataToSave.allocations).reduce((acc, [subjectId, value]) => {
            if (Array.isArray(value) ? value.length > 0 : value) {
                acc[subjectId] = Array.isArray(value) ? value : [String(value)];
            }
            return acc;
        }, {} as Record<string, string[]>);
    }
    if (!initialData?.id) {
        const prefix = dataType === 'pinned' ? 'pin' : dataType === 'leaves' ? 'leave' : dataType.slice(0, 1);
        dataToSave.id = `${prefix}_${Date.now()}`;
    }
    onSave(dataToSave);
  };
  
  const formProps = {
      formData,
      handleChange,
      handleMultiSelectChange,
      handleAllocationChange,
      subjects, faculty, rooms, batches, departments, users, settings
  };

  const renderForm = () => {
    switch (dataType) {
      case 'subjects': return <SubjectForm {...formProps} />;
      case 'faculty': return <FacultyForm {...formProps} />;
      case 'rooms': return <RoomForm {...formProps} />;
      case 'batches': return <BatchForm {...formProps} />;
      case 'departments': return <DepartmentForm {...formProps} />;
      case 'users': return <UserForm {...formProps} />;
      case 'pinned': return <PinnedAssignmentForm {...formProps} />;
      case 'leaves': return <LeaveForm {...formProps} />;
      default: return null;
    }
  };

  const getTitle = () => {
      const action = initialData ? 'Edit' : 'Add New';
      const typeName = dataType === 'pinned' ? 'Pinned Assignment' : dataType === 'leaves' ? 'Planned Leave' : (dataType.charAt(0).toUpperCase() + dataType.slice(1, -1));
      return `${action} ${typeName}`;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
      footer={<><GlassButton type="button" variant="secondary" onClick={onClose}>Cancel</GlassButton><GlassButton type="submit" form="data-form">Save</GlassButton></>}
      className={dataType === 'batches' ? 'max-w-2xl' : 'max-w-lg'}
    >
        <form id="data-form" onSubmit={handleSubmit} className="space-y-4">
          {renderForm()}
        </form>
    </Modal>
  );
};

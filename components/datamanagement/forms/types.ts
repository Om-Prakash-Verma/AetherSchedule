// FIX: Added 'React' import to resolve 'Cannot find namespace' error for React.ChangeEvent.
import React from 'react';
import type { Subject, Faculty, Room, Batch, Department, User, TimetableSettings } from '../../../types';

export interface FormProps<T> {
  formData: Partial<T>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleMultiSelectChange: (name: string, selected: string[]) => void;
  handleAllocationChange?: (subjectId: string, value: string | number | string[]) => void;
  // Data for dropdowns
  subjects: Subject[];
  faculty: Faculty[];
  rooms: Room[];
  batches: Batch[];
  departments: Department[];
  users: User[];
  settings?: { timetableSettings: TimetableSettings };
}
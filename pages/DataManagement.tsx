

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { GlassButton } from '../components/GlassButton';
import { PlusCircle, AlertTriangle, FileDown, FileUp, Users as UsersIcon } from 'lucide-react';
import { DataTable } from '../components/DataTable';
import { DataFormModal } from '../components/DataFormModal';
import * as api from '../services';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import type { Subject, Faculty, Room, Batch, Department, User } from '../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type DataType = 'subjects' | 'faculty' | 'rooms' | 'batches' | 'departments' | 'users';

const TABS: { id: DataType, label: string }[] = [
    { id: 'subjects', label: 'Subjects' },
    { id: 'faculty', label: 'Faculty' },
    { id: 'rooms', label: 'Rooms' },
    { id: 'batches', label: 'Batches' },
    { id: 'departments', label: 'Departments' },
    { id: 'users', label: 'Users' },
];

const DataManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<DataType>('subjects');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const toast = useToast();
    const confirm = useConfirm();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();

    // --- DATA FETCHING WITH TANSTACK QUERY ---
    const { data: subjects = [], isLoading: subjectsLoading } = useQuery({ queryKey: ['subjects'], queryFn: api.getSubjects });
    const { data: faculty = [], isLoading: facultyLoading } = useQuery({ queryKey: ['faculty'], queryFn: api.getFaculty });
    const { data: rooms = [], isLoading: roomsLoading } = useQuery({ queryKey: ['rooms'], queryFn: api.getRooms });
    const { data: batches = [], isLoading: batchesLoading } = useQuery({ queryKey: ['batches'], queryFn: api.getBatches });
    const { data: departments = [], isLoading: departmentsLoading } = useQuery({ queryKey: ['departments'], queryFn: api.getDepartments });
    const { data: users = [], isLoading: usersLoading } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });
    const { data: facultyAllocations = [] } = useQuery({ queryKey: ['facultyAllocations'], queryFn: api.getFacultyAllocations });

    const dataMap = {
        subjects: { data: subjects, isLoading: subjectsLoading, saveFn: api.saveSubject, deleteFn: api.deleteSubject },
        faculty: { data: faculty, isLoading: facultyLoading, saveFn: api.saveFaculty, deleteFn: api.deleteFaculty },
        rooms: { data: rooms, isLoading: roomsLoading, saveFn: api.saveRoom, deleteFn: api.deleteRoom },
        batches: { data: batches, isLoading: batchesLoading, saveFn: api.saveBatch, deleteFn: api.deleteBatch },
        departments: { data: departments, isLoading: departmentsLoading, saveFn: api.saveDepartment, deleteFn: api.deleteDepartment },
        users: { data: users, isLoading: usersLoading, saveFn: api.saveUser, deleteFn: api.deleteUser },
    };
    
    const { data: currentData, isLoading: currentDataIsLoading, saveFn, deleteFn } = dataMap[activeTab];

    // --- MUTATIONS WITH TANSTACK QUERY ---
    // FIX: Specify generic types for useMutation to handle different return types from saveFn.
    const saveMutation = useMutation<any, Error, any>({
        mutationFn: (item: any) => saveFn(item),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [activeTab] });
            // Invalidate related queries for relational data
            if (activeTab === 'users') queryClient.invalidateQueries({ queryKey: ['faculty'] });
            if (activeTab === 'batches') queryClient.invalidateQueries({ queryKey: ['facultyAllocations'] });
            toast.success(`${TABS.find(t => t.id === activeTab)?.label} saved successfully.`);
            setIsModalOpen(false);
            setEditingItem(null);
        },
        onError: (error: Error) => {
            toast.error(error.message || `Failed to save ${activeTab}.`);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (item: any) => deleteFn(item.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [activeTab] });
             if (activeTab === 'users') queryClient.invalidateQueries({ queryKey: ['faculty'] });
            toast.success(`Item deleted successfully.`);
        },
        onError: (error: Error) => {
            toast.error(error.message || `Failed to delete item.`);
        }
    });
    
    const importMutation = useMutation({
        mutationFn: api.importDataManagementData,
        onSuccess: () => {
            toast.success("Data imported successfully. Refreshing all data...");
            queryClient.invalidateQueries(); // Invalidate everything after a bulk import
        },
        onError: (error: Error) => {
            toast.error(`Import failed: ${error.message}`);
        }
    });

    const handleSave = useCallback((item: any) => {
        saveMutation.mutate(item);
    }, [saveMutation]);

    const handleDelete = useCallback(async (item: any) => {
        const confirmed = await confirm({
            title: 'Confirm Deletion',
            description: 'Are you sure you want to delete this item? This action cannot be undone.'
        });
        if (confirmed) {
            deleteMutation.mutate(item);
        }
    }, [confirm, deleteMutation]);

    const handleExport = () => {
        const dataToExport = { subjects, faculty, rooms, batches, departments };
        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aetherschedule_data_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Data exported successfully.");
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("File could not be read");
                const parsedData = JSON.parse(text);
                importMutation.mutate(parsedData);
            } catch (error: any) {
                toast.error(`Import failed: ${error.message}`);
            }
        };
        reader.readAsText(file);
        
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const columnsMap: Record<DataType, any[]> = useMemo(() => ({
        subjects: [
            { accessor: 'code', header: 'Code' },
            { 
                accessor: 'name', 
                header: 'Name',
                render: (s: Subject) => {
                    const isAssigned = faculty.some(f => f.subjectIds.includes(s.id));
                    return (
                        <div className="flex items-center gap-2">
                            <span>{s.name}</span>
                            {!isAssigned && (
                                <div className="relative group flex items-center">
                                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-xs px-2 py-1 text-xs text-white bg-panel-strong rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-[var(--border)] shadow-lg">
                                        Warning: No faculty assigned to teach this subject.
                                    </span>
                                </div>
                            )}
                        </div>
                    )
                }
            },
            { 
                header: 'Taught By', 
                accessor: 'id',
                render: (s: Subject) => {
                    const teachers = faculty.filter(f => f.subjectIds.includes(s.id)).map(f => f.name).join(', ');
                    return teachers || <span className="text-text-muted">Unassigned</span>;
                }
            },
            { accessor: 'type', header: 'Type' },
            { accessor: 'credits', header: 'Credits' },
            { accessor: 'hoursPerWeek', header: 'Hours/Week' },
        ],
        faculty: [
            { accessor: 'name', header: 'Name' },
            { 
                header: 'Login Account', 
                accessor: 'userId',
                render: (f: Faculty) => {
                    const user = users.find(u => u.id === f.userId);
                    return user ? (
                        <div className="flex items-center gap-2">
                            <UsersIcon size={14} className="text-accent" />
                            <span>{user.email}</span>
                        </div>
                    ) : <span className="text-text-muted">Not Linked</span>;
                }
            },
            { accessor: 'subjectIds', header: 'Subjects', render: (f: Faculty) => (f.subjectIds.map(id => subjects.find(s=>s.id === id)?.code || id).join(', ')) },
        ],
        rooms: [
            { accessor: 'name', header: 'Name' },
            { accessor: 'type', header: 'Type' },
            { accessor: 'capacity', header: 'Capacity' },
        ],
        batches: [
            { accessor: 'name', header: 'Name' },
            { accessor: 'departmentId', header: 'Department', render: (b: Batch) => departments.find(d => d.id === b.departmentId)?.name || 'N/A'},
            { accessor: 'semester', header: 'Semester' },
            { accessor: 'studentCount', header: 'Students' },
            { 
                header: 'Faculty Allocations', 
                accessor: 'id',
                render: (b: Batch) => {
                    const allocationsForBatch = facultyAllocations.filter(fa => fa.batchId === b.id);
                    if (allocationsForBatch.length === 0) {
                        return <span className="text-text-muted">None (AI will assign)</span>
                    }
                    const assignedSubjectsCount = allocationsForBatch.length;
                    const totalSubjectsCount = b.subjectIds.length;
                    return <span className="text-white">{`${assignedSubjectsCount} of ${totalSubjectsCount} subjects allocated`}</span>
                }
            },
        ],
        departments: [
            { accessor: 'code', header: 'Code' },
            { accessor: 'name', header: 'Name' },
        ],
        users: [
            { accessor: 'name', header: 'Name' },
            { accessor: 'email', header: 'Email' },
            { accessor: 'role', header: 'Role' },
            {
                header: 'Association',
                accessor: 'id',
                render: (u: User) => {
                    if (u.role === 'Student') {
                        const batch = batches.find(b => b.id === u.batchId);
                        return batch ? `Student of ${batch.name}` : <span className="text-text-muted">Unassigned</span>;
                    }
                     if (u.role === 'Faculty') {
                        const facultyMember = faculty.find(f => f.id === u.facultyId);
                        return facultyMember ? `Faculty: ${facultyMember.name}` : <span className="text-text-muted">Unassigned</span>;
                    }
                    return <span className="text-text-muted">-</span>;
                }
            }
        ]
    }), [faculty, subjects, departments, users, rooms, facultyAllocations, batches]);
    
    const addButtonState = useMemo(() => {
        const typeName = TABS.find(t => t.id === activeTab)?.label.slice(0, -1);
        switch(activeTab) {
            case 'faculty':
                return {
                    disabled: subjects.length === 0,
                    tooltip: 'Please add subjects before adding faculty.',
                    label: `Add New Faculty`
                };
            case 'batches':
                 return {
                    disabled: subjects.length === 0 || departments.length === 0,
                    tooltip: 'Please add subjects and departments before adding a batch.',
                    label: 'Add New Batch'
                };
            case 'users':
                return {
                    disabled: batches.length === 0 && faculty.length === 0,
                    tooltip: 'Please add batches and faculty before adding users.',
                    label: 'Add New User'
                }
            default:
                return { disabled: false, tooltip: '', label: `Add New ${typeName}` };
        }
    }, [activeTab, subjects, departments, batches, faculty]);

    return (
        <div className="space-y-6">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" style={{ display: 'none' }} />
            <GlassPanel className="p-4 sm:p-6">
                <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                    <h2 className="text-2xl font-bold text-white">Data Management</h2>
                     <div className="flex items-center gap-2">
                        <GlassButton variant="secondary" icon={FileUp} onClick={handleImportClick} disabled={importMutation.isPending}>
                            {importMutation.isPending ? 'Importing...' : 'Import'}
                        </GlassButton>
                        <GlassButton variant="secondary" icon={FileDown} onClick={handleExport}>Export</GlassButton>
                        <GlassButton 
                            icon={PlusCircle} 
                            onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                            disabled={addButtonState.disabled}
                            title={addButtonState.disabled ? addButtonState.tooltip : addButtonState.label}
                        >
                            {addButtonState.label}
                        </GlassButton>
                    </div>
                </div>

                <div className="border-b border-[var(--border)] mb-4">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`${
                                    activeTab === tab.id
                                        ? 'border-[var(--accent)] text-[var(--accent)]'
                                        : 'border-transparent text-text-muted hover:text-white hover:border-text-muted'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
                
                <DataTable<any>
                    columns={columnsMap[activeTab]}
                    data={currentData}
                    onEdit={(item) => { setEditingItem(item); setIsModalOpen(true); }}
                    onDelete={handleDelete}
                    isLoading={currentDataIsLoading}
                />

            </GlassPanel>
            {isModalOpen && (
                <DataFormModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    dataType={activeTab}
                    initialData={editingItem}
                />
            )}
        </div>
    );
};

export default DataManagement;
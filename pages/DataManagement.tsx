import React, { useState, useMemo } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { GlassButton } from '../components/GlassButton';
import { PlusCircle, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { DataTable } from '../components/DataTable';
import { DataFormModal } from '../components/DataFormModal';
import * as api from '../services';
import { useToast } from '../hooks/useToast';
import type { Subject, Faculty, Room, Batch, Department, User } from '../types';

type DataType = 'subjects' | 'faculty' | 'rooms' | 'batches' | 'departments';

const TABS: { id: DataType, label: string }[] = [
    { id: 'subjects', label: 'Subjects' },
    { id: 'faculty', label: 'Faculty' },
    { id: 'rooms', label: 'Rooms' },
    { id: 'batches', label: 'Batches' },
    { id: 'departments', label: 'Departments' },
];

const DataManagement: React.FC = () => {
    const { subjects, faculty, rooms, batches, departments, users, refreshData } = useAppContext();
    const [activeTab, setActiveTab] = useState<DataType>('subjects');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const toast = useToast();

    const dataMap = { subjects, faculty, rooms, batches, departments };
    const currentData = dataMap[activeTab];

    const handleSave = async (item: any) => {
        try {
            const saveFns: Record<DataType, (data: any) => Promise<any>> = {
                subjects: api.saveSubject,
                faculty: api.saveFaculty,
                rooms: api.saveRoom,
                batches: api.saveBatch,
                departments: api.saveDepartment,
            };
            await saveFns[activeTab](item);
            await refreshData();
            toast.success(`${TABS.find(t=>t.id === activeTab)?.label} saved successfully.`);
            setIsModalOpen(false);
            setEditingItem(null);
        } catch (error: any) {
            toast.error(error.message || `Failed to save ${activeTab}.`);
        }
    };
    
    const handleDelete = async (item: any) => {
         if (!window.confirm("Are you sure you want to delete this item?")) return;
        try {
            const deleteFns: Record<DataType, (id: string) => Promise<any>> = {
                subjects: api.deleteSubject,
                faculty: api.deleteFaculty,
                rooms: api.deleteRoom,
                batches: api.deleteBatch,
                departments: api.deleteDepartment,
            };
            await deleteFns[activeTab](item.id);
            await refreshData();
            toast.success(`Item deleted successfully.`);
        } catch (error: any) {
            toast.error(error.message || `Failed to delete item.`);
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
                header: 'Login Email', 
                accessor: 'userId',
                render: (f: Faculty) => {
                    const user = users.find(u => u.id === f.userId);
                    return user ? user.email : <span className="text-text-muted">No login</span>;
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
        ],
        departments: [
            { accessor: 'code', header: 'Code' },
            { accessor: 'name', header: 'Name' },
        ],
    }), [faculty, subjects, departments, users]);
    
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
            default:
                return { disabled: false, tooltip: '', label: `Add New ${typeName}` };
        }
    }, [activeTab, subjects, departments]);

    return (
        <div className="space-y-6">
            <GlassPanel className="p-4 sm:p-6">
                <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                    <h2 className="text-2xl font-bold text-white">Data Management</h2>
                     <GlassButton 
                        icon={PlusCircle} 
                        onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                        disabled={addButtonState.disabled}
                        title={addButtonState.disabled ? addButtonState.tooltip : addButtonState.label}
                     >
                        {addButtonState.label}
                    </GlassButton>
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
                                        : 'border-transparent text-text-muted hover:text-white hover:border-gray-500'
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
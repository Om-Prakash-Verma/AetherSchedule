import React, { useState, useMemo, useCallback, useRef } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { GlassButton } from '../components/GlassButton';
import { PlusCircle, FileDown, FileUp, Info } from 'lucide-react';
import { DataTable } from '../components/DataTable';
import { DataFormModal } from '../components/DataFormModal';
import * as api from '../services';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getColumns } from '../components/datamanagement/columns';

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

    // --- DATA FETCHING (CENTRALIZED) ---
    const { data: subjects = [], isLoading: subjectsLoading } = useQuery({ queryKey: ['subjects'], queryFn: api.getSubjects });
    const { data: faculty = [], isLoading: facultyLoading } = useQuery({ queryKey: ['faculty'], queryFn: api.getFaculty });
    const { data: rooms = [], isLoading: roomsLoading } = useQuery({ queryKey: ['rooms'], queryFn: api.getRooms });
    const { data: batches = [], isLoading: batchesLoading } = useQuery({ queryKey: ['batches'], queryFn: api.getBatches });
    const { data: departments = [], isLoading: departmentsLoading } = useQuery({ queryKey: ['departments'], queryFn: api.getDepartments });
    const { data: users = [], isLoading: usersLoading } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });

    const dataMap = {
        subjects: { data: subjects, isLoading: subjectsLoading, saveFn: api.saveSubject, deleteFn: api.deleteSubject },
        faculty: { data: faculty, isLoading: facultyLoading, saveFn: api.saveFaculty, deleteFn: api.deleteFaculty },
        rooms: { data: rooms, isLoading: roomsLoading, saveFn: api.saveRoom, deleteFn: api.deleteRoom },
        batches: { data: batches, isLoading: batchesLoading, saveFn: api.saveBatch, deleteFn: api.deleteBatch },
        departments: { data: departments, isLoading: departmentsLoading, saveFn: api.saveDepartment, deleteFn: api.deleteDepartment },
        users: { data: users, isLoading: usersLoading, saveFn: api.saveUser, deleteFn: api.deleteUser },
    };
    
    const { data: currentData, isLoading: currentDataIsLoading, saveFn, deleteFn } = dataMap[activeTab];

    const columns = useMemo(() => getColumns(activeTab, { subjects, faculty, departments, users, batches }), 
        [activeTab, subjects, faculty, departments, users, batches]
    );

    // --- MUTATIONS ---
    const saveMutation = useMutation<any, Error, any>({
        mutationFn: (item: any) => saveFn(item),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [activeTab] });
            if (['faculty', 'batches', 'departments', 'users'].includes(activeTab)) {
                queryClient.invalidateQueries({ queryKey: ['users'] });
                queryClient.invalidateQueries({ queryKey: ['faculty'] });
                queryClient.invalidateQueries({ queryKey: ['facultyAllocations'] });
            }
            toast.success(`${TABS.find(t => t.id === activeTab)?.label} saved successfully.`);
            setIsModalOpen(false); setEditingItem(null);
        },
        onError: (error: Error) => toast.error(error.message || `Failed to save ${activeTab}.`)
    });

    const deleteMutation = useMutation({
        mutationFn: (item: any) => deleteFn(item.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [activeTab] });
            if (['faculty', 'batches', 'departments', 'users'].includes(activeTab)) {
                queryClient.invalidateQueries({ queryKey: ['users'] });
                queryClient.invalidateQueries({ queryKey: ['faculty'] });
            }
            toast.success(`Item deleted successfully.`);
        },
        onError: (error: Error) => toast.error(error.message || `Failed to delete item.`)
    });
    
    const importMutation = useMutation({
        mutationFn: api.importDataManagementData,
        onSuccess: () => {
            toast.success("Data imported successfully. Refreshing all data...");
            queryClient.invalidateQueries();
        },
        onError: (error: Error) => toast.error(`Import failed: ${error.message}`)
    });

    // --- HANDLERS ---
    const handleSave = useCallback((item: any) => saveMutation.mutate(item), [saveMutation]);

    const handleDelete = useCallback(async (item: any) => {
        if (await confirm({ title: 'Confirm Deletion', description: 'Are you sure? This action cannot be undone.'})) {
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

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (typeof e.target?.result !== 'string') throw new Error("File could not be read");
                importMutation.mutate(JSON.parse(e.target.result));
            } catch (error: any) {
                toast.error(`Import failed: ${error.message}`);
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const addButtonState = useMemo(() => {
        const typeName = TABS.find(t => t.id === activeTab)?.label.slice(0, -1);
        const states = {
            faculty: { disabled: subjects.length === 0, tooltip: 'Add subjects before faculty.' },
            batches: { disabled: subjects.length === 0 || departments.length === 0, tooltip: 'Add subjects and departments before batches.' },
            users: { disabled: batches.length === 0 && faculty.length === 0, tooltip: 'Add batches and faculty before users.' }
        };
        const state = states[activeTab as keyof typeof states] || { disabled: false, tooltip: '' };
        return { ...state, label: `Add New ${typeName}` };
    }, [activeTab, subjects, departments, batches, faculty]);

    return (
        <div className="space-y-6">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" style={{ display: 'none' }} />
            <GlassPanel className="p-4 sm:p-6">
                <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                    <h2 className="text-2xl font-bold text-white">Data Management</h2>
                     <div className="flex items-center gap-2">
                        <GlassButton variant="secondary" icon={FileUp} onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending}>{importMutation.isPending ? 'Importing...' : 'Import'}</GlassButton>
                        <GlassButton variant="secondary" icon={FileDown} onClick={handleExport}>Export</GlassButton>
                        <GlassButton icon={PlusCircle} onClick={() => { setEditingItem(null); setIsModalOpen(true); }} disabled={addButtonState.disabled} title={addButtonState.disabled ? addButtonState.tooltip : addButtonState.label}>{addButtonState.label}</GlassButton>
                    </div>
                </div>

                <div className="border-b border-[var(--border)] mb-4">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto">
                        {TABS.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`${activeTab === tab.id ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-text-muted hover:text-white'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}>{tab.label}</button>
                        ))}
                    </nav>
                </div>
                
                {activeTab === 'users' && (
                    <div className="mb-4 p-3 bg-accent/10 border border-accent/20 rounded-lg text-sm text-accent flex items-center gap-3"><Info size={18} /><span><strong>Note:</strong> Faculty, Student, and HOD accounts are created automatically. You can only manually create Admin roles here.</span></div>
                )}

                <DataTable<any> columns={columns} data={currentData} onEdit={(item) => { setEditingItem(item); setIsModalOpen(true); }} onDelete={handleDelete} isLoading={currentDataIsLoading} />
            </GlassPanel>

            {isModalOpen && (
                <DataFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} dataType={activeTab} initialData={editingItem} />
            )}
        </div>
    );
};

export default DataManagement;


import React, { useState, useCallback, useEffect } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { useAppContext } from '../hooks/useAppContext';
import { useToast } from '../hooks/useToast';
import * as api from '../services';
import { GlassButton } from '../components/GlassButton';
import { PlusCircle, Bot, Wand2 } from 'lucide-react';
import { GlassSelect } from '../components/ui/GlassSelect';
import { AvailabilityMatrix } from '../components/AvailabilityMatrix';
import { DataTable } from '../components/DataTable';
import { DataFormModal } from '../components/DataFormModal';
import type { FacultyAvailability, PinnedAssignment, PlannedLeave } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '../hooks/useConfirm';

type ConstraintType = 'availability' | 'pinned' | 'leaves' | 'presets';

const TABS: { id: ConstraintType, label: string }[] = [
    { id: 'availability', label: 'Faculty Availability' },
    { id: 'pinned', label: 'Pinned Assignments' },
    { id: 'leaves', label: 'Planned Leaves' },
    { id: 'presets', label: 'AI Constraint Builder' },
];


const Constraints: React.FC = () => {
    const { timeSlots } = useAppContext();
    const [activeTab, setActiveTab] = useState<ConstraintType>('availability');
    const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const toast = useToast();
    const confirm = useConfirm();
    const queryClient = useQueryClient();

    const { data: constraints, isLoading: constraintsLoading } = useQuery({ queryKey: ['constraints'], queryFn: api.getConstraints, initialData: { pinnedAssignments: [], plannedLeaves: [], facultyAvailability: [], substitutions: [] } });
    const { data: faculty = [] } = useQuery({ queryKey: ['faculty'], queryFn: api.getFaculty });
    const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: api.getSubjects });
    const { data: batches = [] } = useQuery({ queryKey: ['batches'], queryFn: api.getBatches });

    useEffect(() => {
        if (faculty.length > 0 && !selectedFacultyId) {
            setSelectedFacultyId(faculty[0].id);
        }
    }, [faculty, selectedFacultyId]);

    const currentAvailability = constraints.facultyAvailability.find(a => a.facultyId === selectedFacultyId)?.availability;

    const saveAvailabilityMutation = useMutation({
        mutationFn: api.saveFacultyAvailability,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['constraints'] });
            toast.success("Faculty availability saved.");
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to save availability.');
        }
    });

    const handleAvailabilityChange = (newAvailability: Record<number, number[]>) => {
        if (!selectedFacultyId) return;
        saveAvailabilityMutation.mutate({ facultyId: selectedFacultyId, availability: newAvailability });
    };

    // FIX: Specify generic types for useMutation to handle the union return type of the mutation function.
    const saveMutation = useMutation<any, Error, any>({
        mutationFn: (item: any) => activeTab === 'pinned' ? api.savePinnedAssignment(item) : api.savePlannedLeave(item),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['constraints'] });
            toast.success(`${activeTab === 'pinned' ? 'Pinned Assignment' : 'Planned Leave'} saved successfully.`);
            setIsModalOpen(false);
            setEditingItem(null);
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to save item.');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (item: any) => activeTab === 'pinned' ? api.deletePinnedAssignment(item.id) : api.deletePlannedLeave(item.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['constraints'] });
            toast.success('Item deleted successfully.');
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to delete item.');
        }
    });
    
    const handleSave = useCallback((item: any) => {
        saveMutation.mutate(item);
    }, [saveMutation]);

    const handleDelete = useCallback(async (item: any) => {
        const confirmed = await confirm({
            title: `Delete ${activeTab === 'pinned' ? 'Pinned Assignment' : 'Planned Leave'}`,
            description: 'Are you sure you want to delete this item? This action cannot be undone.'
        });
        if (confirmed) {
            deleteMutation.mutate(item);
        }
    }, [confirm, deleteMutation, activeTab]);
    
    const pinnedColumns: { header: string; accessor: keyof PinnedAssignment; render?: (item: PinnedAssignment) => React.ReactNode; }[] = [
        { accessor: 'name', header: 'Name' },
        { accessor: 'batchId', header: 'Batch', render: (item) => batches.find(b=>b.id === item.batchId)?.name || 'N/A' },
        { accessor: 'subjectId', header: 'Subject', render: (item) => subjects.find(s=>s.id === item.subjectId)?.code || 'N/A' },
        { accessor: 'facultyId', header: 'Faculty', render: (item) => faculty.find(f=>f.id === item.facultyId)?.name || 'N/A' },
        { accessor: 'days', header: 'Days', render: (item) => item.days?.map(d => DAYS_OF_WEEK[d]?.substring(0,3) || '?').join(', ') },
        { accessor: 'startSlots', header: 'Times', render: (item) => item.startSlots?.map(s => timeSlots[s]?.split(' ')[0] || '?').join(', ') },
        { accessor: 'duration', header: 'Duration' },
    ];
    
    const leaveColumns: { header: string; accessor: keyof PlannedLeave; render?: (item: PlannedLeave) => React.ReactNode; }[] = [
        { accessor: 'facultyId', header: 'Faculty', render: (item) => faculty.find(f=>f.id === item.facultyId)?.name || 'N/A' },
        { accessor: 'startDate', header: 'Start Date' },
        { accessor: 'endDate', header: 'End Date' },
        { accessor: 'reason', header: 'Reason' },
    ];

    const AIBuiltConstraints = () => {
        // ... (existing content, no data fetching logic to change)
        return (
             <div>
                 <div className="flex items-center gap-3 mb-4 text-accent">
                    <Bot size={24}/>
                    <h3 className="text-xl font-bold text-white">AI-Assisted Constraint Builder</h3>
                </div>
                <p className="text-sm text-text-muted mb-4">
                   Describe a scheduling rule in plain English. The AI will translate it into a formal constraint that the engine can understand. This feature is for demonstrating advanced logic and is not fully implemented.
                </p>
                <div className="space-y-4">
                    <textarea 
                        placeholder="e.g., 'No faculty member should teach for more than 3 consecutive hours' or 'First-year students should not have classes after 4 PM'" 
                        className="glass-input min-h-[100px] text-sm"
                    />
                    <GlassButton icon={Wand2}>
                        Build Rule with AI
                    </GlassButton>
                </div>
            </div>
        )
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'availability':
                return (
                    <div>
                        <div className="mb-4 max-w-xs">
                            <label className="text-sm text-text-muted mb-1 block">Select Faculty</label>
                            <GlassSelect 
                                value={selectedFacultyId} 
                                onChange={value => setSelectedFacultyId(String(value))}
                                placeholder="Select a faculty member..."
                                options={faculty.map(f => ({ value: f.id, label: f.name }))}
                            />
                        </div>
                        {selectedFacultyId ? (
                             <>
                                <p className="text-sm text-text-muted mb-4">
                                    Click and drag to quickly set availability. Changes are saved automatically when you release the mouse button.
                                </p>
                                <AvailabilityMatrix availability={currentAvailability!} onChange={handleAvailabilityChange} />
                            </>
                        ) : (
                            <p className="text-text-muted text-center py-8">Select a faculty member to edit their availability.</p>
                        )}
                    </div>
                );
            case 'pinned':
                return (
                    <div>
                        <div className="flex justify-end mb-4">
                           <GlassButton icon={PlusCircle} onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>Add Pinned Assignment</GlassButton>
                        </div>
                        <DataTable<PinnedAssignment> 
                            columns={pinnedColumns} 
                            data={constraints.pinnedAssignments} 
                            onEdit={(item) => { setEditingItem(item); setIsModalOpen(true); }} 
                            onDelete={handleDelete}
                            isLoading={constraintsLoading}
                        />
                    </div>
                );
            case 'leaves':
                return (
                    <div>
                        <div className="flex justify-end mb-4">
                           <GlassButton icon={PlusCircle} onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>Add Planned Leave</GlassButton>
                        </div>
                        <DataTable<PlannedLeave> 
                            columns={leaveColumns} 
                            data={constraints.plannedLeaves} 
                            onEdit={(item) => { setEditingItem(item); setIsModalOpen(true); }} 
                            onDelete={handleDelete}
                            isLoading={constraintsLoading}
                        />
                    </div>
                );
            case 'presets':
                return <AIBuiltConstraints />;
            default: return null;
        }
    }

    return (
        <div className="space-y-6">
            <GlassPanel className="p-4 sm:p-6">
                <h2 className="text-2xl font-bold text-white mb-6">Constraints Management</h2>
                 <div className="border-b border-[var(--border)] mb-4">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto">
                        {TABS.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-text-muted hover:text-white'}`}>
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
                {renderContent()}
            </GlassPanel>

             {isModalOpen && (
                <DataFormModal 
                  isOpen={isModalOpen}
                  onClose={() => { setEditingItem(null); setIsModalOpen(false); }}
                  onSave={handleSave}
                  dataType={activeTab as 'pinned' | 'leaves'} 
                  initialData={editingItem}
                />
            )}
        </div>
    );
};

export default Constraints;

import React, { useState, useCallback, useEffect } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { useAppContext } from '../hooks/useAppContext';
import { useToast } from '../hooks/useToast';
import * as api from '../services';
import { GlassButton } from '../components/GlassButton';
import { PlusCircle } from 'lucide-react';
import { GlassSelect } from '../components/ui/GlassSelect';
import { AvailabilityMatrix } from '../components/AvailabilityMatrix';
import { DataTable } from '../components/DataTable';
import { DataFormModal } from '../components/DataFormModal';
import type { FacultyAvailability, PinnedAssignment, PlannedLeave } from '../types';
import { DAYS_OF_WEEK } from '../constants';

type ConstraintType = 'availability' | 'pinned' | 'leaves';

const TABS: { id: ConstraintType, label: string }[] = [
    { id: 'availability', label: 'Faculty Availability' },
    { id: 'pinned', label: 'Pinned Assignments' },
    { id: 'leaves', label: 'Planned Leaves' },
];


const Constraints: React.FC = () => {
    const { 
        constraints, faculty, refreshData, subjects, batches, timeSlots,
        fetchConstraints, fetchFaculty, fetchSubjects, fetchBatches, loadingStates
    } = useAppContext();
    const [activeTab, setActiveTab] = useState<ConstraintType>('availability');
    const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const toast = useToast();

    useEffect(() => {
        fetchConstraints();
        fetchFaculty();
        // Fetch data needed for dropdowns in modals
        if (activeTab === 'pinned') {
            fetchSubjects();
            fetchBatches();
        }
    }, [activeTab, fetchConstraints, fetchFaculty, fetchSubjects, fetchBatches]);

    useEffect(() => {
        // Set default selected faculty once faculty data is loaded
        if (faculty.length > 0 && !selectedFacultyId) {
            setSelectedFacultyId(faculty[0].id);
        }
    }, [faculty, selectedFacultyId]);

    const currentAvailability = constraints.facultyAvailability.find(a => a.facultyId === selectedFacultyId)?.availability;

    const handleAvailabilityChange = async (newAvailability: Record<number, number[]>) => {
        if (!selectedFacultyId) return;
        const newConstraint: FacultyAvailability = { facultyId: selectedFacultyId, availability: newAvailability };
        try {
            await api.saveFacultyAvailability(newConstraint);
            await refreshData();
            toast.success("Faculty availability saved.");
        } catch (error: any) {
            toast.error(error.message || 'Failed to save availability.');
        }
    };
    
    const handleSave = useCallback(async (item: any) => {
        const isPinned = activeTab === 'pinned';
        try {
            if (isPinned) await api.savePinnedAssignment(item);
            else await api.savePlannedLeave(item);
            await refreshData();
            toast.success(`${isPinned ? 'Pinned Assignment' : 'Planned Leave'} saved successfully.`);
            setIsModalOpen(false);
            setEditingItem(null);
        } catch (error: any) {
             toast.error(error.message || 'Failed to save item.');
        }
    }, [activeTab, refreshData, toast]);

    const handleDelete = useCallback(async (item: any) => {
        const isPinned = activeTab === 'pinned';
        if (!window.confirm(`Are you sure you want to delete this ${isPinned ? 'pinned assignment' : 'planned leave'}?`)) return;
        try {
            if (isPinned) await api.deletePinnedAssignment(item.id);
            else await api.deletePlannedLeave(item.id);
            await refreshData();
            toast.success(`Item deleted successfully.`);
        } catch (error: any) {
             toast.error(error.message || 'Failed to delete item.');
        }
    }, [activeTab, refreshData, toast]);
    
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
                            isLoading={loadingStates.constraints}
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
                            isLoading={loadingStates.constraints}
                        />
                    </div>
                );
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
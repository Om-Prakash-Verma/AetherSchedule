import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { User, BookOpen, Layers, Box, Building } from 'lucide-react';
import { ResourceType } from '../types';
import { clsx } from 'clsx';
import DataTable from './datamanagement/modules/DataTable';
import ResourceModal from './datamanagement/modules/ResourceModal';
import DeleteConfirmationModal from './datamanagement/modules/DeleteConfirmationModal';

const DataManagement = () => {
    const { 
        faculty, subjects, rooms, batches, departments,
        addFaculty, addRoom, addSubject, addBatch, addDepartment,
        updateFaculty, updateRoom, updateSubject, updateBatch, updateDepartment,
        deleteFaculty, deleteRoom, deleteSubject, deleteBatch, deleteDepartment
    } = useStore();
    
    // Tab State
    const [activeTab, setActiveTab] = useState<ResourceType>(ResourceType.FACULTY);

    // Modal States
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState<ResourceType | null>(null);
    const [editingItem, setEditingItem] = useState<any>(null);

    // Delete Modal States
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{type: ResourceType, id: string} | null>(null);

    const tabs = [
        { id: ResourceType.FACULTY, label: 'Faculty', icon: User },
        { id: ResourceType.DEPARTMENT, label: 'Departments', icon: Building },
        { id: ResourceType.SUBJECT, label: 'Subjects', icon: BookOpen },
        { id: ResourceType.ROOM, label: 'Rooms', icon: Box },
        { id: ResourceType.BATCH, label: 'Batches', icon: Layers },
    ];

    const openAddModal = (type: ResourceType) => {
        setModalType(type);
        setEditingItem(null);
        setModalOpen(true);
    };

    const openEditModal = (type: ResourceType, item: any) => {
        setModalType(type);
        // Normalize batch data for editing
        let itemToEdit = { ...item };
        // Migration logic for old data format
        if (type === ResourceType.BATCH && !itemToEdit.subjectAssignments && itemToEdit.subjects) {
            itemToEdit.subjectAssignments = itemToEdit.subjects.map((subId: string) => ({
                subjectId: subId,
                facultyIds: [] // Empty initially for legacy data
            }));
        }
        setEditingItem(itemToEdit);
        setModalOpen(true);
    };

    const triggerDelete = (type: ResourceType, id: string) => {
        setDeleteTarget({ type, id });
        setDeleteModalOpen(true);
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        
        switch (deleteTarget.type) {
            case ResourceType.FACULTY: deleteFaculty(deleteTarget.id); break;
            case ResourceType.SUBJECT: deleteSubject(deleteTarget.id); break;
            case ResourceType.ROOM: deleteRoom(deleteTarget.id); break;
            case ResourceType.BATCH: deleteBatch(deleteTarget.id); break;
            case ResourceType.DEPARTMENT: deleteDepartment(deleteTarget.id); break;
        }
        
        setDeleteTarget(null);
    };

    const handleSave = (data: any) => {
        if (editingItem && modalType) {
             // Update Logic
             const id = editingItem.id;
             switch (modalType) {
                 case ResourceType.FACULTY:
                     updateFaculty({
                         id,
                         name: data.name,
                         // Default values for removed fields
                         department: data.department || 'General', 
                         maxHoursPerDay: 8, 
                         preferredSlots: editingItem.preferredSlots || [],
                         subjects: data.subjects || []
                     });
                     break;
                 case ResourceType.SUBJECT:
                     updateSubject({
                         id,
                         name: data.name,
                         code: data.code,
                         credits: parseInt(data.credits) || 3,
                         lecturesPerWeek: parseInt(data.lecturesPerWeek) || parseInt(data.credits) || 3,
                         requiredRoomType: data.requiredRoomType || 'LECTURE'
                     });
                     break;
                 case ResourceType.ROOM:
                     updateRoom({
                         id,
                         name: data.name,
                         capacity: parseInt(data.capacity) || 30,
                         type: data.type || 'LECTURE'
                     });
                     break;
                 case ResourceType.BATCH:
                     updateBatch({
                         id,
                         name: data.name,
                         size: parseInt(data.size) || 30,
                         fixedRoomId: data.fixedRoomId || undefined,
                         subjects: (data.subjectAssignments || []).map((a:any) => a.subjectId),
                         subjectAssignments: data.subjectAssignments || []
                     });
                     break;
                 case ResourceType.DEPARTMENT:
                     updateDepartment({
                         id,
                         name: data.name,
                         code: data.code
                     });
                     break;
             }
        } else if (modalType) {
            // Add Logic
            switch (modalType) {
                case ResourceType.FACULTY:
                    addFaculty({
                        name: data.name,
                        department: 'General',
                        maxHoursPerDay: 8,
                        preferredSlots: [],
                        subjects: data.subjects || []
                    });
                    break;
                case ResourceType.SUBJECT:
                    addSubject({
                        name: data.name,
                        code: data.code,
                        credits: parseInt(data.credits) || 3,
                        lecturesPerWeek: parseInt(data.lecturesPerWeek) || parseInt(data.credits) || 3,
                        requiredRoomType: data.requiredRoomType || 'LECTURE'
                    });
                    break;
                case ResourceType.ROOM:
                    addRoom({
                        name: data.name,
                        capacity: parseInt(data.capacity) || 30,
                        type: data.type || 'LECTURE'
                    });
                    break;
                case ResourceType.BATCH:
                    addBatch({
                        name: data.name,
                        size: parseInt(data.size) || 30,
                        fixedRoomId: data.fixedRoomId || undefined,
                        subjects: (data.subjectAssignments || []).map((a:any) => a.subjectId),
                        subjectAssignments: data.subjectAssignments || []
                    });
                    break;
                case ResourceType.DEPARTMENT:
                    addDepartment({
                        name: data.name,
                        code: data.code
                    });
                    break;
            }
        }
        setEditingItem(null);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 mb-6 p-1.5 bg-slate-900/50 rounded-xl w-fit border border-white/5 backdrop-blur-sm">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                            activeTab === tab.id 
                                ? "bg-primary text-white shadow-lg shadow-primary/25 scale-[1.02] ring-1 ring-white/10" 
                                : "text-slate-400 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden min-h-[500px]">
                {activeTab === ResourceType.FACULTY && (
                    <DataTable 
                        title="Faculty Registry" 
                        icon={User} 
                        data={faculty}
                        onAdd={() => openAddModal(ResourceType.FACULTY)}
                        onEdit={(item) => openEditModal(ResourceType.FACULTY, item)}
                        onDelete={(id) => triggerDelete(ResourceType.FACULTY, id)}
                        columns={[
                            { key: 'name', label: 'Name', render: (f: any) => <span className="font-medium text-white text-base">{f.name}</span> },
                            { key: 'subjects', label: 'Subjects Taught', render: (f: any) => (
                                <span className="px-2 py-1 bg-slate-800 rounded-md text-xs font-mono text-slate-300">
                                    {f.subjects?.length || 0} Subjects
                                </span>
                            )}
                        ]}
                    />
                )}
                
                {activeTab === ResourceType.DEPARTMENT && (
                    <DataTable 
                        title="Departments" 
                        icon={Building} 
                        data={departments}
                        onAdd={() => openAddModal(ResourceType.DEPARTMENT)}
                        onEdit={(item) => openEditModal(ResourceType.DEPARTMENT, item)}
                        onDelete={(id) => triggerDelete(ResourceType.DEPARTMENT, id)}
                        columns={[
                            { key: 'name', label: 'Department Name', render: (d: any) => <span className="font-medium text-white text-base">{d.name}</span> },
                            { key: 'code', label: 'Code', render: (d: any) => <span className="font-mono text-accent bg-accent/10 px-2 py-1 rounded">{d.code}</span> }
                        ]}
                    />
                )}
                
                {activeTab === ResourceType.SUBJECT && (
                    <DataTable 
                        title="Subjects" 
                        icon={BookOpen} 
                        data={subjects}
                        onAdd={() => openAddModal(ResourceType.SUBJECT)}
                        onEdit={(item) => openEditModal(ResourceType.SUBJECT, item)}
                        onDelete={(id) => triggerDelete(ResourceType.SUBJECT, id)}
                        columns={[
                            { key: 'code', label: 'Code', render: (s: any) => <span className="font-mono text-accent">{s.code}</span> },
                            { key: 'name', label: 'Name', render: (s: any) => <span className="font-medium text-white">{s.name}</span> },
                            { key: 'credits', label: 'Credits' },
                            { key: 'lecturesPerWeek', label: 'Lectures/Week' },
                            { key: 'requiredRoomType', label: 'Type', render: (s: any) => (
                                <span className={clsx("px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide", s.requiredRoomType === 'LAB' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-700 text-slate-300')}>
                                    {s.requiredRoomType}
                                </span>
                            )}
                        ]}
                    />
                )}
                
                {activeTab === ResourceType.ROOM && (
                    <DataTable 
                        title="Rooms" 
                        icon={Box} 
                        data={rooms}
                        onAdd={() => openAddModal(ResourceType.ROOM)}
                        onEdit={(item) => openEditModal(ResourceType.ROOM, item)}
                        onDelete={(id) => triggerDelete(ResourceType.ROOM, id)}
                        columns={[
                            { key: 'name', label: 'Room Name', render: (r: any) => <span className="font-medium text-white text-base">{r.name}</span> },
                            { key: 'type', label: 'Type', render: (r: any) => (
                                <span className={clsx("px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide", r.type === 'LAB' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300')}>
                                    {r.type}
                                </span>
                            )},
                            { key: 'capacity', label: 'Capacity', render: (r: any) => <span className="font-mono text-slate-300">{r.capacity}</span> }
                        ]}
                    />
                )}
                
                {activeTab === ResourceType.BATCH && (
                    <DataTable 
                        title="Batches" 
                        icon={Layers} 
                        data={batches}
                        onAdd={() => openAddModal(ResourceType.BATCH)}
                        onEdit={(item) => openEditModal(ResourceType.BATCH, item)}
                        onDelete={(id) => triggerDelete(ResourceType.BATCH, id)}
                        columns={[
                            { key: 'name', label: 'Batch Name', render: (b: any) => <span className="font-medium text-white text-lg">{b.name}</span> },
                            { key: 'size', label: 'Students', render: (b: any) => <span className="font-mono">{b.size}</span> },
                            { key: 'subjects', label: 'Curriculum', render: (b: any) => (
                                <span className="text-xs bg-slate-800 px-2 py-1 rounded-md text-slate-300">
                                    {(b.subjectAssignments || b.subjects || []).length} Subjects Assigned
                                </span>
                            )}
                        ]}
                    />
                )}
            </div>
            
            {/* Unified Resource Modal (Add / Edit) */}
            <ResourceModal 
                isOpen={modalOpen} 
                type={modalType}
                initialData={editingItem} 
                onClose={() => {
                    setModalOpen(false);
                    setEditingItem(null);
                }}
                onSave={handleSave}
                subjects={subjects}
                faculty={faculty}
                rooms={rooms}
            />

            {/* Custom Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setDeleteTarget(null);
                }}
                onConfirm={confirmDelete}
                message={`Are you sure you want to delete this ${deleteTarget?.type.toLowerCase()}? This action cannot be undone and may affect existing schedules.`}
            />
        </div>
    );
};

export default DataManagement;
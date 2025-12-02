
import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { User, BookOpen, Layers, Box, Plus, X, Check, Trash2, AlertTriangle, Building, ChevronDown, Edit, UserCheck, Users } from 'lucide-react';
import { Subject, Faculty, ResourceType, Room } from '../types';

interface DataTableProps {
    title: string;
    icon: any;
    data: any[];
    columns: { key: string; label: string; render?: (item: any) => React.ReactNode }[];
    onAdd: () => void;
    onEdit?: (item: any) => void;
    onDelete?: (id: string) => void;
}

// -- Components --

const DataTable: React.FC<DataTableProps> = ({ title, icon: Icon, data, columns, onAdd, onEdit, onDelete }) => {
    return (
        <div className="rounded-2xl border border-glassBorder bg-glass backdrop-blur-md flex flex-col overflow-hidden h-full group">
            <div className="p-4 border-b border-glassBorder flex items-center gap-2 bg-slate-900/50">
                <Icon size={18} className="text-primary" />
                <h3 className="font-bold text-white">{title}</h3>
                <span className="ml-auto text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full">
                    {data.length}
                </span>
                <button 
                    onClick={onAdd}
                    className="ml-2 p-1.5 rounded-lg bg-white/5 hover:bg-primary hover:text-white text-slate-400 transition-colors"
                    title={`Add ${title}`}
                >
                    <Plus size={16} />
                </button>
            </div>
            <div className="overflow-y-auto flex-1 p-0">
                <table className="w-full text-sm text-left text-slate-400">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-900/30 sticky top-0 z-10">
                        <tr>
                            {columns.map((col: any) => (
                                <th key={col.key} className="px-6 py-3">{col.label}</th>
                            ))}
                            {(onEdit || onDelete) && <th className="px-6 py-3 w-24 text-right">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {data.length > 0 ? (
                            data.map((item: any) => (
                                <tr key={item.id} className="border-b border-glassBorder hover:bg-white/5 transition-colors group/row relative">
                                    {columns.map((col: any) => (
                                        <td key={col.key} className="px-6 py-4">
                                            {col.render ? col.render(item) : item[col.key]}
                                        </td>
                                    ))}
                                    {(onEdit || onDelete) && (
                                        <td className="px-6 py-4 text-right relative">
                                            <div className="flex justify-end gap-1">
                                                {onEdit && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            onEdit(item);
                                                        }}
                                                        className="relative z-20 p-2 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                                                        title="Edit"
                                                        type="button"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            onDelete(item.id);
                                                        }}
                                                        className="relative z-20 p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer"
                                                        title="Delete"
                                                        type="button"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        ) : (
                             <tr>
                                <td colSpan={columns.length + ((onEdit || onDelete) ? 1 : 0)} className="px-6 py-8 text-center opacity-50">
                                    No data available. Click + to add.
                                </td>
                             </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// -- Custom Modal Components --

const DeleteConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    message
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    message: string;
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 relative">
                <div className="flex items-center gap-3 mb-4 text-amber-500">
                    <AlertTriangle size={24} />
                    <h3 className="text-lg font-bold text-white">Confirm Deletion</h3>
                </div>
                <p className="text-slate-300 mb-6 text-sm leading-relaxed">
                    {message}
                </p>
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                        <Trash2 size={16} />
                        Delete
                    </button>
                </div>
             </div>
        </div>
    )
}

const ResourceModal = ({ 
    isOpen, 
    onClose, 
    type, 
    initialData,
    onSave,
    subjects,
    faculty,
    rooms
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    type: ResourceType | null;
    initialData?: any; 
    onSave: (data: any) => void;
    subjects: Subject[];
    faculty: Faculty[];
    rooms: Room[];
}) => {
    const [formData, setFormData] = useState<any>({});
    const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
    
    // State to track which subject row has its faculty dropdown open
    const [openFacultyDropdownSubjectId, setOpenFacultyDropdownSubjectId] = useState<string | null>(null);

    // Populate form data when modal opens or initialData changes
    useEffect(() => {
        if (isOpen) {
            setFormData(initialData || {});
            setIsSubjectDropdownOpen(false);
            setOpenFacultyDropdownSubjectId(null);
        }
    }, [isOpen, type, initialData]);

    if (!isOpen || !type) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
        setFormData({});
        setIsSubjectDropdownOpen(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };
    
    // Toggle subject inclusion for Faculty
    const toggleSubjectSimple = (subjectId: string) => {
        const currentSubjects = formData.subjects || [];
        let updatedSubjects;
        
        if (currentSubjects.includes(subjectId)) {
            updatedSubjects = currentSubjects.filter((id: string) => id !== subjectId);
        } else {
            updatedSubjects = [...currentSubjects, subjectId];
        }
        
        setFormData((prev: any) => ({ ...prev, subjects: updatedSubjects }));
    };

    // Handle adding/removing subject assignment for Batches
    const handleBatchSubjectToggle = (subjectId: string) => {
        const currentAssignments = formData.subjectAssignments || [];
        const exists = currentAssignments.find((a: any) => a.subjectId === subjectId);

        if (exists) {
            // Remove
            const updated = currentAssignments.filter((a: any) => a.subjectId !== subjectId);
            setFormData({ ...formData, subjectAssignments: updated });
        } else {
            // Add with empty faculty array
            setFormData({
                ...formData,
                subjectAssignments: [...currentAssignments, { subjectId, facultyIds: [] }]
            });
        }
    };

    const toggleBatchFaculty = (subjectId: string, facultyId: string) => {
        const currentAssignments = formData.subjectAssignments || [];
        
        const updated = currentAssignments.map((a: any) => {
            if (a.subjectId === subjectId) {
                const currentFacultyIds = a.facultyIds || [];
                let newFacultyIds;
                
                if (currentFacultyIds.includes(facultyId)) {
                    newFacultyIds = currentFacultyIds.filter((id: string) => id !== facultyId);
                } else {
                    newFacultyIds = [...currentFacultyIds, facultyId];
                }
                
                return { ...a, facultyIds: newFacultyIds };
            }
            return a;
        });
        
        setFormData({ ...formData, subjectAssignments: updated });
    };

    const renderFormFields = () => {
        switch (type) {
            case ResourceType.FACULTY:
                return (
                    <>
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                            <input name="name" value={formData.name || ''} required autoFocus className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-primary focus:border-primary" onChange={handleChange} />
                        </div>
                        
                         {/* Subject Selection for Faculty */}
                        <div className="mb-4 relative">
                             <label className="block text-xs font-medium text-slate-400 mb-1">Teaching Subjects</label>
                             <button
                                type="button"
                                onClick={() => setIsSubjectDropdownOpen(!isSubjectDropdownOpen)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-left text-white focus:ring-primary focus:border-primary flex justify-between items-center transition-colors hover:border-slate-600"
                             >
                                <span className={formData.subjects?.length ? "text-white" : "text-slate-500"}>
                                    {formData.subjects?.length
                                        ? `${formData.subjects.length} Subjects Selected`
                                        : "Select Subjects..."}
                                </span>
                                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isSubjectDropdownOpen ? 'rotate-180' : ''}`} />
                             </button>

                             {isSubjectDropdownOpen && (
                                 <div className="absolute z-50 w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto overflow-x-hidden">
                                     {subjects.length === 0 ? (
                                         <div className="p-4 text-sm text-slate-500 text-center">No subjects available.</div>
                                     ) : (
                                         <div className="p-1 space-y-1">
                                             {subjects.map(s => {
                                                 const isSelected = formData.subjects?.includes(s.id);
                                                 return (
                                                     <div
                                                        key={s.id}
                                                        onClick={() => toggleSubjectSimple(s.id)}
                                                        className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-white/5'}`}
                                                     >
                                                        <div className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-slate-600 bg-transparent group-hover:border-slate-500'}`}>
                                                            {isSelected && <Check size={12} className="text-white" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-slate-200'}`}>{s.name}</div>
                                                            <div className="text-xs text-slate-500 font-mono truncate">{s.code}</div>
                                                        </div>
                                                     </div>
                                                 );
                                             })}
                                         </div>
                                     )}
                                 </div>
                             )}
                        </div>
                    </>
                );
            case ResourceType.SUBJECT:
                return (
                    <>
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-slate-400 mb-1">Subject Name</label>
                            <input name="name" value={formData.name || ''} required autoFocus className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-primary focus:border-primary" onChange={handleChange} />
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Code</label>
                                <input name="code" value={formData.code || ''} required className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-primary focus:border-primary" onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Credits</label>
                                <input name="credits" value={formData.credits || ''} type="number" min="1" required className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-primary focus:border-primary" onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Lectures / Week</label>
                                <input name="lecturesPerWeek" value={formData.lecturesPerWeek || ''} type="number" min="1" required className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-primary focus:border-primary" onChange={handleChange} />
                            </div>
                        </div>
                        <div className="mb-4">
                             <label className="block text-xs font-medium text-slate-400 mb-1">Required Room Type</label>
                             <select name="requiredRoomType" value={formData.requiredRoomType || ''} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-primary focus:border-primary" onChange={handleChange}>
                                 <option value="">Select Type</option>
                                 <option value="LECTURE">Lecture Hall</option>
                                 <option value="LAB">Laboratory</option>
                             </select>
                        </div>
                    </>
                );
            case ResourceType.ROOM:
                return (
                    <>
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-slate-400 mb-1">Room Name</label>
                            <input name="name" value={formData.name || ''} required autoFocus className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-primary focus:border-primary" onChange={handleChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Capacity</label>
                                <input name="capacity" value={formData.capacity || ''} type="number" required className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-primary focus:border-primary" onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
                                <select name="type" value={formData.type || ''} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-primary focus:border-primary" onChange={handleChange}>
                                     <option value="">Select Type</option>
                                     <option value="LECTURE">Lecture Hall</option>
                                     <option value="LAB">Laboratory</option>
                                 </select>
                            </div>
                        </div>
                    </>
                );
            case ResourceType.BATCH:
                return (
                     <>
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-slate-400 mb-1">Batch Name</label>
                            <input name="name" value={formData.name || ''} required autoFocus className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-primary focus:border-primary" onChange={handleChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Size (Students)</label>
                                <input name="size" value={formData.size || ''} type="number" required className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-primary focus:border-primary" onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Fixed/Home Room (Optional)</label>
                                <select name="fixedRoomId" value={formData.fixedRoomId || ''} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-primary focus:border-primary" onChange={handleChange}>
                                     <option value="">No Fixed Room</option>
                                     {rooms.filter(r => r.type === 'LECTURE').map(r => (
                                         <option key={r.id} value={r.id}>{r.name} (Cap: {r.capacity})</option>
                                     ))}
                                 </select>
                            </div>
                        </div>
                        
                        {/* Improved Batch Subject Assignment with Multi-Teacher Selection */}
                        <div className="mb-4">
                             <div className="flex justify-between items-center mb-2">
                                 <label className="block text-xs font-medium text-slate-400">Curriculum & Faculty Assignment</label>
                                 <button
                                     type="button"
                                     onClick={() => setIsSubjectDropdownOpen(!isSubjectDropdownOpen)}
                                     className="text-xs text-primary hover:text-white transition-colors flex items-center gap-1"
                                 >
                                     <Plus size={12} /> Add Subject
                                 </button>
                             </div>
                             
                             {/* Subject Selector Dropdown */}
                             {isSubjectDropdownOpen && (
                                 <div className="mb-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                                     {subjects.length === 0 ? (
                                         <div className="p-4 text-sm text-slate-500 text-center">No subjects available.</div>
                                     ) : (
                                         <div className="p-1 space-y-1">
                                             {subjects.map(s => {
                                                 // Check if already assigned
                                                 const isAssigned = (formData.subjectAssignments || []).some((a: any) => a.subjectId === s.id);
                                                 if (isAssigned) return null; // Hide already added

                                                 return (
                                                     <div
                                                        key={s.id}
                                                        onClick={() => {
                                                            handleBatchSubjectToggle(s.id);
                                                            setIsSubjectDropdownOpen(false);
                                                        }}
                                                        className="flex items-center justify-between p-2 rounded hover:bg-white/10 cursor-pointer"
                                                     >
                                                        <span className="text-sm text-slate-200">{s.name} ({s.code})</span>
                                                        <Plus size={14} className="text-slate-500" />
                                                     </div>
                                                 );
                                             })}
                                         </div>
                                     )}
                                 </div>
                             )}

                             {/* List of Assigned Subjects with Multi-Faculty Dropdowns */}
                             <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                 {(formData.subjectAssignments || []).length === 0 && (
                                     <div className="text-center p-6 border border-dashed border-slate-700 rounded-lg text-slate-500 text-sm">
                                         No subjects assigned to this batch yet.
                                     </div>
                                 )}
                                 
                                 {(formData.subjectAssignments || []).map((assignment: any) => {
                                     const subject = subjects.find(s => s.id === assignment.subjectId);
                                     if (!subject) return null;

                                     // Safe access for faculty.subjects array
                                     const eligibleFaculty = faculty.filter(f => (f.subjects || []).includes(subject.id));
                                     const assignedFacultyIds = assignment.facultyIds || [];
                                     
                                     // Check if dropdown for this subject row is open
                                     const isDropdownOpen = openFacultyDropdownSubjectId === subject.id;

                                     return (
                                         <div key={assignment.subjectId} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 animate-in fade-in slide-in-from-left-2">
                                             <div className="flex justify-between items-start mb-2">
                                                 <div>
                                                     <div className="font-medium text-slate-200 text-sm">{subject.name}</div>
                                                     <div className="text-xs text-slate-500 font-mono">{subject.code} • {subject.lecturesPerWeek} lec/wk</div>
                                                 </div>
                                                 <button 
                                                     type="button" 
                                                     onClick={() => handleBatchSubjectToggle(subject.id)}
                                                     className="text-slate-500 hover:text-red-400"
                                                 >
                                                     <X size={16} />
                                                 </button>
                                             </div>
                                             
                                             {/* Multi-Select Faculty */}
                                             <div className="relative">
                                                 <div 
                                                     onClick={() => setOpenFacultyDropdownSubjectId(isDropdownOpen ? null : subject.id)}
                                                     className="bg-slate-900 border border-slate-600 rounded-md p-2 flex items-center justify-between cursor-pointer hover:border-primary transition-colors"
                                                 >
                                                     <div className="flex items-center gap-2 overflow-hidden">
                                                         <Users size={14} className="text-slate-500 flex-shrink-0" />
                                                         <span className="text-sm text-slate-200 truncate">
                                                             {assignedFacultyIds.length > 0 
                                                                ? `${assignedFacultyIds.length} Teacher(s) Assigned`
                                                                : "Assign Teachers..."}
                                                         </span>
                                                     </div>
                                                     <ChevronDown size={14} className="text-slate-500" />
                                                 </div>

                                                 {isDropdownOpen && (
                                                     <div className="absolute z-20 top-full left-0 w-full mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                                         {eligibleFaculty.map(f => {
                                                             const isSelected = assignedFacultyIds.includes(f.id);
                                                             return (
                                                                 <div 
                                                                    key={f.id}
                                                                    onClick={() => toggleBatchFaculty(subject.id, f.id)}
                                                                    className="flex items-center gap-2 p-2 hover:bg-white/5 cursor-pointer"
                                                                 >
                                                                     <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-slate-600'}`}>
                                                                         {isSelected && <Check size={10} className="text-white" />}
                                                                     </div>
                                                                     <span className="text-sm text-slate-200">{f.name}</span>
                                                                 </div>
                                                             )
                                                         })}
                                                         {/* Show Other Faculty Separator */}
                                                         {faculty.filter(f => !(f.subjects || []).includes(subject.id)).length > 0 && (
                                                             <div className="border-t border-slate-700 my-1 pt-1">
                                                                 <div className="px-2 text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Others</div>
                                                                 {faculty.filter(f => !(f.subjects || []).includes(subject.id)).map(f => {
                                                                     const isSelected = assignedFacultyIds.includes(f.id);
                                                                     return (
                                                                         <div 
                                                                            key={f.id}
                                                                            onClick={() => toggleBatchFaculty(subject.id, f.id)}
                                                                            className="flex items-center gap-2 p-2 hover:bg-white/5 cursor-pointer opacity-75"
                                                                         >
                                                                             <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-slate-600'}`}>
                                                                                 {isSelected && <Check size={10} className="text-white" />}
                                                                             </div>
                                                                             <span className="text-sm text-slate-200">{f.name}</span>
                                                                         </div>
                                                                     )
                                                                 })}
                                                             </div>
                                                         )}
                                                     </div>
                                                 )}
                                             </div>
                                         </div>
                                     );
                                 })}
                             </div>
                        </div>
                    </>
                );
            case ResourceType.DEPARTMENT:
                return (
                    <>
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-slate-400 mb-1">Department Name</label>
                            <input name="name" value={formData.name || ''} required autoFocus className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-primary focus:border-primary" onChange={handleChange} />
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-slate-400 mb-1">Code</label>
                            <input name="code" value={formData.code || ''} required className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-primary focus:border-primary" onChange={handleChange} />
                        </div>
                    </>
                );
            default:
                return null;
        }
    }

    const titles: Record<ResourceType, string> = {
        [ResourceType.FACULTY]: 'Faculty Member',
        [ResourceType.SUBJECT]: 'Subject',
        [ResourceType.ROOM]: 'Room',
        [ResourceType.BATCH]: 'Batch',
        [ResourceType.DEPARTMENT]: 'Department'
    };

    const isEditing = !!initialData;
    const titlePrefix = isEditing ? "Edit" : "Add New";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-glassBorder rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white"
                >
                    <X size={20} />
                </button>
                
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    {isEditing ? <Edit size={24} className="text-primary" /> : <Plus size={24} className="text-primary" />}
                    {titlePrefix} {titles[type]}
                </h2>
                
                <form onSubmit={handleSubmit}>
                    {renderFormFields()}
                    
                    <div className="flex justify-end gap-3 mt-6">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-4 py-2 rounded-lg bg-primary hover:bg-indigo-500 text-white font-medium flex items-center gap-2"
                        >
                            <Check size={16} />
                            {isEditing ? "Save Changes" : "Create"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const DataManagement = () => {
    const { 
        faculty, subjects, rooms, batches, departments,
        addFaculty, addRoom, addSubject, addBatch, addDepartment,
        updateFaculty, updateRoom, updateSubject, updateBatch, updateDepartment,
        deleteFaculty, deleteRoom, deleteSubject, deleteBatch, deleteDepartment
    } = useStore();
    
    // Modal States
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState<ResourceType | null>(null);
    const [editingItem, setEditingItem] = useState<any>(null);

    // Delete Modal States
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{type: ResourceType, id: string} | null>(null);

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

        console.log(`Executing delete for ${deleteTarget.type} ID: ${deleteTarget.id}`);
        
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
        <div className="h-[calc(100vh-8rem)]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full pb-8">
                <DataTable 
                    title="Faculty" 
                    icon={User} 
                    data={faculty}
                    onAdd={() => openAddModal(ResourceType.FACULTY)}
                    onEdit={(item) => openEditModal(ResourceType.FACULTY, item)}
                    onDelete={(id) => triggerDelete(ResourceType.FACULTY, id)}
                    columns={[
                        { key: 'name', label: 'Name', render: (f: any) => <span className="font-medium text-white">{f.name}</span> },
                        { key: 'subjects', label: 'Subjects Taught', render: (f: any) => f.subjects?.length || 0 }
                    ]}
                />
                <DataTable 
                    title="Departments" 
                    icon={Building} 
                    data={departments}
                    onAdd={() => openAddModal(ResourceType.DEPARTMENT)}
                    onEdit={(item) => openEditModal(ResourceType.DEPARTMENT, item)}
                    onDelete={(id) => triggerDelete(ResourceType.DEPARTMENT, id)}
                    columns={[
                        { key: 'name', label: 'Name', render: (d: any) => <span className="font-medium text-white">{d.name}</span> },
                        { key: 'code', label: 'Code', render: (d: any) => <span className="font-mono text-accent">{d.code}</span> }
                    ]}
                />
                <DataTable 
                    title="Subjects" 
                    icon={BookOpen} 
                    data={subjects}
                    onAdd={() => openAddModal(ResourceType.SUBJECT)}
                    onEdit={(item) => openEditModal(ResourceType.SUBJECT, item)}
                    onDelete={(id) => triggerDelete(ResourceType.SUBJECT, id)}
                    columns={[
                        { key: 'code', label: 'Code', render: (s: any) => <span className="font-mono text-accent">{s.code}</span> },
                        { key: 'name', label: 'Name' },
                        { key: 'credits', label: 'Credits' },
                        { key: 'lecturesPerWeek', label: 'Lectures/Week' },
                        { key: 'requiredRoomType', label: 'Type' }
                    ]}
                />
                <DataTable 
                    title="Rooms" 
                    icon={Box} 
                    data={rooms}
                    onAdd={() => openAddModal(ResourceType.ROOM)}
                    onEdit={(item) => openEditModal(ResourceType.ROOM, item)}
                    onDelete={(id) => triggerDelete(ResourceType.ROOM, id)}
                    columns={[
                        { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-white">{r.name}</span> },
                        { key: 'type', label: 'Type' },
                        { key: 'capacity', label: 'Capacity' }
                    ]}
                />
                <DataTable 
                    title="Batches" 
                    icon={Layers} 
                    data={batches}
                    onAdd={() => openAddModal(ResourceType.BATCH)}
                    onEdit={(item) => openEditModal(ResourceType.BATCH, item)}
                    onDelete={(id) => triggerDelete(ResourceType.BATCH, id)}
                    columns={[
                        { key: 'name', label: 'Name', render: (b: any) => <span className="font-medium text-white">{b.name}</span> },
                        { key: 'size', label: 'Students' },
                        { key: 'subjects', label: 'Subjects', render: (b: any) => (b.subjectAssignments || b.subjects || []).length }
                    ]}
                />
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

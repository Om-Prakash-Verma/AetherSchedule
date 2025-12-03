import React, { useState, useEffect } from 'react';
import { Plus, X, Check, Edit, ChevronDown, Users } from 'lucide-react';
import { Subject, Faculty, ResourceType, Room } from '../../../types';

interface ResourceModalProps { 
    isOpen: boolean; 
    onClose: () => void; 
    type: ResourceType | null;
    initialData?: any; 
    onSave: (data: any) => void;
    subjects: Subject[];
    faculty: Faculty[];
    rooms: Room[];
}

const ResourceModal: React.FC<ResourceModalProps> = ({ 
    isOpen, 
    onClose, 
    type, 
    initialData,
    onSave,
    subjects,
    faculty,
    rooms
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
                                                 const isSelected = (formData.subjects || []).includes(s.id);
                                                 // Check if this subject is assigned to this faculty
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
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-glassBorder rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
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
                    
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
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

export default ResourceModal;
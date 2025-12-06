import React, { useState, useEffect } from 'react';
import { Plus, X, Check, Edit, ChevronDown, Users, BookOpen, Search } from 'lucide-react';
import { Subject, Faculty, ResourceType, Room } from '../../../types';
import { clsx } from 'clsx';

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
    const [facultySearchTerm, setFacultySearchTerm] = useState('');

    // Populate form data when modal opens or initialData changes
    useEffect(() => {
        if (isOpen) {
            setFormData(initialData || {});
            setIsSubjectDropdownOpen(false);
            setOpenFacultyDropdownSubjectId(null);
            setFacultySearchTerm('');
        }
    }, [isOpen, type, initialData]);

    if (!isOpen || !type) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
        setFormData({});
        setIsSubjectDropdownOpen(false);
        setFacultySearchTerm('');
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
                    <div className="space-y-6">
                        {/* Basic Info Section */}
                        <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5 space-y-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Basic Configuration</h3>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Batch Name</label>
                                <input 
                                    name="name" 
                                    placeholder="e.g. Class 10-A"
                                    value={formData.name || ''} 
                                    required 
                                    autoFocus 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-primary focus:border-primary placeholder:text-slate-600 font-medium" 
                                    onChange={handleChange} 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Class Size</label>
                                    <div className="relative">
                                        <input 
                                            name="size" 
                                            value={formData.size || ''} 
                                            type="number" 
                                            required 
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-primary focus:border-primary" 
                                            onChange={handleChange} 
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">Students</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Home Room <span className="text-slate-600">(Optional)</span></label>
                                    <select 
                                        name="fixedRoomId" 
                                        value={formData.fixedRoomId || ''} 
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-primary focus:border-primary appearance-none" 
                                        onChange={handleChange}
                                    >
                                        <option value="">No Fixed Room</option>
                                        {rooms.filter(r => r.type === 'LECTURE').map(r => (
                                            <option key={r.id} value={r.id}>{r.name} (Cap: {r.capacity})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        {/* Curriculum Section */}
                        <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5 flex flex-col h-[400px]">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Curriculum</h3>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Assign subjects and preferred teachers.</p>
                                </div>
                                
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsSubjectDropdownOpen(!isSubjectDropdownOpen)}
                                        className="flex items-center gap-2 bg-primary hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-lg shadow-primary/20"
                                    >
                                        <Plus size={14} /> Add Subject
                                    </button>
                                     
                                     {/* Subject Dropdown */}
                                     {isSubjectDropdownOpen && (
                                         <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                             <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
                                                 {subjects.length === 0 ? (
                                                     <div className="p-3 text-xs text-slate-500 text-center">No subjects defined.</div>
                                                 ) : (
                                                     subjects.map(s => {
                                                         const isAssigned = (formData.subjectAssignments || []).some((a: any) => a.subjectId === s.id);
                                                         if (isAssigned) return null;

                                                         return (
                                                             <button
                                                                key={s.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    handleBatchSubjectToggle(s.id);
                                                                    setIsSubjectDropdownOpen(false);
                                                                }}
                                                                className="w-full text-left flex items-center justify-between p-2 rounded-lg hover:bg-white/10 group transition-colors"
                                                             >
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-medium text-slate-200 group-hover:text-white">{s.name}</span>
                                                                    <span className="text-[10px] text-slate-500 font-mono">{s.code}</span>
                                                                </div>
                                                                <Plus size={14} className="text-slate-600 group-hover:text-primary" />
                                                             </button>
                                                         );
                                                     })
                                                 )}
                                                 {subjects.every(s => (formData.subjectAssignments || []).some((a: any) => a.subjectId === s.id)) && (
                                                     <div className="p-3 text-xs text-slate-500 text-center italic">All subjects assigned.</div>
                                                 )}
                                             </div>
                                         </div>
                                     )}
                                </div>
                            </div>

                            {/* Assigned Subjects List */}
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                                {(formData.subjectAssignments || []).length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                                        <div className="p-3 bg-slate-800 rounded-full mb-3">
                                            <BookOpen size={24} className="opacity-50" />
                                        </div>
                                        <p className="text-sm font-medium">No subjects assigned</p>
                                        <p className="text-xs opacity-60 mt-1">Click "Add Subject" to build the curriculum.</p>
                                    </div>
                                )}
                                
                                {(formData.subjectAssignments || []).map((assignment: any) => {
                                    const subject = subjects.find(s => s.id === assignment.subjectId);
                                    if (!subject) return null;

                                    const eligibleFaculty = faculty.filter(f => (f.subjects || []).includes(subject.id));
                                    const assignedFacultyIds = assignment.facultyIds || [];
                                    const isDropdownOpen = openFacultyDropdownSubjectId === subject.id;

                                    // Filter faculty based on search term
                                    const filteredEligible = eligibleFaculty.filter(f => 
                                        f.name.toLowerCase().includes(facultySearchTerm.toLowerCase())
                                    );
                                    
                                    const otherFaculty = faculty.filter(f => !eligibleFaculty.find(ef => ef.id === f.id));
                                    const filteredOthers = otherFaculty.filter(f => 
                                        f.name.toLowerCase().includes(facultySearchTerm.toLowerCase())
                                    );

                                    return (
                                        <div key={assignment.subjectId} className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex flex-col gap-3 group hover:border-slate-600 transition-colors">
                                            {/* Row Header */}
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className={clsx(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold",
                                                        subject.requiredRoomType === 'LAB' 
                                                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" 
                                                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                                    )}>
                                                        {subject.code.substring(0,3)}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-white text-sm">{subject.name}</div>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">{subject.code}</span>
                                                            <span>•</span>
                                                            <span>{subject.lecturesPerWeek} Lectures/Wk</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleBatchSubjectToggle(subject.id)}
                                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Remove Subject"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                            
                                            {/* Faculty Assignment Bar */}
                                            <div className="relative">
                                                 <button
                                                     type="button"
                                                     onClick={() => {
                                                         setOpenFacultyDropdownSubjectId(isDropdownOpen ? null : subject.id);
                                                         setFacultySearchTerm(''); // Reset search when toggling
                                                     }}
                                                     className={clsx(
                                                         "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                                                         assignedFacultyIds.length > 0
                                                             ? "bg-slate-800 border-slate-700 text-slate-200"
                                                             : "bg-red-500/5 border-red-500/20 text-red-400 hover:bg-red-500/10"
                                                     )}
                                                 >
                                                     <div className="flex items-center gap-2">
                                                         <Users size={14} />
                                                         {assignedFacultyIds.length > 0 ? (
                                                             <span className="truncate">
                                                                 {assignedFacultyIds.map((fid: string) => faculty.find(f => f.id === fid)?.name).join(', ')}
                                                             </span>
                                                         ) : (
                                                             <span>Missing Teacher Assignment</span>
                                                         )}
                                                     </div>
                                                     <ChevronDown size={14} className={clsx("transition-transform", isDropdownOpen && "rotate-180")} />
                                                 </button>

                                                 {/* Faculty Dropdown */}
                                                 {isDropdownOpen && (
                                                     <div className="absolute top-full left-0 w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden max-h-60 flex flex-col">
                                                        
                                                        {/* Search Input */}
                                                        <div className="p-2 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
                                                            <div className="relative">
                                                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                                                <input
                                                                    type="text"
                                                                    autoFocus
                                                                    placeholder="Search teacher..."
                                                                    value={facultySearchTerm}
                                                                    onChange={(e) => setFacultySearchTerm(e.target.value)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-primary placeholder:text-slate-600"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="overflow-y-auto custom-scrollbar p-1">
                                                            {/* Recommended Section */}
                                                            {(filteredEligible.length > 0 || !facultySearchTerm) && (
                                                                <>
                                                                    <div className="px-2 py-1 text-[10px] text-slate-500 uppercase font-bold tracking-wider">Recommended (Subject Match)</div>
                                                                    {eligibleFaculty.length === 0 && !facultySearchTerm && (
                                                                        <div className="px-2 text-xs text-slate-500 italic mb-1">No exact matches found.</div>
                                                                    )}
                                                                    {filteredEligible.map(f => (
                                                                        <button
                                                                            type="button"
                                                                            key={f.id}
                                                                            onClick={() => toggleBatchFaculty(subject.id, f.id)}
                                                                            className="w-full text-left flex items-center gap-2 p-2 hover:bg-white/5 rounded-md cursor-pointer"
                                                                        >
                                                                            <div className={clsx(
                                                                                "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                                                                                assignedFacultyIds.includes(f.id) ? 'bg-primary border-primary' : 'border-slate-600'
                                                                            )}>
                                                                                {assignedFacultyIds.includes(f.id) && <Check size={10} className="text-white" />}
                                                                            </div>
                                                                            <span className="text-sm text-slate-200">{f.name}</span>
                                                                        </button>
                                                                    ))}
                                                                </>
                                                            )}

                                                            {/* Others Section */}
                                                            {(filteredOthers.length > 0 || (!facultySearchTerm && otherFaculty.length > 0)) && (
                                                                <div className="border-t border-slate-800 my-1 pt-1">
                                                                    <div className="px-2 py-1 text-[10px] text-slate-500 uppercase font-bold tracking-wider">All Faculty</div>
                                                                    {filteredOthers.map(f => (
                                                                        <button
                                                                            type="button"
                                                                            key={f.id}
                                                                            onClick={() => toggleBatchFaculty(subject.id, f.id)}
                                                                            className="w-full text-left flex items-center gap-2 p-2 hover:bg-white/5 rounded-md cursor-pointer opacity-75"
                                                                        >
                                                                            <div className={clsx(
                                                                                "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                                                                                assignedFacultyIds.includes(f.id) ? 'bg-primary border-primary' : 'border-slate-600'
                                                                            )}>
                                                                                {assignedFacultyIds.includes(f.id) && <Check size={10} className="text-white" />}
                                                                            </div>
                                                                            <span className="text-sm text-slate-200">{f.name}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* No Results State */}
                                                            {facultySearchTerm && filteredEligible.length === 0 && filteredOthers.length === 0 && (
                                                                <div className="p-4 text-center text-xs text-slate-500">
                                                                    No teachers found for "{facultySearchTerm}"
                                                                </div>
                                                            )}
                                                        </div>
                                                     </div>
                                                 )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
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
            <div className="bg-slate-900 border border-glassBorder rounded-t-2xl sm:rounded-2xl w-full max-w-2xl shadow-2xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto">
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
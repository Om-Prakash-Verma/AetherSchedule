import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { GlassButton } from '../components/GlassButton';
import { useAppContext } from '../hooks/useAppContext';
import { useToast } from '../hooks/useToast';
import { Save, RefreshCw, PlusCircle, Cpu, Trash2, Download, Upload } from 'lucide-react';
import * as api from '../services';
import type { GlobalConstraints, User, TimetableSettings } from '../types';
import { Slider } from '../components/ui/Slider';
import { DataTable } from '../components/DataTable';
import { DataFormModal } from '../components/DataFormModal';

type SettingsTab = 'constraints' | 'structure' | 'users' | 'system';

const Settings: React.FC = () => {
    const { 
        globalConstraints, setGlobalConstraints, timetableSettings, setTimetableSettings, 
        refreshData, users, fetchUsers, loadingStates 
    } = useAppContext();
    const [activeTab, setActiveTab] = useState<SettingsTab>('constraints');
    const [localConstraints, setLocalConstraints] = useState<GlobalConstraints | null>(globalConstraints);
    const [localTimetableSettings, setLocalTimetableSettings] = useState<TimetableSettings | null>(timetableSettings);
    const [isSaving, setIsSaving] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLocalConstraints(globalConstraints);
    }, [globalConstraints]);

    useEffect(() => {
        setLocalTimetableSettings(timetableSettings);
    }, [timetableSettings]);
    
    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        }
    }, [activeTab, fetchUsers]);

    const handleSaveUser = useCallback(async (user: User) => {
        try {
            await api.saveUser(user);
            await refreshData();
            toast.success('User saved successfully.');
            setIsUserModalOpen(false);
            setEditingUser(null);
        } catch (error: any) {
            toast.error(error.message || 'Failed to save user.');
        }
    }, [refreshData, toast]);

    const handleDeleteUser = useCallback(async (user: User) => {
        if (!window.confirm(`Are you sure you want to delete user ${user.name}?`)) return;
        try {
            await api.deleteUser(user.id);
            await refreshData();
            toast.success('User deleted successfully.');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete user.');
        }
    }, [refreshData, toast]);

    const handleSliderChange = (key: keyof Omit<GlobalConstraints, 'id'>, value: number) => {
        setLocalConstraints(prev => prev ? { ...prev, [key]: value } : null);
    };

    const handleSaveConstraints = async () => {
        if (!localConstraints) return;
        setIsSaving(true);
        try {
            const saved = await api.saveGlobalConstraints(localConstraints);
            setGlobalConstraints(saved);
            toast.success('Global constraints updated successfully!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update settings.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleSaveTimetableSettings = async () => {
        if (!localTimetableSettings) return;

        // FIX: Add robust client-side validation before saving.
        if (!localTimetableSettings.periodDuration || Number(localTimetableSettings.periodDuration) <= 0) {
            toast.error("Period Duration must be a positive number.");
            return;
        }

        setIsSaving(true);
        try {
            const saved = await api.saveTimetableSettings(localTimetableSettings);
            setTimetableSettings(saved); // This updates the context
            toast.success('Timetable structure updated successfully!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update settings.');
        } finally {
            setIsSaving(false);
        }
    }
    
    const handleTimetableSettingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        // FIX: Adopted a safer pattern for number inputs to avoid NaN in state.
        const finalValue = type === 'number' ? (value === '' ? '' : Number(value)) : value;
        setLocalTimetableSettings(prev => prev ? { ...prev, [name]: finalValue } : null);
    };

    const handleBreakChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const newBreaks = [...(localTimetableSettings?.breaks || [])];
        newBreaks[index] = { ...newBreaks[index], [name]: value };
        setLocalTimetableSettings(prev => prev ? { ...prev, breaks: newBreaks } : null);
    };

    const addBreak = () => {
        const newBreak = { name: 'New Break', startTime: '12:00', endTime: '13:00' };
        const newBreaks = [...(localTimetableSettings?.breaks || []), newBreak];
        setLocalTimetableSettings(prev => prev ? { ...prev, breaks: newBreaks } : null);
    };

    const removeBreak = (index: number) => {
        const newBreaks = [...(localTimetableSettings?.breaks || [])];
        newBreaks.splice(index, 1);
        setLocalTimetableSettings(prev => prev ? { ...prev, breaks: newBreaks } : null);
    };

    const handleResetData = async () => {
        if (!window.confirm("Are you sure you want to reset all application data? This will restore the initial seed data and cannot be undone.")) return;
        setIsResetting(true);
        try {
            await api.resetData();
            await refreshData();
            toast.success('Application data has been reset to default.');
        } catch (error: any) {
            toast.error(error.message || 'Failed to reset data.');
        } finally {
            setIsResetting(false);
        }
    };
    
    const handleExport = () => {
        toast.info("Preparing your data for download...");
        window.location.href = '/api/data/export';
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        // Clear file input value to allow re-selecting the same file
        const resetFileInput = () => { if(fileInputRef.current) fileInputRef.current.value = ""; };

        if (!window.confirm("This will overwrite existing data like subjects, faculty, and rooms based on the import file. This action cannot be undone. Are you sure you want to continue?")) {
            resetFileInput();
            return;
        }

        setIsImporting(true);
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!data.subjects || !data.faculty || !data.rooms || !data.batches || !data.departments || !data.facultyAllocations || !data.users) {
                throw new Error("Invalid file format. The file is missing required data sections (including users).");
            }

            const result = await api.importDataManagementData(data);
            await refreshData();
            toast.success(result.message || 'Data imported successfully!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to import data.');
        } finally {
            setIsImporting(false);
            resetFileInput();
        }
    };

    const userColumns: { accessor: keyof User; header: string }[] = [
        { accessor: 'name', header: 'Name' },
        { accessor: 'email', header: 'Email' },
        { accessor: 'role', header: 'Role' },
    ];

    const renderContent = () => {
        if (activeTab === 'constraints') {
            if (!localConstraints) return <p className="text-text-muted text-center py-8">Loading constraints...</p>;
            type ConstraintKey = 'studentGapWeight' | 'facultyGapWeight' | 'facultyWorkloadDistributionWeight' | 'facultyPreferenceWeight';
            const constraintFields: {key: ConstraintKey, aiKey: keyof GlobalConstraints, label: string, description: string}[] = [
                { key: 'studentGapWeight', aiKey: 'aiStudentGapWeight', label: 'Student Gap Weight', description: 'Penalty for gaps between classes for a student on the same day.' },
                { key: 'facultyGapWeight', aiKey: 'aiFacultyGapWeight', label: 'Faculty Gap Weight', description: 'Penalty for gaps between classes for a faculty member on the same day.' },
                { key: 'facultyWorkloadDistributionWeight', aiKey: 'aiFacultyWorkloadDistributionWeight', label: 'Faculty Workload Variance Weight', description: 'Penalty for uneven distribution of teaching hours among faculty.' },
                { key: 'facultyPreferenceWeight', aiKey: 'aiFacultyPreferenceWeight', label: 'Faculty Preference Violation Weight', description: 'Penalty for assigning a faculty member outside their preferred slots.' },
            ];
            return (
                 <div className="space-y-8">
                    <div>
                        <h3 className="text-lg font-bold text-white mb-2">Base Weights</h3>
                        <p className="text-sm text-text-muted mb-6">Set the foundational importance of each soft constraint. The AI will use these as a baseline and may tune them further based on faculty feedback.</p>
                    </div>
                    {constraintFields.map(({key, aiKey, label, description}) => (
                         <div key={key}>
                            <div className="flex justify-between items-center">
                                <div>
                                    <label className="block font-medium text-white">{label}</label>
                                    <p className="text-xs text-text-muted">{description}</p>
                                </div>
                                <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-panel-strong border border-[var(--border)]">
                                    <Cpu size={16} className="text-[var(--accent)]"/>
                                    <span className="text-text-muted">AI Tuned:</span>
                                    <span className="font-mono text-[var(--accent)] font-bold">{localConstraints[aiKey]}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 mt-3">
                                <Slider 
                                    value={[localConstraints[key] as number]}
                                    onValueChange={([val]) => handleSliderChange(key, val)}
                                    max={50}
                                    step={1}
                                />
                                <span className="font-mono text-white w-16 text-center p-2 rounded-md bg-white/5 border border-transparent">
                                    {localConstraints[key]}
                                </span>
                            </div>
                        </div>
                    ))}
                    <div className="mt-8 pt-6 border-t border-[var(--border)] flex justify-end">
                        <GlassButton icon={Save} onClick={handleSaveConstraints} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Base Weights'}
                        </GlassButton>
                    </div>
                </div>
            )
        }
        if (activeTab === 'structure') {
            if (!localTimetableSettings) return <p className="text-text-muted text-center py-8">Loading settings...</p>;
            return (
                <div className="space-y-6">
                     <div>
                        <h3 className="text-lg font-bold text-white mb-2">Academic Hours</h3>
                        <p className="text-sm text-text-muted mb-4">Define the core timing for the entire institution.</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">College Start Time</label>
                                <input type="time" name="collegeStartTime" value={localTimetableSettings.collegeStartTime} onChange={handleTimetableSettingChange} className="glass-input"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">College End Time</label>
                                <input type="time" name="collegeEndTime" value={localTimetableSettings.collegeEndTime} onChange={handleTimetableSettingChange} className="glass-input"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">Period Duration (minutes)</label>
                                {/* FIX: Bind value to `... || ''` to prevent React uncontrolled component warnings. */}
                                <input type="number" name="periodDuration" value={localTimetableSettings.periodDuration || ''} onChange={handleTimetableSettingChange} className="glass-input"/>
                            </div>
                        </div>
                    </div>
                    
                    <div className="pt-6 border-t border-[var(--border)]">
                        <div className="flex justify-between items-center mb-4">
                             <div>
                                <h3 className="text-lg font-bold text-white">Breaks</h3>
                                <p className="text-sm text-text-muted">Define periods when no classes should be scheduled.</p>
                            </div>
                            <GlassButton icon={PlusCircle} onClick={addBreak} variant="secondary">Add Break</GlassButton>
                        </div>
                        <div className="space-y-2">
                            {/* FIX: Guard against `breaks` being null/undefined to prevent crashes. */}
                            {(localTimetableSettings.breaks || []).map((breakItem, index) => (
                                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center bg-panel-strong p-2 rounded-lg">
                                    <input type="text" name="name" value={breakItem.name} onChange={(e) => handleBreakChange(index, e)} placeholder="Break Name" className="glass-input md:col-span-2"/>
                                    <input type="time" name="startTime" value={breakItem.startTime} onChange={(e) => handleBreakChange(index, e)} className="glass-input"/>
                                    <div className="flex items-center gap-2">
                                        <input type="time" name="endTime" value={breakItem.endTime} onChange={(e) => handleBreakChange(index, e)} className="glass-input"/>
                                        <GlassButton onClick={() => removeBreak(index)} variant="secondary" className="p-2 aspect-square hover:bg-red-500/20 hover:text-red-400">
                                            <Trash2 size={16}/>
                                        </GlassButton>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-[var(--border)] flex justify-end">
                        <GlassButton icon={Save} onClick={handleSaveTimetableSettings} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Structure'}
                        </GlassButton>
                    </div>
                </div>
            )
        }
        if (activeTab === 'users') {
             return (
                 <div>
                    <div className="flex justify-end mb-4">
                        <GlassButton icon={PlusCircle} onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }}>Add New User</GlassButton>
                    </div>
                    <DataTable<User> 
                        columns={userColumns} 
                        data={users} 
                        onEdit={(user) => { setEditingUser(user); setIsUserModalOpen(true); }} 
                        onDelete={handleDeleteUser}
                        isLoading={loadingStates.users}
                    />
                 </div>
             )
        }
        if (activeTab === 'system') {
            return (
                <>
                <div className="border border-[var(--border)] rounded-lg">
                     <div className="p-4">
                        <h3 className="text-lg font-bold text-white">Data Portability</h3>
                    </div>
                    <div className="p-4 border-t border-[var(--border)] bg-panel-strong flex flex-wrap justify-between items-center gap-4">
                        <div>
                            <p className="font-semibold text-white">Import / Export Foundational Data</p>
                            <p className="text-sm text-text-muted">Export or import subjects, faculty, rooms, batches, etc., via a JSON file. Useful for backups or migrations.</p>
                        </div>
                        <div className="flex gap-2">
                            <GlassButton variant="secondary" icon={Download} onClick={handleExport}>Export Data</GlassButton>
                            <GlassButton variant="secondary" icon={Upload} onClick={handleImportClick} disabled={isImporting}>
                                {isImporting ? 'Importing...' : 'Import Data'}
                            </GlassButton>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                        </div>
                    </div>
                </div>
                <div className="border border-red-500/30 rounded-lg mt-6">
                    <div className="p-4">
                        <h3 className="text-lg font-bold text-red-400">Danger Zone</h3>
                    </div>
                    <div className="p-4 border-t border-red-500/30 bg-red-500/10 flex justify-between items-center">
                        <div>
                            <p className="font-semibold text-white">Reset Application Data</p>
                            <p className="text-sm text-text-muted">This will delete all current data and restore the original seed data.</p>
                        </div>
                        <GlassButton variant="secondary" className="hover:bg-red-500/20 hover:text-red-400" icon={RefreshCw} onClick={handleResetData} disabled={isResetting}>
                            {isResetting ? 'Resetting...' : 'Reset Data'}
                        </GlassButton>
                    </div>
                </div>
                </>
            )
        }
    }
    
    return (
        <div className="space-y-6">
            <GlassPanel className="p-4 sm:p-6">
                <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>
                <div className="border-b border-[var(--border)] mb-6">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto">
                        <button onClick={() => setActiveTab('constraints')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'constraints' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-text-muted hover:text-white'}`}>Global Constraints</button>
                        <button onClick={() => setActiveTab('structure')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'structure' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-text-muted hover:text-white'}`}>Timetable Structure</button>
                        <button onClick={() => setActiveTab('users')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'users' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-text-muted hover:text-white'}`}>User Management</button>
                        <button onClick={() => setActiveTab('system')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'system' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-text-muted hover:text-white'}`}>System</button>
                    </nav>
                </div>
                {renderContent()}
            </GlassPanel>

            {isUserModalOpen && (
                <DataFormModal 
                  isOpen={isUserModalOpen}
                  onClose={() => { setEditingUser(null); setIsUserModalOpen(false); }}
                  onSave={(item: any) => handleSaveUser(item as User)}
                  dataType={'users'}
                  initialData={editingUser}
                />
            )}
        </div>
    );
};

export default Settings;
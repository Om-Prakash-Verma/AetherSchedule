import React, { useState, useEffect, useCallback } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { GlassButton } from '../components/GlassButton';
import { useAppContext } from '../hooks/useAppContext';
import { useToast } from '../hooks/useToast';
import { Save, RefreshCw, PlusCircle, Cpu } from 'lucide-react';
import * as api from '../services';
import type { GlobalConstraints, User } from '../types';
import { Slider } from '../components/ui/Slider';
import { DataTable } from '../components/DataTable';
import { DataFormModal } from '../components/DataFormModal';

type SettingsTab = 'constraints' | 'users' | 'system';

const Settings: React.FC = () => {
    const { globalConstraints, setGlobalConstraints, refreshData, users } = useAppContext();
    const [activeTab, setActiveTab] = useState<SettingsTab>('constraints');
    const [localConstraints, setLocalConstraints] = useState<GlobalConstraints | null>(globalConstraints);
    const [isSaving, setIsSaving] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const toast = useToast();

    useEffect(() => {
        setLocalConstraints(globalConstraints);
    }, [globalConstraints]);
    
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
        if (activeTab === 'users') {
             return (
                 <div>
                    <div className="flex justify-end mb-4">
                        <GlassButton icon={PlusCircle} onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }}>Add New User</GlassButton>
                    </div>
                    <DataTable<User> columns={userColumns} data={users} onEdit={(user) => { setEditingUser(user); setIsUserModalOpen(true); }} onDelete={handleDeleteUser} />
                 </div>
             )
        }
        if (activeTab === 'system') {
            return (
                <div className="border border-red-500/30 rounded-lg">
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
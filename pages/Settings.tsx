import React, { useState, useEffect } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { useAppContext } from '../hooks/useAppContext';
import { useToast } from '../hooks/useToast';
import * as api from '../services';
import { GlassButton } from '../components/GlassButton';
import { Save, AlertTriangle, Trash2, Sliders, Clock, Coffee } from 'lucide-react';
import { Slider } from '../components/ui/Slider';
import { useConfirm } from '../hooks/useConfirm';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DAYS_OF_WEEK } from '../constants';

const Settings: React.FC = () => {
    // FIX: Fetch settings with useQuery and get refresh function from context correctly.
    const { refreshAllData: refreshData } = useAppContext();
    const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
    const globalConstraints = settings?.globalConstraints;
    const timetableSettings = settings?.timetableSettings;

    const [localGlobalConstraints, setLocalGlobalConstraints] = useState(globalConstraints);
    const [localTimetableSettings, setLocalTimetableSettings] = useState(timetableSettings);
    const [newBreak, setNewBreak] = useState({ name: '', startTime: '', endTime: '' });
    const toast = useToast();
    const confirm = useConfirm();
    const queryClient = useQueryClient();

    useEffect(() => {
        setLocalGlobalConstraints(globalConstraints);
    }, [globalConstraints]);

    useEffect(() => {
        setLocalTimetableSettings(timetableSettings);
    }, [timetableSettings]);

    const handleGlobalChange = (key: string, value: number[]) => {
        if (localGlobalConstraints) {
            setLocalGlobalConstraints({ ...localGlobalConstraints, [key]: value[0] });
        }
    };

    const handleTimetableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (localTimetableSettings) {
            const { name, value, type } = e.target;
            setLocalTimetableSettings({ 
                ...localTimetableSettings, 
                [name]: type === 'number' ? Number(value) : value 
            });
        }
    };
    
    const handleWorkingDayToggle = (dayIndex: number) => {
        if (localTimetableSettings) {
            const currentDays = localTimetableSettings.workingDays || [];
            const newDays = currentDays.includes(dayIndex)
                ? currentDays.filter(d => d !== dayIndex)
                : [...currentDays, dayIndex].sort((a, b) => a - b);
            setLocalTimetableSettings({ ...localTimetableSettings, workingDays: newDays });
        }
    };

    const handleAddBreak = () => {
        if (localTimetableSettings && newBreak.name && newBreak.startTime && newBreak.endTime) {
            const updatedBreaks = [...(localTimetableSettings.breaks || []), newBreak];
            setLocalTimetableSettings({ ...localTimetableSettings, breaks: updatedBreaks });
            setNewBreak({ name: '', startTime: '', endTime: '' });
        } else {
            toast.error("Please fill all fields for the break.");
        }
    };

    const handleRemoveBreak = (index: number) => {
        if (localTimetableSettings) {
            const updatedBreaks = localTimetableSettings.breaks.filter((_, i) => i !== index);
            setLocalTimetableSettings({ ...localTimetableSettings, breaks: updatedBreaks });
        }
    };

    const handleSaveGlobal = async () => {
        if (!localGlobalConstraints) return;
        try {
            await api.saveGlobalConstraints(localGlobalConstraints);
            queryClient.invalidateQueries({ queryKey: ['settings'] });
            toast.success("AI constraint weights saved.");
        } catch (error: any) {
            toast.error(error.message || "Failed to save settings.");
        }
    };

    const handleSaveTimetable = async () => {
        if (!localTimetableSettings) return;
        try {
            await api.saveTimetableSettings(localTimetableSettings);
            queryClient.invalidateQueries({ queryKey: ['settings'] });
            toast.success("Timetable structure settings saved.");
        } catch (error: any) {
            toast.error(error.message || "Failed to save settings.");
        }
    };
    
    const handleResetData = async () => {
        const confirmed = await confirm({
            title: 'Confirm System Reset',
            description: 'ARE YOU SURE? This will delete ALL data and reset the system to its initial state. This action cannot be undone.'
        });

        if (confirmed) {
            try {
                await api.resetData();
                toast.success("System data has been reset. Please log in again.");
                // A full reload is appropriate here to clear all state
                window.location.reload();
            } catch (error: any) {
                toast.error(error.message || "Failed to reset data.");
            }
        }
    };

    if (!localGlobalConstraints || !localTimetableSettings) {
        return <div>Loading settings...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* AI Constraint Settings */}
                <GlassPanel className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <Sliders size={20} className="text-accent"/>
                                <h2 className="text-xl font-bold text-white">AI Constraint Weights</h2>
                            </div>
                            <p className="text-sm text-text-muted">Tune the AI's priorities. Higher weights mean a higher penalty.</p>
                        </div>
                        <GlassButton icon={Save} onClick={handleSaveGlobal}>Save</GlassButton>
                    </div>
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between items-center mb-2"><label className="text-sm font-medium">Student Gaps</label><span className="text-sm font-mono text-accent">{localGlobalConstraints.studentGapWeight}</span></div>
                            <Slider value={[localGlobalConstraints.studentGapWeight]} onValueChange={v => handleGlobalChange('studentGapWeight', v)} max={20} step={1} />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2"><label className="text-sm font-medium">Faculty Gaps</label><span className="text-sm font-mono text-accent">{localGlobalConstraints.facultyGapWeight}</span></div>
                            <Slider value={[localGlobalConstraints.facultyGapWeight]} onValueChange={v => handleGlobalChange('facultyGapWeight', v)} max={20} step={1} />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2"><label className="text-sm font-medium">Faculty Workload Variance</label><span className="text-sm font-mono text-accent">{localGlobalConstraints.facultyWorkloadDistributionWeight}</span></div>
                            <Slider value={[localGlobalConstraints.facultyWorkloadDistributionWeight]} onValueChange={v => handleGlobalChange('facultyWorkloadDistributionWeight', v)} max={20} step={1} />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2"><label className="text-sm font-medium">Faculty Preference Violations</label><span className="text-sm font-mono text-accent">{localGlobalConstraints.facultyPreferenceWeight}</span></div>
                            <Slider value={[localGlobalConstraints.facultyPreferenceWeight]} onValueChange={v => handleGlobalChange('facultyPreferenceWeight', v)} max={20} step={1} />
                        </div>
                    </div>
                </GlassPanel>

                {/* Timetable Structure Settings */}
                <GlassPanel className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                             <div className="flex items-center gap-3 mb-1">
                                <Clock size={20} className="text-accent"/>
                                <h2 className="text-xl font-bold text-white">Timetable Structure</h2>
                            </div>
                            <p className="text-sm text-text-muted">Define the fundamental structure of the academic day.</p>
                        </div>
                        <GlassButton icon={Save} onClick={handleSaveTimetable}>Save</GlassButton>
                    </div>
                     <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-sm">Start Time</label><input type="time" name="collegeStartTime" value={localTimetableSettings.collegeStartTime} onChange={handleTimetableChange} className="glass-input w-full mt-1"/></div>
                            <div><label className="text-sm">End Time</label><input type="time" name="collegeEndTime" value={localTimetableSettings.collegeEndTime} onChange={handleTimetableChange} className="glass-input w-full mt-1"/></div>
                        </div>
                        <div>
                            <label className="text-sm">Period Duration (minutes)</label>
                            <input type="number" name="periodDuration" value={localTimetableSettings.periodDuration} onChange={handleTimetableChange} className="glass-input w-full mt-1"/>
                        </div>
                        <div>
                            <label className="text-sm">Working Days</label>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-1">
                                {DAYS_OF_WEEK.map((day, index) => (
                                    <button
                                        key={day}
                                        onClick={() => handleWorkingDayToggle(index)}
                                        className={`p-2 rounded-lg text-sm font-semibold transition-all duration-200 border
                                            ${localTimetableSettings.workingDays?.includes(index)
                                                ? 'bg-accent text-white border-transparent'
                                                : 'bg-panel-strong text-text-muted border-border hover:border-accent/50'
                                            }`}
                                    >
                                        {day.substring(0, 3)}
                                    </button>
                                ))}
                            </div>
                        </div>
                         <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Coffee size={16} className="text-accent"/>
                                <h3 className="text-lg font-semibold text-white">Breaks</h3>
                            </div>
                            <div className="space-y-2">
                                {localTimetableSettings.breaks.map((b, i) => (
                                    <div key={i} className="flex items-center gap-2 p-2 bg-panel-strong rounded-md">
                                        <span className="flex-1 text-sm">{b.name} ({b.startTime} - {b.endTime})</span>
                                        <button onClick={() => handleRemoveBreak(i)} className="p-1 text-text-muted hover:text-red-400"><Trash2 size={14}/></button>
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-3">
                                <input value={newBreak.name} onChange={e => setNewBreak({...newBreak, name: e.target.value})} placeholder="Break Name" className="glass-input text-sm"/>
                                <input type="time" value={newBreak.startTime} onChange={e => setNewBreak({...newBreak, startTime: e.target.value})} className="glass-input text-sm"/>
                                <input type="time" value={newBreak.endTime} onChange={e => setNewBreak({...newBreak, endTime: e.target.value})} className="glass-input text-sm"/>
                            </div>
                            <GlassButton variant="secondary" onClick={handleAddBreak} className="w-full mt-2 text-sm py-1.5">Add Break</GlassButton>
                        </div>
                    </div>
                </GlassPanel>
            </div>
             {/* Danger Zone */}
            <GlassPanel className="p-6 border-2 border-danger/50">
                <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="text-danger"/>
                    <h2 className="text-xl font-bold text-red-300">Danger Zone</h2>
                </div>
                 <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <h3 className="font-semibold text-white">Reset All Data</h3>
                        <p className="text-sm text-text-muted">This will permanently delete all subjects, faculty, timetables, and settings, and restore the application to its initial demo state.</p>
                    </div>
                    <GlassButton onClick={handleResetData} className="bg-danger/80 hover:bg-danger text-white border-transparent">
                        <Trash2 size={16}/>
                        Reset Application Data
                    </GlassButton>
                 </div>
            </GlassPanel>
        </div>
    );
};

export default Settings;
import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Clock, Calendar, Coffee, Plus, Trash2, Save, AlertCircle, Edit, X, CheckCircle } from 'lucide-react';
import { DAYS, Break } from '../types';
import { clsx } from 'clsx';
import { timeToMinutes } from '../core/TimeUtils';

const Settings = () => {
    const { settings, updateSettings } = useStore();
    const [formData, setFormData] = useState(settings);
    
    // Break Management State
    const [breakForm, setBreakForm] = useState({ name: '', startTime: '', endTime: '' });
    const [editingBreakId, setEditingBreakId] = useState<string | null>(null);
    
    const [isDirty, setIsDirty] = useState(false);
    const [mainMessage, setMainMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
    const [breakMessage, setBreakMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

    // Sync form data with global settings on load
    useEffect(() => {
        setFormData(settings);
    }, [settings]);

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const toggleDay = (day: string) => {
        const currentDays = formData.workingDays || [];
        let newDays;
        if (currentDays.includes(day)) {
            newDays = currentDays.filter(d => d !== day);
        } else {
            // Sort according to standard week order
            newDays = [...currentDays, day].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
        }
        handleChange('workingDays', newDays);
    };

    const handleBreakSubmit = () => {
        setBreakMessage(null);

        if (!breakForm.name || !breakForm.startTime || !breakForm.endTime) {
            setBreakMessage({ type: 'error', text: "Please fill in all break fields." });
            return;
        }

        const start = timeToMinutes(breakForm.startTime);
        const end = timeToMinutes(breakForm.endTime);
        const collegeStart = timeToMinutes(formData.collegeStartTime);
        const collegeEnd = timeToMinutes(formData.collegeEndTime);

        // Validation
        if (start >= end) {
            setBreakMessage({ type: 'error', text: "End time must be after start time." });
            return;
        }
        if (start < collegeStart || end > collegeEnd) {
             setBreakMessage({ type: 'error', text: `Break must be between ${formData.collegeStartTime} and ${formData.collegeEndTime}.` });
             return;
        }

        // Safe access to breaks array
        const currentBreaks = formData.breaks || [];

        // Overlap check (exclude self if editing)
        const overlap = currentBreaks.some(b => {
             if (editingBreakId && b.id === editingBreakId) return false;
             const bStart = timeToMinutes(b.startTime);
             const bEnd = timeToMinutes(b.endTime);
             // Standard overlap logic: StartA < EndB && EndA > StartB
             return start < bEnd && end > bStart;
        });

        if (overlap) {
            setBreakMessage({ type: 'error', text: "Break overlaps with an existing break." });
            return;
        }

        let updatedBreaks: Break[];
        
        if (editingBreakId) {
            // Update existing break
            updatedBreaks = currentBreaks.map(b => 
                b.id === editingBreakId 
                    ? { ...b, ...breakForm } 
                    : b
            );
            setBreakMessage({ type: 'success', text: "Break updated. Save changes to apply." });
        } else {
            // Add new break
            updatedBreaks = [...currentBreaks, { ...breakForm, id: Math.random().toString(36).substr(2, 9) }];
            setBreakMessage({ type: 'success', text: "Break added. Save changes to apply." });
        }

        handleChange('breaks', updatedBreaks);
        
        // Reset form
        setBreakForm({ name: '', startTime: '', endTime: '' });
        setEditingBreakId(null);
        
        // Clear message after delay
        setTimeout(() => setBreakMessage(null), 4000);
    };

    const startEditingBreak = (b: Break) => {
        setBreakForm({
            name: b.name,
            startTime: b.startTime,
            endTime: b.endTime
        });
        setEditingBreakId(b.id);
        setBreakMessage({ type: 'success', text: `Editing "${b.name}"...` });
    };

    const cancelEditBreak = () => {
        setBreakForm({ name: '', startTime: '', endTime: '' });
        setEditingBreakId(null);
        setBreakMessage(null);
    };

    const removeBreak = (id: string) => {
        if (editingBreakId === id) {
            cancelEditBreak();
        }
        const currentBreaks = formData.breaks || [];
        const updatedBreaks = currentBreaks.filter(b => b.id !== id);
        handleChange('breaks', updatedBreaks);
    };

    const handleSave = async () => {
        const start = timeToMinutes(formData.collegeStartTime);
        const end = timeToMinutes(formData.collegeEndTime);
        
        if (start >= end) {
            setMainMessage({ type: 'error', text: "College end time must be after start time." });
            return;
        }

        await updateSettings(formData);
        setIsDirty(false);
        setMainMessage({ type: 'success', text: "Settings saved successfully! The schedule grid has been updated." });
        
        // Clear success message after 3s
        setTimeout(() => setMainMessage(null), 3000);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">System Configuration</h2>
                    <p className="text-slate-400">Define the temporal structure of your academic day.</p>
                </div>
                <button 
                    onClick={handleSave}
                    disabled={!isDirty}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-primary hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all shadow-lg shadow-primary/20 active:scale-95 sm:active:scale-100"
                >
                    <Save size={18} />
                    Save Changes
                </button>
            </div>

            {mainMessage && (
                <div className={clsx(
                    "p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2",
                    mainMessage.type === 'error' ? "bg-red-500/10 border-red-500/50 text-red-200" : "bg-emerald-500/10 border-emerald-500/50 text-emerald-200"
                )}>
                    {mainMessage.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                    {mainMessage.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* General Settings */}
                <div className="bg-glass border border-glassBorder rounded-2xl p-6 backdrop-blur-md">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Clock size={20} className="text-accent" />
                        Time & Duration
                    </h3>
                    
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">College Start Time</label>
                                <input 
                                    type="time" 
                                    value={formData.collegeStartTime}
                                    onChange={(e) => handleChange('collegeStartTime', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-primary focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">College End Time</label>
                                <input 
                                    type="time" 
                                    value={formData.collegeEndTime}
                                    onChange={(e) => handleChange('collegeEndTime', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-primary focus:border-primary"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Class Period Duration (Minutes)</label>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="range" 
                                    min="30" 
                                    max="120" 
                                    step="1" 
                                    value={formData.periodDuration}
                                    onChange={(e) => handleChange('periodDuration', parseInt(e.target.value))}
                                    className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                                <span className="bg-slate-800 border border-slate-700 text-white px-3 py-1.5 rounded-md font-mono w-16 text-center">
                                    {formData.periodDuration}m
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Working Days */}
                <div className="bg-glass border border-glassBorder rounded-2xl p-6 backdrop-blur-md">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Calendar size={20} className="text-accent" />
                        Working Days
                    </h3>
                    
                    <div className="flex flex-wrap gap-3">
                        {DAYS.map(day => {
                            const isActive = (formData.workingDays || []).includes(day);
                            return (
                                <button
                                    key={day}
                                    onClick={() => toggleDay(day)}
                                    className={clsx(
                                        "w-11 h-11 sm:w-12 sm:h-12 rounded-xl font-bold transition-all duration-200 flex items-center justify-center border",
                                        isActive 
                                            ? "bg-primary text-white border-primary shadow-[0_0_10px_rgba(99,102,241,0.4)] scale-105" 
                                            : "bg-slate-800/50 text-slate-500 border-slate-700 hover:bg-slate-800 hover:text-slate-300"
                                    )}
                                >
                                    {day.substring(0, 1)}
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-5 text-xs text-slate-500">
                        Selected days will appear in the main scheduler grid.
                    </p>
                </div>
            </div>

            {/* Break Management */}
            <div className="bg-glass border border-glassBorder rounded-2xl p-6 backdrop-blur-md">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Coffee size={20} className="text-amber-400" />
                    Breaks & Recess
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-3 order-2 lg:order-1">
                        {(!formData.breaks || formData.breaks.length === 0) && (
                            <div className="text-center p-8 bg-slate-800/30 rounded-xl border border-dashed border-slate-700 text-slate-500">
                                No breaks defined. Classes will run continuously.
                            </div>
                        )}
                        {(formData.breaks || []).map((b) => (
                            <div 
                                key={b.id} 
                                className={clsx(
                                    "flex items-center justify-between p-3 border rounded-lg group transition-all",
                                    editingBreakId === b.id 
                                        ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(99,102,241,0.2)]" 
                                        : "bg-slate-800/50 border-slate-700 hover:border-slate-500"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={clsx(
                                        "p-2 rounded-md",
                                        editingBreakId === b.id ? "bg-primary text-white" : "bg-amber-500/10 text-amber-500"
                                    )}>
                                        <Coffee size={18} />
                                    </div>
                                    <div>
                                        <p className={clsx("font-medium", editingBreakId === b.id ? "text-primary" : "text-white")}>
                                            {b.name}
                                        </p>
                                        <p className="text-xs text-slate-400 font-mono">{b.startTime} - {b.endTime}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => startEditingBreak(b)}
                                        className={clsx(
                                            "p-2 rounded-lg transition-colors",
                                            editingBreakId === b.id 
                                                ? "text-primary bg-primary/20" 
                                                : "text-slate-500 hover:text-white hover:bg-slate-700"
                                        )}
                                        title="Edit Break"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button 
                                        onClick={() => removeBreak(b.id)}
                                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                        title="Delete Break"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 h-fit order-1 lg:order-2">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold text-white">
                                {editingBreakId ? "Edit Break" : "Add New Break"}
                            </h4>
                            {editingBreakId && (
                                <button onClick={cancelEditBreak} className="text-slate-500 hover:text-white">
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        
                        {breakMessage && (
                            <div className={clsx(
                                "mb-3 p-2 rounded-lg text-xs flex items-center gap-2",
                                breakMessage.type === 'error' ? "bg-red-500/20 text-red-200" : "bg-emerald-500/20 text-emerald-200"
                            )}>
                                {breakMessage.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
                                {breakMessage.text}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <input 
                                    type="text" 
                                    placeholder="Break Name (e.g. Lunch)"
                                    value={breakForm.name}
                                    onChange={(e) => setBreakForm({...breakForm, name: e.target.value})}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-sm text-white focus:ring-primary focus:border-primary placeholder-slate-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input 
                                    type="time" 
                                    value={breakForm.startTime}
                                    onChange={(e) => setBreakForm({...breakForm, startTime: e.target.value})}
                                    className="bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-sm text-white focus:ring-primary focus:border-primary"
                                />
                                <input 
                                    type="time" 
                                    value={breakForm.endTime}
                                    onChange={(e) => setBreakForm({...breakForm, endTime: e.target.value})}
                                    className="bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-sm text-white focus:ring-primary focus:border-primary"
                                />
                            </div>
                            <button 
                                onClick={handleBreakSubmit}
                                className={clsx(
                                    "w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                                    editingBreakId 
                                        ? "bg-primary hover:bg-indigo-500 text-white" 
                                        : "bg-slate-700 hover:bg-slate-600 text-white"
                                )}
                            >
                                {editingBreakId ? <Save size={16} /> : <Plus size={16} />}
                                {editingBreakId ? "Update Break" : "Add Break"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;

import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { ScheduleEntry } from '../types';
import { Plus, X, Lock, Unlock, AlertTriangle, Sparkles, Loader2, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { chatWithScheduler, generateScheduleWithGemini } from '../services/geminiService';

const Scheduler = () => {
    const { 
        schedule, faculty, rooms, batches, subjects, conflicts, 
        addScheduleEntry, deleteScheduleEntry, resetData, saveGeneratedSchedule,
        settings, generatedSlots 
    } = useStore();
    
    const [selectedBatchId, setSelectedBatchId] = useState<string>(batches[0]?.id || '');
    const [draggedItem, setDraggedItem] = useState<{subjectId: string, type: 'NEW'} | null>(null);
    const [aiChatOpen, setAiChatOpen] = useState(false);
    const [aiMessage, setAiMessage] = useState("");
    const [aiResponse, setAiResponse] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Filter schedule for the view
    const currentSchedule = schedule.filter(s => s.batchId === selectedBatchId);

    const getCellContent = (day: string, slotIndex: number) => {
        // Slot is 1-indexed in database, so we pass index + 1
        return currentSchedule.find(s => s.day === day && s.slot === (slotIndex + 1));
    };

    const handleCellClick = (day: string, slotIndex: number) => {
        // If no resources are defined, do not attempt to add random data as it will crash
        if (subjects.length === 0 || faculty.length === 0 || rooms.length === 0) {
            alert("Please add Subjects, Faculty, and Rooms in the Resources tab before scheduling.");
            return;
        }

        const slot = slotIndex + 1;
        const existing = getCellContent(day, slotIndex);
        
        if (existing) {
            deleteScheduleEntry(existing.id);
        } else {
            // Pick random subject/faculty/room for demo
            const subject = subjects[Math.floor(Math.random() * subjects.length)];
            const fac = faculty[Math.floor(Math.random() * faculty.length)];
            const room = rooms[Math.floor(Math.random() * rooms.length)];
            
            if (!selectedBatchId) {
                alert("Please create and select a Batch first.");
                return;
            }

            addScheduleEntry({
                id: '', // Generated in store
                day,
                slot,
                subjectId: subject.id,
                facultyIds: [fac.id],
                roomId: room.id,
                batchId: selectedBatchId,
                isLocked: false
            });
        }
    };

    const handleAiChat = async () => {
        if (!aiMessage.trim()) return;
        setAiLoading(true);
        const response = await chatWithScheduler(aiMessage, { schedule, conflicts });
        setAiResponse(response);
        setAiLoading(false);
    }

    const handleGenerate = async () => {
        if (batches.length === 0 || subjects.length === 0 || faculty.length === 0 || rooms.length === 0) {
            alert("Cannot generate schedule: Missing resources. Please add Batches, Subjects, Faculty, and Rooms first.");
            return;
        }

        setIsGenerating(true);

        try {
            console.log("Requesting schedule from Gemini...");
            
            // Call Gemini Service
            const newEntries = await generateScheduleWithGemini(
                batches, 
                subjects, 
                faculty, 
                rooms, 
                settings, 
                generatedSlots
            );

            console.log("Gemini returned", newEntries.length, "entries.");
            await saveGeneratedSchedule(newEntries);
            
        } catch (error) {
            console.error("Generation failed:", error);
            alert("An error occurred during AI schedule generation. Please check the API key and try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const safeWorkingDays = settings.workingDays || [];

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-white">Master Schedule</h2>
                    <select 
                        value={selectedBatchId}
                        onChange={(e) => setSelectedBatchId(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 min-w-[200px]"
                    >
                         {batches.length === 0 && <option value="">No Batches Found</option>}
                        {batches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                        {isGenerating ? "Gemini Auto-Schedule" : "Gemini Auto-Schedule"}
                    </button>

                    <button 
                        onClick={resetData}
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                        title="Clear entire timetable database"
                    >
                        <Trash2 size={16} />
                        Clear Timetable
                    </button>
                    <button 
                        onClick={() => setAiChatOpen(!aiChatOpen)}
                        className="bg-primary hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                        Ask AI Assistant
                    </button>
                </div>
            </div>

            {/* AI Command Bar Overlay */}
            {aiChatOpen && (
                <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-4 mb-4 backdrop-blur-md animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Aether Copilot</h3>
                        <button onClick={() => setAiChatOpen(false)}><X size={16} className="text-slate-400" /></button>
                    </div>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                            placeholder="e.g., 'Move all Math classes to morning slots' or 'Why is Dr. Smith double booked?'"
                            value={aiMessage}
                            onChange={(e) => setAiMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAiChat()}
                        />
                        <button 
                            onClick={handleAiChat}
                            disabled={aiLoading}
                            className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50"
                        >
                            {aiLoading ? 'Thinking...' : 'Send'}
                        </button>
                    </div>
                    {aiResponse && (
                        <div className="mt-3 p-3 bg-slate-800 rounded-lg text-sm text-slate-300 border-l-4 border-primary">
                            {aiResponse}
                        </div>
                    )}
                </div>
            )}

            {/* Timetable Grid */}
            <div className="overflow-x-auto rounded-xl border border-glassBorder bg-glass backdrop-blur-sm shadow-xl">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="p-4 border-b border-r border-glassBorder bg-slate-900/50 text-left min-w-[100px] text-slate-400 font-medium sticky left-0 z-20 backdrop-blur-md">
                                Day / Time
                            </th>
                            {generatedSlots.map((slotTime, index) => (
                                <th key={index} className="p-4 border-b border-glassBorder bg-slate-900/50 text-center min-w-[140px]">
                                    <div className="text-white font-bold">Slot {index + 1}</div>
                                    <div className="text-xs text-slate-500 font-mono mt-1">{slotTime}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {safeWorkingDays.map(day => (
                            <tr key={day} className="group hover:bg-white/5 transition-colors">
                                <td className="p-4 border-r border-b border-glassBorder bg-slate-900/30 font-bold text-white sticky left-0 z-10 backdrop-blur-md">
                                    {day}
                                </td>
                                {generatedSlots.map((_, index) => {
                                    const slot = index + 1; // 1-based for DB
                                    const entry = getCellContent(day, index);
                                    
                                    // Find specific conflict to display details
                                    const conflict = conflicts.find(c => c.involvedIds.includes(entry?.id || ''));
                                    const hasConflict = !!conflict;
                                    
                                    // Helper to display faculty names
                                    const getFacultyNames = () => {
                                        if (!entry) return '';
                                        // Handle both new facultyIds array and legacy facultyId string
                                        const ids = entry.facultyIds || ((entry as any).facultyId ? [(entry as any).facultyId] : []);
                                        return ids.map(id => {
                                            const f = faculty.find(fac => fac.id === id);
                                            return f ? f.name.split(' ').pop() : 'Unknown';
                                        }).join(', ');
                                    };

                                    return (
                                        <td 
                                            key={`${day}-${slot}`} 
                                            onClick={() => handleCellClick(day, index)}
                                            className={clsx(
                                                "p-2 border-b border-glassBorder relative h-32 cursor-pointer transition-all hover:bg-white/5 group/cell",
                                                hasConflict ? "bg-red-500/10" : ""
                                            )}
                                        >
                                            {/* Conflict Tooltip */}
                                            {hasConflict && (
                                                <div className="absolute z-50 bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-max max-w-[220px] p-3 bg-slate-900/95 border border-red-500/50 rounded-lg shadow-xl opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none backdrop-blur-sm">
                                                    <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs mb-1">
                                                        <AlertTriangle size={14} />
                                                        <span>Conflict Detected</span>
                                                    </div>
                                                    <p className="text-xs text-slate-300 leading-snug">
                                                        {conflict.description}
                                                    </p>
                                                    {/* Arrow */}
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-6 border-transparent border-t-slate-900/95"></div>
                                                </div>
                                            )}

                                            {entry ? (
                                                <div className={clsx(
                                                    "h-full w-full rounded-lg p-2 flex flex-col justify-between text-xs border shadow-sm transition-transform hover:scale-[1.02]",
                                                    hasConflict 
                                                        ? "bg-red-500/20 border-red-500/50 text-red-100" 
                                                        : entry.isLocked 
                                                            ? "bg-slate-700/50 border-slate-600 text-slate-300"
                                                            : "bg-primary/20 border-primary/30 text-indigo-100"
                                                )}>
                                                    <div className="flex justify-between items-start">
                                                        <span className="font-bold truncate" title={subjects.find(s => s.id === entry.subjectId)?.name}>
                                                            {subjects.find(s => s.id === entry.subjectId)?.code || 'Unknown'}
                                                        </span>
                                                        <div className="flex gap-1">
                                                            {hasConflict && <AlertTriangle size={12} className="text-red-400" />}
                                                            {entry.isLocked && <Lock size={12} className="text-slate-400" />}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1 mt-1">
                                                        <div className="flex items-center gap-1 opacity-80" title={getFacultyNames()}>
                                                            <span className="truncate">{getFacultyNames()}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-60 text-[10px] uppercase">
                                                            {rooms.find(r => r.id === entry.roomId)?.name || 'Unknown'}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                    <Plus size={20} className="text-slate-500" />
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="flex gap-4 text-sm text-slate-500 px-2">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-primary/20 border border-primary/30"></div>
                    <span>Scheduled Class</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/50"></div>
                    <span>Conflict Detected (Hover for details)</span>
                </div>
                 <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-slate-700/50 border border-slate-600"></div>
                    <span>Locked (Manual)</span>
                </div>
            </div>
        </div>
    );
};

export default Scheduler;

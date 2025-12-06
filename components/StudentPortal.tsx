import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { generateTimeline } from '../core/TimeUtils';
import { Search, Users, ArrowLeft, Calendar, Clock, MapPin, User, GraduationCap, Coffee } from 'lucide-react';
import { clsx } from 'clsx';
import { Batch } from '../types';

const StudentPortal = () => {
    const { batches, schedule, subjects, faculty, rooms, settings } = useStore();
    const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Pagination State
    const [visibleCount, setVisibleCount] = useState(15);
    const observerTarget = useRef<HTMLDivElement>(null);

    // Derived State
    const selectedBatch = useMemo(() => 
        batches.find(b => b.id === selectedBatchId), 
    [batches, selectedBatchId]);

    const filteredBatches = useMemo(() => 
        batches
            .filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name)),
    [batches, searchTerm]);

    // Reset pagination when search changes
    useEffect(() => {
        setVisibleCount(15);
    }, [searchTerm]);

    const visibleBatches = useMemo(() => 
        filteredBatches.slice(0, visibleCount),
    [filteredBatches, visibleCount]);

    // Infinite Scroll Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting) {
                    setVisibleCount(prev => prev + 15);
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => {
            if (observerTarget.current) {
                observer.unobserve(observerTarget.current);
            }
        };
    }, [visibleBatches.length, filteredBatches.length]);

    const currentSchedule = useMemo(() => 
        schedule.filter(s => s.batchId === selectedBatchId),
    [schedule, selectedBatchId]);

    const timeline = useMemo(() => generateTimeline(settings), [settings]);
    const safeWorkingDays = settings.workingDays || [];

    // Helper to get cell content
    const getCellContent = (day: string, slotIndex: number) => {
        return currentSchedule.find(s => s.day === day && s.slot === slotIndex);
    };

    // --- VIEW: BATCH LIST ---
    if (!selectedBatchId) {
        return (
            <div className="space-y-8 animate-in fade-in duration-300">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-white tracking-tight">Student Portal</h2>
                        <p className="text-slate-400 mt-1">Select a batch to view its academic schedule.</p>
                    </div>
                    
                    {/* Search Bar */}
                    <div className="relative w-full md:w-72">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input 
                            type="text" 
                            placeholder="Search batches..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-slate-600 transition-all"
                        />
                    </div>
                </div>

                {/* Batch Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {visibleBatches.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800">
                            <Users size={48} className="mx-auto mb-3 opacity-20" />
                            <p>No batches found matching "{searchTerm}"</p>
                        </div>
                    ) : (
                        visibleBatches.map(batch => (
                            <button
                                key={batch.id}
                                onClick={() => setSelectedBatchId(batch.id)}
                                className="group relative overflow-hidden bg-glass border border-glassBorder hover:border-primary/50 rounded-2xl p-6 text-left transition-all duration-200 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <GraduationCap size={64} />
                                </div>
                                
                                <div className="relative z-10">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                        <Users className="text-primary" size={24} />
                                    </div>
                                    
                                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-primary transition-colors">{batch.name}</h3>
                                    
                                    <div className="flex items-center gap-4 text-xs text-slate-400 mt-3">
                                        <div className="flex items-center gap-1.5">
                                            <User size={14} />
                                            <span>{batch.size} Students</span>
                                        </div>
                                        {batch.fixedRoomId && (
                                            <div className="flex items-center gap-1.5">
                                                <MapPin size={14} />
                                                <span>{rooms.find(r => r.id === batch.fixedRoomId)?.name}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Loading Sentinel */}
                {visibleBatches.length < filteredBatches.length && (
                    <div ref={observerTarget} className="w-full flex justify-center py-6 opacity-50">
                        <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- VIEW: TIMETABLE ---
    return (
        <div className="flex flex-col h-full space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setSelectedBatchId(null)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            {selectedBatch?.name}
                            <span className="text-sm font-normal text-slate-500 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">Read Only</span>
                        </h2>
                        <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                            <span className="flex items-center gap-1.5">
                                <Users size={14} /> {selectedBatch?.size} Students
                            </span>
                            {selectedBatch?.fixedRoomId && (
                                <span className="flex items-center gap-1.5">
                                    <MapPin size={14} /> 
                                    Home Room: <span className="text-slate-300">{rooms.find(r => r.id === selectedBatch?.fixedRoomId)?.name}</span>
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Timetable Grid */}
            <div className="flex-1 rounded-2xl border border-glassBorder bg-slate-900/50 backdrop-blur-sm shadow-2xl overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1 custom-scrollbar">
                    <table className="w-full border-collapse min-w-[1000px]">
                        <thead>
                            <tr>
                                <th className="p-4 border-b border-r border-glassBorder bg-slate-950/80 text-left min-w-[120px] text-slate-400 font-medium sticky left-0 z-20 backdrop-blur-md">
                                    <div className="flex items-center gap-2">
                                        <Clock size={16} />
                                        <span>Day / Time</span>
                                    </div>
                                </th>
                                {timeline.map((item, index) => (
                                    <th 
                                        key={index} 
                                        className={clsx(
                                            "p-4 border-b border-glassBorder bg-slate-950/80 text-center min-w-[160px]",
                                            item.type === 'BREAK' && "bg-slate-900/50"
                                        )}
                                    >
                                        <div className={clsx("font-bold text-sm", item.type === 'BREAK' ? "text-amber-500" : "text-white")}>
                                            {item.name}
                                        </div>
                                        <div className="text-xs text-slate-500 font-mono mt-1">{item.timeString}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {safeWorkingDays.map(day => (
                                <tr key={day} className="group hover:bg-white/[0.02] transition-colors">
                                    <td className="p-4 border-r border-b border-glassBorder bg-slate-950/40 font-bold text-white sticky left-0 z-10 backdrop-blur-md">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm">
                                                {day.substring(0, 3)}
                                            </div>
                                            <span className="hidden md:inline">{day}</span>
                                        </div>
                                    </td>
                                    {timeline.map((item, index) => {
                                        if (item.type === 'BREAK') {
                                            return (
                                                <td key={`break-${index}`} className="p-2 border-b border-glassBorder bg-slate-950/30 relative">
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-20">
                                                        <Coffee size={20} className="text-amber-500 mb-1" />
                                                        <span className="text-[10px] text-amber-500 font-medium uppercase tracking-widest rotate-90 md:rotate-0">Break</span>
                                                    </div>
                                                </td>
                                            );
                                        }

                                        const slot = item.slotIndex!;
                                        const entry = getCellContent(day, slot);
                                        
                                        // Helper to get resource details
                                        const subject = entry ? subjects.find(s => s.id === entry.subjectId) : null;
                                        const assignedRoom = entry ? rooms.find(r => r.id === entry.roomId) : null;
                                        const assignedFaculty = entry ? (entry.facultyIds || []).map(fid => faculty.find(f => f.id === fid)?.name).filter(Boolean).join(', ') : '';

                                        return (
                                            <td key={`${day}-${slot}`} className="p-2 border-b border-glassBorder h-32 align-top">
                                                {entry ? (
                                                    <div className={clsx(
                                                        "h-full w-full rounded-xl p-3 flex flex-col justify-between border shadow-sm",
                                                        subject?.requiredRoomType === 'LAB' 
                                                            ? "bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20" 
                                                            : "bg-primary/10 border-primary/30 hover:bg-primary/20",
                                                        "transition-colors"
                                                    )}>
                                                        <div>
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className={clsx(
                                                                    "text-xs font-bold px-1.5 py-0.5 rounded",
                                                                    subject?.requiredRoomType === 'LAB' ? "bg-purple-500/20 text-purple-300" : "bg-primary/20 text-indigo-300"
                                                                )}>
                                                                    {subject?.code}
                                                                </span>
                                                                {subject?.requiredRoomType === 'LAB' && <span className="text-[10px] font-bold text-purple-400 uppercase">LAB</span>}
                                                            </div>
                                                            <div className="font-medium text-white text-sm leading-tight line-clamp-2" title={subject?.name}>
                                                                {subject?.name}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="space-y-1 mt-2">
                                                            <div className="flex items-center gap-1.5 text-xs text-slate-300" title={assignedFaculty}>
                                                                <User size={12} className="text-slate-500" />
                                                                <span className="truncate">{assignedFaculty || 'TBA'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                                <MapPin size={12} className="text-slate-500" />
                                                                <span className="uppercase tracking-wide">{assignedRoom?.name || 'TBA'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="h-full w-full rounded-xl border border-dashed border-slate-800 bg-slate-900/20 flex items-center justify-center">
                                                        <span className="text-xs text-slate-600 font-medium">Free</span>
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
            </div>
        </div>
    );
};

export default StudentPortal;
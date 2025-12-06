import React, { useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Users, Box, Building, Calendar, Activity, TrendingUp, BarChart3, AlertTriangle, Layers, BookOpen, Clock } from 'lucide-react';
import { clsx } from 'clsx';

const COLORS = ['#6366f1', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
const TYPE_COLORS = { LECTURE: '#3b82f6', LAB: '#a855f7' };

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/90 border border-slate-700 p-3 rounded-xl shadow-xl backdrop-blur-md z-50">
                <p className="text-slate-300 text-xs font-medium mb-1">{label}</p>
                <p className="text-white font-bold text-sm">
                    {payload[0].value} <span className="text-slate-500 font-normal text-xs ml-1">{payload[0].name === 'value' ? 'Count' : payload[0].name}</span>
                </p>
            </div>
        );
    }
    return null;
};

const StatCard = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
    <div className="bg-glass border border-glassBorder p-5 rounded-2xl backdrop-blur-md flex items-start justify-between group hover:bg-glassHover transition-all">
        <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
            {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
        </div>
        <div className={clsx("p-3 rounded-xl", colorClass)}>
            <Icon size={20} className="text-white" />
        </div>
    </div>
);

const Analytics = () => {
    const { schedule, faculty, rooms, departments, batches, subjects, settings, generatedSlots, conflicts } = useStore();

    // --- 1. Faculty Workload Data ---
    const facultyLoadData = useMemo(() => {
        return faculty.map(f => {
            const load = schedule.filter(s => (s.facultyIds || []).includes(f.id)).length;
            return {
                name: f.name,
                hours: load,
                department: f.department
            };
        }).sort((a, b) => b.hours - a.hours).slice(0, 10);
    }, [faculty, schedule]);

    // --- 2. Batch Workload Data (NEW) ---
    const batchLoadData = useMemo(() => {
        return batches.map(b => {
            const load = schedule.filter(s => s.batchId === b.id).length;
            return {
                name: b.name,
                classes: load
            };
        }).sort((a, b) => b.classes - a.classes).slice(0, 10);
    }, [batches, schedule]);

    // --- 3. Subject Type Distribution (NEW) ---
    const subjectTypeData = useMemo(() => {
        let lectureCount = 0;
        let labCount = 0;
        
        schedule.forEach(s => {
            const sub = subjects.find(sub => sub.id === s.subjectId);
            if (sub) {
                if (sub.requiredRoomType === 'LAB') labCount++;
                else lectureCount++;
            }
        });

        return [
            { name: 'Lecture', value: lectureCount },
            { name: 'Laboratory', value: labCount }
        ].filter(d => d.value > 0);
    }, [schedule, subjects]);

    // --- 4. Department Distribution ---
    const departmentData = useMemo(() => {
        const counts: Record<string, number> = {};
        schedule.forEach(s => {
            if (s.facultyIds && s.facultyIds.length > 0) {
                const fac = faculty.find(f => f.id === s.facultyIds[0]);
                const dept = fac?.department || 'Unassigned';
                counts[dept] = (counts[dept] || 0) + 1;
            }
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [schedule, faculty]);

    // --- 5. Room Utilization ---
    const roomData = useMemo(() => {
        return rooms.map(r => {
            const usage = schedule.filter(s => s.roomId === r.id).length;
            return {
                name: r.name,
                usage: usage,
                capacity: r.capacity
            };
        }).sort((a, b) => b.usage - a.usage).slice(0, 10);
    }, [rooms, schedule]);

    // --- 6. Daily Distribution ---
    const dailyData = useMemo(() => {
        const days = settings.workingDays || [];
        return days.map(day => ({
            name: day,
            classes: schedule.filter(s => s.day === day).length
        }));
    }, [schedule, settings.workingDays]);

    // --- 7. Congestion Heatmap (NEW) ---
    const congestionData = useMemo(() => {
        const days = settings.workingDays || [];
        // Map slot indices to actual time strings if available, else just "Slot X"
        const slots = generatedSlots.length > 0 ? generatedSlots : Array.from({length: 8}, (_, i) => `Slot ${i+1}`);
        
        let maxDensity = 0;
        const grid = days.map(day => {
            const daySlots = slots.map((timeLabel, index) => {
                // Schedule uses 1-based indexing for slots
                const slotIndex = index + 1; 
                const count = schedule.filter(s => s.day === day && s.slot === slotIndex).length;
                if (count > maxDensity) maxDensity = count;
                return { 
                    slotIndex, 
                    timeLabel, 
                    count 
                };
            });
            return { day, daySlots };
        });
        
        return { grid, maxDensity: maxDensity || 1 };
    }, [schedule, settings, generatedSlots]);

    // Stats Calculation
    const totalWeeklyHours = schedule.length;
    const avgFacultyLoad = faculty.length ? Math.round(totalWeeklyHours / faculty.length) : 0;
    const busiestDay = dailyData.reduce((prev, current) => (prev.classes > current.classes) ? prev : current, { name: 'N/A', classes: 0 });
    const mostUtilizedRoom = roomData.length > 0 ? roomData[0] : { name: 'N/A', usage: 0 };
    const conflictCount = conflicts.length;

    if (schedule.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
                <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center">
                    <BarChart3 size={40} className="text-slate-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-300">No Analytics Available</h2>
                <p className="text-slate-500 max-w-md">
                    Start by generating or creating a schedule in the Scheduler tab to see detailed analytics and insights here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Academic Analytics</h2>
                <p className="text-slate-400 mt-1">Deep dive into resource utilization, workload distribution, and operational efficiency.</p>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="Total Weekly Hours" 
                    value={totalWeeklyHours} 
                    subtext="Across all batches"
                    icon={Activity} 
                    colorClass="bg-primary/20"
                />
                <StatCard 
                    title="Avg. Faculty Load" 
                    value={`${avgFacultyLoad} hrs`} 
                    subtext="Per week per faculty"
                    icon={Users} 
                    colorClass="bg-emerald-500/20"
                />
                <StatCard 
                    title="Busiest Day" 
                    value={busiestDay.name} 
                    subtext={`${busiestDay.classes} classes scheduled`}
                    icon={Calendar} 
                    colorClass="bg-amber-500/20"
                />
                {conflictCount > 0 ? (
                    <StatCard 
                        title="Active Conflicts" 
                        value={conflictCount} 
                        subtext="Requires attention"
                        icon={AlertTriangle} 
                        colorClass="bg-red-500/20 text-red-500"
                    />
                ) : (
                    <StatCard 
                        title="Top Room" 
                        value={mostUtilizedRoom.name} 
                        subtext={`${mostUtilizedRoom.usage} hours occupied`}
                        icon={Box} 
                        colorClass="bg-purple-500/20"
                    />
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. Faculty Workload Chart */}
                <div className="bg-glass border border-glassBorder p-6 rounded-2xl backdrop-blur-md flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Users size={20} className="text-primary" />
                            Faculty Workload
                        </h3>
                        <span className="text-xs text-slate-500 bg-slate-900/50 px-2 py-1 rounded-md">Top 10 Busiest</span>
                    </div>
                    <div className="h-64 w-full flex-1 min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={facultyLoadData} layout="vertical" margin={{ left: 0, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                                <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={100} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                                <Bar dataKey="hours" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Batch Workload Chart (NEW) */}
                <div className="bg-glass border border-glassBorder p-6 rounded-2xl backdrop-blur-md flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Layers size={20} className="text-cyan-400" />
                            Batch Activity
                        </h3>
                        <span className="text-xs text-slate-500 bg-slate-900/50 px-2 py-1 rounded-md">Classes / Week</span>
                    </div>
                    <div className="h-64 w-full flex-1 min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={batchLoadData} layout="vertical" margin={{ left: 0, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                                <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={80} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                                <Bar dataKey="classes" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Composition Row: Subject Types & Departments */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Subject Type Distribution (Donut) */}
                    <div className="bg-glass border border-glassBorder p-6 rounded-2xl backdrop-blur-md flex flex-col">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <BookOpen size={20} className="text-pink-400" />
                            Curriculum Composition
                        </h3>
                        <div className="h-64 w-full flex-1 flex items-center justify-center relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={subjectTypeData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {subjectTypeData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={entry.name === 'Laboratory' ? TYPE_COLORS.LAB : TYPE_COLORS.LECTURE} 
                                                stroke="rgba(0,0,0,0.2)" 
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend 
                                        verticalAlign="bottom" 
                                        height={36} 
                                        iconType="circle"
                                        formatter={(value) => <span className="text-slate-400 text-xs ml-1">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Inner Label */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                                <span className="text-3xl font-bold text-white">{totalWeeklyHours}</span>
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Classes</span>
                            </div>
                        </div>
                    </div>

                    {/* Department Distribution (Pie) */}
                    <div className="bg-glass border border-glassBorder p-6 rounded-2xl backdrop-blur-md flex flex-col">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <Building size={20} className="text-emerald-400" />
                            Departmental Share
                        </h3>
                        <div className="h-64 w-full flex-1 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={departmentData}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {departmentData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend 
                                        verticalAlign="bottom" 
                                        height={36} 
                                        iconType="circle"
                                        formatter={(value) => <span className="text-slate-400 text-xs ml-1">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* 4. Campus Congestion Heatmap (NEW) */}
                <div className="lg:col-span-2 bg-glass border border-glassBorder p-6 rounded-2xl backdrop-blur-md">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Activity size={20} className="text-orange-400" />
                            Campus Congestion Heatmap
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                             <span className="block w-3 h-3 bg-primary/20 rounded"></span>
                             <span>Low</span>
                             <span className="block w-3 h-3 bg-primary rounded ml-2"></span>
                             <span>High Activity</span>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto pb-2">
                        <div className="min-w-[800px]">
                            {/* Header Row */}
                            <div className="flex mb-2">
                                <div className="w-24 flex-shrink-0"></div>
                                {congestionData.grid[0]?.daySlots.map((s, i) => (
                                    <div key={i} className="flex-1 text-center text-xs text-slate-500 font-mono">
                                        {s.timeLabel.split('-')[0]} 
                                    </div>
                                ))}
                            </div>
                            
                            {/* Grid Rows */}
                            <div className="space-y-2">
                                {congestionData.grid.map((row) => (
                                    <div key={row.day} className="flex gap-2">
                                        <div className="w-24 flex-shrink-0 flex items-center text-sm font-bold text-slate-400">
                                            {row.day}
                                        </div>
                                        {row.daySlots.map((slot, i) => {
                                            const intensity = congestionData.maxDensity > 0 ? slot.count / congestionData.maxDensity : 0;
                                            return (
                                                <div 
                                                    key={i} 
                                                    className="flex-1 h-12 rounded-md transition-all hover:ring-2 hover:ring-white/20 relative group"
                                                    style={{ 
                                                        backgroundColor: `rgba(99, 102, 241, ${Math.max(0.1, intensity)})`, // Primary color with opacity
                                                        border: '1px solid rgba(255,255,255,0.05)'
                                                    }}
                                                >
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="text-xs font-bold text-white drop-shadow-md">{slot.count}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 text-center">Visualizes the number of simultaneous classes occurring in each time slot across the entire institution.</p>
                </div>

                {/* 5. Room Utilization */}
                <div className="bg-glass border border-glassBorder p-6 rounded-2xl backdrop-blur-md flex flex-col lg:col-span-2">
                     <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Box size={20} className="text-purple-400" />
                            Room Occupancy Leaderboard
                        </h3>
                    </div>
                    <div className="h-64 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={roomData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                                <Bar dataKey="usage" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 6. Conflict Monitor (Conditional) */}
                {conflictCount > 0 && (
                    <div className="lg:col-span-2 bg-red-500/5 border border-red-500/20 p-6 rounded-2xl backdrop-blur-md animate-in slide-in-from-bottom-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Conflict Monitor</h3>
                                <p className="text-red-300 text-sm">Critical scheduling overlaps detected</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div className="bg-slate-900/50 p-4 rounded-xl border border-red-500/10">
                                 <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Room Double Bookings</div>
                                 <div className="text-2xl font-bold text-white">
                                     {conflicts.filter(c => c.type === 'ROOM').length}
                                 </div>
                             </div>
                             <div className="bg-slate-900/50 p-4 rounded-xl border border-red-500/10">
                                 <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Faculty Overlaps</div>
                                 <div className="text-2xl font-bold text-white">
                                     {conflicts.filter(c => c.type === 'FACULTY').length}
                                 </div>
                             </div>
                             <div className="bg-slate-900/50 p-4 rounded-xl border border-red-500/10">
                                 <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Capacity Issues</div>
                                 <div className="text-2xl font-bold text-white">
                                     {conflicts.filter(c => c.type === 'CAPACITY').length}
                                 </div>
                             </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Analytics;
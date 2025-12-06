import React, { useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
    PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { Users, Box, Building, Calendar, Activity, TrendingUp, BarChart3, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

const COLORS = ['#6366f1', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/90 border border-slate-700 p-3 rounded-xl shadow-xl backdrop-blur-md">
                <p className="text-slate-300 text-xs font-medium mb-1">{label}</p>
                <p className="text-white font-bold text-sm">
                    {payload[0].value} <span className="text-slate-500 font-normal text-xs ml-1">{payload[0].name === 'value' ? 'Hours' : payload[0].name}</span>
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
    const { schedule, faculty, rooms, departments, batches, settings } = useStore();

    // --- 1. Faculty Workload Data ---
    const facultyLoadData = useMemo(() => {
        return faculty.map(f => {
            const load = schedule.filter(s => (s.facultyIds || []).includes(f.id)).length;
            return {
                name: f.name,
                hours: load,
                department: f.department
            };
        }).sort((a, b) => b.hours - a.hours); // Sort by busiest
    }, [faculty, schedule]);

    // --- 2. Department Distribution ---
    const departmentData = useMemo(() => {
        const counts: Record<string, number> = {};
        schedule.forEach(s => {
            // Find subject department or faculty department
            // For simplicity, we assume the department comes from the primary faculty assigned
            if (s.facultyIds && s.facultyIds.length > 0) {
                const fac = faculty.find(f => f.id === s.facultyIds[0]);
                const dept = fac?.department || 'Unassigned';
                counts[dept] = (counts[dept] || 0) + 1;
            }
        });

        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [schedule, faculty]);

    // --- 3. Room Utilization ---
    const roomData = useMemo(() => {
        return rooms.map(r => {
            const usage = schedule.filter(s => s.roomId === r.id).length;
            return {
                name: r.name,
                usage: usage,
                capacity: r.capacity
            };
        }).sort((a, b) => b.usage - a.usage);
    }, [rooms, schedule]);

    // --- 4. Daily Distribution ---
    const dailyData = useMemo(() => {
        const days = settings.workingDays || [];
        return days.map(day => ({
            name: day,
            classes: schedule.filter(s => s.day === day).length
        }));
    }, [schedule, settings.workingDays]);

    // Stats Calculation
    const totalWeeklyHours = schedule.length;
    const avgFacultyLoad = faculty.length ? Math.round(totalWeeklyHours / faculty.length) : 0;
    const busiestDay = dailyData.reduce((prev, current) => (prev.classes > current.classes) ? prev : current, { name: 'N/A', classes: 0 });
    const mostUtilizedRoom = roomData.length > 0 ? roomData[0] : { name: 'N/A', usage: 0 };

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
                <StatCard 
                    title="Top Room" 
                    value={mostUtilizedRoom.name} 
                    subtext={`${mostUtilizedRoom.usage} hours occupied`}
                    icon={Box} 
                    colorClass="bg-purple-500/20"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Faculty Workload Chart */}
                <div className="bg-glass border border-glassBorder p-6 rounded-2xl backdrop-blur-md flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Users size={20} className="text-primary" />
                            Faculty Workload
                        </h3>
                        <span className="text-xs text-slate-500 bg-slate-900/50 px-2 py-1 rounded-md">Hours / Week</span>
                    </div>
                    <div className="h-80 w-full flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={facultyLoadData.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                                <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={100} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                                <Bar dataKey="hours" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-slate-500 mt-4 text-center">Top 10 busiest faculty members shown</p>
                </div>

                {/* Department Distribution */}
                <div className="bg-glass border border-glassBorder p-6 rounded-2xl backdrop-blur-md flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Building size={20} className="text-emerald-400" />
                        Departmental Share
                    </h3>
                    <div className="h-80 w-full flex-1 min-h-[300px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={departmentData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={110}
                                    paddingAngle={5}
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

                {/* Daily Load Distribution */}
                <div className="bg-glass border border-glassBorder p-6 rounded-2xl backdrop-blur-md flex flex-col lg:col-span-2">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-amber-400" />
                        Weekly Schedule Density
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorClasses" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="classes" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorClasses)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Room Utilization */}
                <div className="bg-glass border border-glassBorder p-6 rounded-2xl backdrop-blur-md flex flex-col lg:col-span-2">
                     <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Box size={20} className="text-cyan-400" />
                            Room Occupancy
                        </h3>
                    </div>
                    <div className="h-64 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={roomData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                                <Bar dataKey="usage" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={50} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Analytics;
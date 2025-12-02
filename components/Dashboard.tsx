import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { AlertTriangle, CheckCircle, Users, Box, TrendingUp, Sparkles, RefreshCcw } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { analyzeScheduleWithGemini, AIAnalysisResult } from '../services/geminiService';
import { clsx } from 'clsx';

const KPICard = ({ title, value, icon: Icon, trend, colorClass }: any) => (
    <div className="relative overflow-hidden rounded-2xl border border-glassBorder bg-glass p-6 backdrop-blur-md transition-all hover:bg-glassHover group">
        <div className={clsx("absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 blur-xl transition-all group-hover:scale-150", colorClass)}></div>
        <div className="flex items-start justify-between">
            <div>
                <p className="text-sm font-medium text-slate-400">{title}</p>
                <h3 className="mt-2 text-3xl font-bold text-white">{value}</h3>
            </div>
            <div className={clsx("rounded-lg p-3 bg-white/5", colorClass.replace('bg-', 'text-'))}>
                <Icon size={24} />
            </div>
        </div>
        {trend && (
            <div className="mt-4 flex items-center gap-1 text-xs text-slate-400">
                <TrendingUp size={12} className="text-green-400" />
                <span className="text-green-400">{trend}</span> vs last semester
            </div>
        )}
    </div>
);

const Dashboard = () => {
    const { schedule, conflicts, faculty, rooms, batches, subjects } = useStore();
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const runDiagnostics = async () => {
        setIsAnalyzing(true);
        const result = await analyzeScheduleWithGemini(schedule, faculty, rooms, batches, subjects);
        setAiAnalysis(result);
        setIsAnalyzing(false);
    };

    // Calculate basic stats
    const totalClasses = schedule.length;
    const conflictCount = conflicts.length;
    // Fix division by zero if rooms is empty
    const totalCapacity = rooms.length * 8 * 5;
    const utilizationRate = totalCapacity > 0 ? Math.round((schedule.length / totalCapacity) * 100) : 0;

    const pieData = [
        { name: 'Active', value: totalClasses, color: '#6366f1' },
        { name: 'Free', value: Math.max(0, (rooms.length * 8 * 5) - totalClasses), color: '#334155' },
    ];

    const workloadData = faculty.map(f => ({
        name: f.name.split(' ').pop(), // Last name
        hours: schedule.filter(s => (s.facultyIds || []).includes(f.id)).length
    }));

    return (
        <div className="space-y-8 relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white">Operations Dashboard</h2>
                    <p className="text-sm md:text-base text-slate-400">Real-time overview of academic resources and scheduling health.</p>
                </div>
                <button 
                    onClick={runDiagnostics}
                    disabled={isAnalyzing}
                    className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-indigo-600 rounded-lg text-white font-medium hover:opacity-90 transition-all disabled:opacity-50"
                >
                    {isAnalyzing ? <RefreshCcw className="animate-spin" size={18} /> : <Sparkles size={18} />}
                    {isAnalyzing ? "Running Diagnostics..." : "Run AI Pre-flight Check"}
                </button>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <KPICard 
                    title="Total Classes" 
                    value={totalClasses} 
                    icon={Box} 
                    trend={totalClasses > 0 ? "+12%" : ""}
                    colorClass="bg-blue-500" 
                />
                <KPICard 
                    title="Resource Utilization" 
                    value={`${utilizationRate}%`} 
                    icon={TrendingUp} 
                    trend={utilizationRate > 0 ? "+5%" : ""}
                    colorClass="bg-green-500" 
                />
                <KPICard 
                    title="Active Conflicts" 
                    value={conflictCount} 
                    icon={AlertTriangle} 
                    trend={conflictCount > 0 ? "- Critical" : "All Clear"}
                    colorClass={conflictCount > 0 ? "bg-red-500" : "bg-emerald-500"} 
                />
                <KPICard 
                    title="Faculty Load" 
                    value={faculty.length} 
                    icon={Users} 
                    colorClass="bg-purple-500" 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* AI Diagnostics Panel */}
                <div className="lg:col-span-2 rounded-2xl border border-glassBorder bg-glass p-6 backdrop-blur-md">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Sparkles size={20} className="text-amber-400" />
                        AI Diagnostics & Health
                    </h3>
                    
                    {aiAnalysis ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                             <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                                <div className="relative h-16 w-16 flex items-center justify-center rounded-full border-4 border-slate-700 flex-shrink-0">
                                    <span className={clsx("text-xl font-bold", aiAnalysis.score > 80 ? "text-green-400" : "text-amber-400")}>
                                        {aiAnalysis.score}
                                    </span>
                                    <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
                                        <path
                                            className={clsx("fill-none stroke-current stroke-[3]", aiAnalysis.score > 80 ? "text-green-500" : "text-amber-500")}
                                            strokeDasharray={`${aiAnalysis.score}, 100`}
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                    </svg>
                                </div>
                                <div className="text-center sm:text-left">
                                    <h4 className="font-semibold text-white">System Health Score</h4>
                                    <p className="text-sm text-slate-400">Based on conflicts, gaps, and workload distribution.</p>
                                </div>
                            </div>
                            
                            <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                <p className="text-slate-200 text-sm leading-relaxed">{aiAnalysis.analysis}</p>
                            </div>

                            <div>
                                <h4 className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">Optimization Suggestions</h4>
                                <ul className="space-y-2">
                                    {aiAnalysis.suggestions.map((s, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                            <CheckCircle size={16} className="text-primary mt-0.5 flex-shrink-0" />
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 md:h-64 text-slate-500 text-center">
                            <Sparkles size={48} className="mb-4 opacity-20" />
                            <p>Run diagnostics to generate an AI Health Report.</p>
                        </div>
                    )}
                </div>

                {/* Utilization Chart */}
                <div className="rounded-2xl border border-glassBorder bg-glass p-6 backdrop-blur-md flex flex-col">
                     <h3 className="text-xl font-bold text-white mb-6">Room Utilization</h3>
                     <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                     </div>
                     <div className="mt-4 flex justify-center gap-4 text-sm">
                         <div className="flex items-center gap-2">
                             <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                             <span className="text-slate-300">Occupied</span>
                         </div>
                         <div className="flex items-center gap-2">
                             <span className="w-3 h-3 rounded-full bg-slate-700"></span>
                             <span className="text-slate-300">Free</span>
                         </div>
                     </div>
                </div>
            </div>

             {/* Faculty Workload Chart */}
             <div className="rounded-2xl border border-glassBorder bg-glass p-6 backdrop-blur-md">
                <h3 className="text-xl font-bold text-white mb-6">Faculty Workload Distribution</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={workloadData}>
                            <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                            <RechartsTooltip 
                                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                            />
                            <Bar dataKey="hours" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
             </div>
        </div>
    );
};

export default Dashboard;
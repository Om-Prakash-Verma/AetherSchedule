import React, { useState, useEffect, useMemo } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { useAppContext } from '../hooks/useAppContext';
import { useToast } from '../hooks/useToast';
import * as api from '../services';
import type { AnalyticsReport, GeneratedTimetable } from '../types';
import { GlassSelect } from '../components/ui/GlassSelect';
import { Loader2, BarChart4, Thermometer, UserCheck, Wind } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

const AnalyticsDashboard: React.FC<{ report: AnalyticsReport }> = ({ report }) => {
    const { timeSlots, workingDays, workingDaysIndices } = useAppContext();
    const { data: rooms = [] } = useQuery({ queryKey: ['rooms'], queryFn: api.getRooms });
    
    const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || '');
    const maxWorkload = Math.max(...report.facultyWorkload.map(f => f.totalHours), 0);
    const maxUtilization = Math.max(...report.roomUtilization.map(r => r.utilizationPercent), 0);

    const heatmap = report.heatmapData[selectedRoomId] || [];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <GlassPanel className="p-6 lg:col-span-1">
                     <div className="flex items-center gap-3 mb-4">
                        <UserCheck className="w-6 h-6 text-accent"/>
                        <h3 className="text-xl font-bold text-white">Faculty Workload</h3>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {report.facultyWorkload.map(fw => (
                            <div key={fw.facultyId} className="text-sm">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium text-white truncate pr-2">{fw.facultyName}</span>
                                    <span className="text-text-muted font-mono">{fw.totalHours} hrs</span>
                                </div>
                                <div className="w-full bg-panel-strong rounded-full h-2">
                                    <div className="bg-accent h-2 rounded-full" style={{ width: `${(fw.totalHours / maxWorkload) * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassPanel>
                <GlassPanel className="p-6 lg:col-span-2">
                     <div className="flex items-center gap-3 mb-4">
                        <Thermometer className="w-6 h-6 text-accent"/>
                        <h3 className="text-xl font-bold text-white">Room Utilization</h3>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                        {report.roomUtilization.map(ru => (
                             <div key={ru.roomId} className="text-sm">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium text-white truncate pr-2">{ru.roomName}</span>
                                    <span className="text-text-muted font-mono">{ru.utilizationPercent}%</span>
                                </div>
                                <div className="w-full bg-panel-strong rounded-full h-2">
                                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(ru.utilizationPercent / maxUtilization) * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassPanel>
            </div>
             <GlassPanel className="p-6">
                 <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <Wind className="w-6 h-6 text-accent"/>
                        <h3 className="text-xl font-bold text-white">Room Availability Heatmap</h3>
                    </div>
                    <div className="w-full sm:w-60">
                        <GlassSelect 
                            value={selectedRoomId}
                            onChange={(val) => setSelectedRoomId(String(val))}
                            options={rooms.map(r => ({ value: r.id, label: r.name }))}
                        />
                    </div>
                </div>
                 <div className="overflow-x-auto">
                    <div className="grid grid-cols-[auto_repeat(6,minmax(60px,1fr))] gap-1 min-w-[600px]" style={{ gridTemplateColumns: `auto repeat(${workingDays.length}, minmax(60px, 1fr))` }}>
                         <div/>
                         {workingDays.map(day => <div key={day} className="text-center font-semibold text-white p-1 text-xs">{day.substring(0,3)}</div>)}
                         {timeSlots.map((slot, slotIndex) => (
                             <React.Fragment key={slotIndex}>
                                <div className="text-right text-text-muted p-1 text-xs font-mono">{slot.split(' ')[0]}</div>
                                {workingDaysIndices.map((dayIndex) => {
                                    const isUsed = heatmap[dayIndex]?.[slotIndex] === 1;
                                    return (
                                        <div key={dayIndex} title={`${isUsed ? 'Booked' : 'Free'}`} className={`h-8 rounded ${isUsed ? 'bg-accent/80' : 'bg-panel-strong'}`}/>
                                    )
                                })}
                             </React.Fragment>
                         ))}
                    </div>
                </div>
            </GlassPanel>
        </div>
    );
}

const Analytics: React.FC = () => {
    const { data: generatedTimetables = [] } = useQuery({ queryKey: ['timetables'], queryFn: api.getTimetables });
    const [selectedTimetableId, setSelectedTimetableId] = useState<string | null>(null);
    const [report, setReport] = useState<AnalyticsReport | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const toast = useToast();

    useEffect(() => {
        if (selectedTimetableId) {
            const fetchReport = async () => {
                setIsLoading(true);
                try {
                    const existingTimetable = generatedTimetables.find(t => t.id === selectedTimetableId);
                    if (existingTimetable?.analytics) {
                        setReport(existingTimetable.analytics);
                    } else {
                        const newReport = await api.getAnalyticsReport(selectedTimetableId);
                        setReport(newReport);
                    }
                } catch (e: any) {
                    toast.error(e.message || "Failed to load analytics report.");
                    setReport(null);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchReport();
        } else {
            setReport(null);
        }
    }, [selectedTimetableId, generatedTimetables, toast]);

    const timetableOptions = useMemo(() => {
        return generatedTimetables
            .filter(tt => tt.status === 'Approved' || tt.status === 'Archived')
            .map(tt => ({
                value: tt.id,
                label: `V${tt.version} - ${tt.batchIds.join(', ')} (${tt.status})`
            }));
    }, [generatedTimetables]);
    
    return (
        <div className="space-y-6">
            <GlassPanel className="p-6">
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Timetable Analytics</h2>
                        <p className="text-text-muted">Analyze the performance and efficiency of approved timetables.</p>
                    </div>
                    <div className="w-full sm:w-80">
                         <GlassSelect 
                            value={selectedTimetableId || ''}
                            onChange={(val) => setSelectedTimetableId(String(val))}
                            options={timetableOptions}
                            placeholder="Select an approved timetable..."
                        />
                    </div>
                </div>
            </GlassPanel>
            
            {isLoading ? (
                <div className="flex justify-center items-center py-20 text-text-muted">
                    <Loader2 className="animate-spin mr-3"/> Generating detailed analytics...
                </div>
            ) : report ? (
                <AnalyticsDashboard report={report} />
            ) : (
                <GlassPanel className="p-6 text-center h-96 flex flex-col items-center justify-center">
                    <BarChart4 size={48} className="text-text-muted mb-4"/>
                    <h3 className="text-xl font-bold text-white">No Timetable Selected</h3>
                    <p className="text-text-muted mt-2">Select an approved or archived timetable to view its analytics.</p>
                </GlassPanel>
            )}
        </div>
    );
};

export default Analytics;
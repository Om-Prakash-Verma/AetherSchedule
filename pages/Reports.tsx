import React from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { Download, FileText, BarChart2 } from 'lucide-react';
import { GlassButton } from '../components/GlassButton';
import { useToast } from '../hooks/useToast';

const reports = [
    { name: 'Room Utilization Report', icon: BarChart2, description: 'Detailed hourly and daily usage stats for all rooms and labs.'},
    { name: 'Faculty Load Analysis', icon: BarChart2, description: 'Comparison of assigned vs. maximum workload for all faculty members.'},
    { name: 'Constraint Violation Log', icon: FileText, description: 'A log of all hard and soft constraint violations across generated timetables.'},
    { name: 'Master Timetable (PDF)', icon: FileText, description: 'A printable PDF of the approved master timetable for all departments.'},
]

const Reports: React.FC = () => {
    const toast = useToast();
    const handleDownload = () => {
        toast.info('This feature is not yet implemented.');
    }

  return (
    <div className="space-y-6">
      <GlassPanel className="p-6">
        <h2 className="text-2xl font-bold text-white mb-6">Available Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reports.map(report => (
                <GlassPanel key={report.name} className="p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-2 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg">
                                <report.icon className="w-6 h-6 text-[var(--accent)]" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">{report.name}</h3>
                        </div>
                        <p className="text-text-muted text-sm mb-4">{report.description}</p>
                    </div>
                    <GlassButton icon={Download} variant="secondary" onClick={handleDownload}>Download Report</GlassButton>
                </GlassPanel>
            ))}
        </div>
      </GlassPanel>
    </div>
  );
};

export default Reports;
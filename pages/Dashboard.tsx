import React, { useEffect } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { useAppContext } from '../hooks/useAppContext';
import { Users, Book, Building, School } from 'lucide-react';

const Dashboard: React.FC = () => {
    const { 
        user, subjects, faculty, rooms, batches,
        fetchSubjects, fetchFaculty, fetchRooms, fetchBatches
    } = useAppContext();

    useEffect(() => {
        // Fetch all data needed for the stat cards
        fetchSubjects();
        fetchFaculty();
        fetchRooms();
        fetchBatches();
    }, [fetchSubjects, fetchFaculty, fetchRooms, fetchBatches]);

    const stats = [
        { label: 'Total Subjects', value: subjects.length, icon: Book },
        { label: 'Total Faculty', value: faculty.length, icon: Users },
        { label: 'Total Rooms', value: rooms.length, icon: Building },
        { label: 'Total Batches', value: batches.length, icon: School },
    ];

    return (
        <div className="space-y-6">
            <GlassPanel className="p-6 md:p-8">
                <h2 className="text-3xl font-bold text-white">Welcome back, {user?.name}!</h2>
                <p className="text-text-muted mt-2">Here's a quick overview of the system.</p>
            </GlassPanel>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map(stat => (
                    <GlassPanel key={stat.label} className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-text-muted">{stat.label}</p>
                                <p className="text-4xl font-bold text-white">{stat.value}</p>
                            </div>
                            <div className="p-3 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg">
                                <stat.icon className="h-8 w-8 text-[var(--accent)]" />
                            </div>
                        </div>
                    </GlassPanel>
                ))}
            </div>

             <GlassPanel className="p-6">
                <h3 className="text-xl font-bold text-white mb-4">Recent Activity</h3>
                <div className="text-center py-10">
                    <p className="text-text-muted">No recent activity to display.</p>
                </div>
            </GlassPanel>
        </div>
    );
};

export default Dashboard;

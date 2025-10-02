// FIX: Removed invalid file header comment that was causing a syntax error.
import React from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { useAppContext } from '../hooks/useAppContext';
import { Users, Book, Building, School } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import * as api from '../services';

const Dashboard: React.FC = () => {
    const { user } = useAppContext();

    const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: api.getSubjects });
    const { data: faculty = [] } = useQuery({ queryKey: ['faculty'], queryFn: api.getFaculty });
    const { data: rooms = [] } = useQuery({ queryKey: ['rooms'], queryFn: api.getRooms });
    const { data: batches = [] } = useQuery({ queryKey: ['batches'], queryFn: api.getBatches });

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
                {stats.map((stat, index) => (
                    <GlassPanel 
                        key={stat.label} 
                        className="p-6 animate-fade-in-up transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_20px_hsl(var(--accent-hsl)_/_0.2)]"
                        style={{ animationDelay: `${index * 100}ms`}}
                    >
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

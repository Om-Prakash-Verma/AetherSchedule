import React from 'react';
import { GlassPanel } from '../GlassPanel';

export const InfoCard: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode; }> = ({ icon: Icon, title, children }) => (
    <GlassPanel className="p-6 h-full border border-transparent hover:border-accent/30 transition-colors">
        <div className="flex items-start gap-4">
            <div className="p-2 bg-accent/10 border border-accent/20 rounded-lg">
                <Icon className="w-6 h-6 text-accent" />
            </div>
            <div>
                <h3 className="font-bold text-white text-lg">{title}</h3>
                <p className="text-sm text-text-muted mt-1">{children}</p>
            </div>
        </div>
    </GlassPanel>
);

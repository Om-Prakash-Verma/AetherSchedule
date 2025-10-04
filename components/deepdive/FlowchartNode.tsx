import React from 'react';
import { GlassPanel } from '../GlassPanel';
import { cn } from '../../utils/cn';

export const FlowchartNode: React.FC<{ title: string; children: React.ReactNode; className?: string; animationDelay?: string }> = ({ title, children, className, animationDelay }) => (
    <div className={cn("animate-flow-in", className)} style={{ animationDelay }}>
        <GlassPanel className="p-4 h-full text-center">
            <h4 className="font-bold text-white text-sm">{title}</h4>
            <p className="text-xs text-text-muted mt-1">{children}</p>
        </GlassPanel>
    </div>
);

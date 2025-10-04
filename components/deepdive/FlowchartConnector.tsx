import React from 'react';
import { cn } from '../../utils/cn';
import { ArrowDown, ArrowRight } from 'lucide-react';

export const FlowchartConnector: React.FC<{ vertical?: boolean; horizontal?: boolean; className?: string; animationDelay?: string }> = ({ vertical, horizontal, className, animationDelay }) => (
    <div className={cn("flex items-center justify-center animate-draw-line", className)} style={{ animationDelay }}>
        {vertical && <ArrowDown className="w-6 h-6 text-accent/70" />}
        {horizontal && <ArrowRight className="w-6 h-6 text-accent/70" />}
    </div>
);

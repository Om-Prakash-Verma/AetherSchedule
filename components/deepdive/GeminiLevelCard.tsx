import React from 'react';

export const GeminiLevelCard: React.FC<{ icon: React.ElementType; level: number; title: string; children: React.ReactNode; isLast?: boolean }> = ({ icon: Icon, level, title, children, isLast }) => (
    <div className="relative pl-16">
        {!isLast && <div className="absolute left-8 top-16 bottom-0 w-0.5 bg-gradient-to-b from-yellow-400/50 via-yellow-400/20 to-transparent" />}
        <div className="absolute left-0 top-0 flex items-center justify-center w-16 h-16 bg-yellow-900/20 border-2 border-yellow-400/50 rounded-full">
            <Icon className="w-8 h-8 text-yellow-400" />
        </div>
        <div className="ml-4">
            <p className="text-yellow-400 font-bold">LEVEL {level}</p>
            <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
            <p className="text-text-muted">{children}</p>
        </div>
    </div>
);

import React, { useState } from 'react';
import { GlassPanel } from '../GlassPanel';
import { Dna, GitMerge, Repeat, ArrowRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import { TimetableGridVisual } from './TimetableGridVisual';

export const GeneticAlgorithmVisualizer: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'chromosome' | 'crossover' | 'mutation'>('chromosome');

    const chromosomeSlots = [1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0];
    const parent1Slots = [1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0];
    const parent2Slots = [0, 0, 2, 2, 0, 2, 0, 2, 0, 2, 2, 0, 0, 2, 2];
    const childSlots = [1, 1, 2, 2, 0, 2, 0, 2, 0, 2, 2, 0, 0, 2, 2];
    const mutationBeforeSlots = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 0];
    const mutationAfterSlots = [1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0];

    const tabs = [
        { id: 'chromosome', label: 'Chromosome', icon: Dna },
        { id: 'crossover', label: 'Crossover', icon: GitMerge },
        { id: 'mutation', label: 'Mutation', icon: Repeat },
    ];

    return (
        <GlassPanel className="p-6">
            <div className="flex justify-center border-b border-border mb-6">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors',
                            activeTab === tab.id
                                ? 'border-accent text-accent'
                                : 'border-transparent text-text-muted hover:text-white'
                        )}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="min-h-[12rem] flex items-center justify-center">
                {activeTab === 'chromosome' && (
                    <div className="text-center animate-fade-in-up">
                        <TimetableGridVisual slots={chromosomeSlots} />
                        <h4 className="font-bold text-white mt-4">A Single Timetable</h4>
                        <p className="text-sm text-text-muted">Each "chromosome" is one complete solution—a full set of class assignments.</p>
                    </div>
                )}
                {activeTab === 'crossover' && (
                    <div className="text-center animate-fade-in-up">
                        <div className="flex items-center justify-center gap-4">
                            <TimetableGridVisual slots={parent1Slots} />
                            <span className="text-2xl font-bold text-accent">+</span>
                            <TimetableGridVisual slots={parent2Slots} />
                            <span className="text-2xl font-bold text-accent">=</span>
                            <TimetableGridVisual slots={childSlots} />
                        </div>
                        <h4 className="font-bold text-white mt-4">Combining Parents</h4>
                        <p className="text-sm text-text-muted">Traits from two "parent" timetables are combined to create a new "child" solution.</p>
                    </div>
                )}
                {activeTab === 'mutation' && (
                    <div className="text-center animate-fade-in-up">
                         <div className="flex items-center justify-center gap-4">
                            <TimetableGridVisual slots={mutationBeforeSlots} highlight={[3, 13]} />
                            <ArrowRight className="text-accent"/>
                            <TimetableGridVisual slots={mutationAfterSlots} highlight={[12, 13]} />
                        </div>
                        <h4 className="font-bold text-white mt-4">Random Change</h4>
                        <p className="text-sm text-text-muted">A small, random swap is introduced to explore new possibilities and avoid getting stuck.</p>
                    </div>
                )}
            </div>
        </GlassPanel>
    );
}

import React from 'react';
import { GlassPanel } from '../GlassPanel';
import { RefreshCw, CornerDownRight } from 'lucide-react';
import { FlowchartNode } from './FlowchartNode';
import { FlowchartConnector } from './FlowchartConnector';

export const FullProcessFlowchart = () => {
    return (
        <GlassPanel className="max-w-4xl mx-auto p-6 md:p-8">
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] md:grid-cols-5 gap-4 items-stretch text-center">
                <FlowchartNode title="1. User Request & Strategy" animationDelay="0s" className="md:col-span-2">User clicks 'Generate'. Gemini analyzes the problem and devises a multi-phase GA strategy.</FlowchartNode>
                <FlowchartConnector horizontal animationDelay="100ms" className="hidden md:flex" />
                <div className="col-span-full md:hidden flex justify-center"><FlowchartConnector vertical animationDelay="100ms"/></div>
                <FlowchartNode title="2. Initialization" animationDelay="200ms" className="md:col-span-2">A large population of random (but valid) timetables is created, respecting all pinned assignments.</FlowchartNode>
                
                <div className="col-span-full flex justify-center"><FlowchartConnector vertical animationDelay="300ms"/></div>
                
                <div className="col-span-full p-4 border-2 border-dashed border-border rounded-lg relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-panel text-accent font-bold text-sm rounded-full flex items-center gap-2"><RefreshCw size={12}/> Evolutionary Loop</div>
                    <div className="grid md:grid-cols-3 gap-4 items-center mt-4">
                        <FlowchartNode title="3. Evolution" animationDelay="400ms">The engine performs Selection, Crossover, and Mutation based on Gemini's strategy.</FlowchartNode>
                        <FlowchartConnector horizontal animationDelay="500ms" className="hidden md:flex"/>
                        <div className="col-span-full md:hidden flex justify-center"><FlowchartConnector vertical animationDelay="500ms"/></div>
                        <FlowchartNode title="4. Stagnation Check" animationDelay="600ms">The engine checks if the top score has improved. If not, it signals for help.</FlowchartNode>
                        <div className="relative col-span-full md:col-span-1 flex justify-center items-center">
                             <div className="absolute right-full top-0 bottom-0 items-center hidden md:flex">
                                <CornerDownRight className="w-8 h-8 text-accent/70 -scale-x-100" />
                                <div className="h-px flex-1 bg-border/50 border-dashed"/>
                            </div>
                            <FlowchartNode title="5. AI Intervention (If Needed)" animationDelay="800ms">Gemini provides a creative, "out-of-the-box" swap to get the process unstuck.</FlowchartNode>
                        </div>
                    </div>
                </div>

                <div className="col-span-full flex justify-center"><FlowchartConnector vertical animationDelay="900ms"/></div>

                <FlowchartNode title="6. Final Selection" animationDelay="1000ms" className="md:col-start-2 md:col-span-3">The loop completes, and the top 5 distinct, high-scoring candidates are selected from the final population.</FlowchartNode>
                
                <div className="col-span-full flex justify-center"><FlowchartConnector vertical animationDelay="1100ms"/></div>
                
                <FlowchartNode title="7. Present to User" animationDelay="1200ms" className="md:col-start-2 md:col-span-3 bg-accent/20 border-accent/30">The top candidates are presented to the user for final review, comparison, and refinement.</FlowchartNode>
            </div>
        </GlassPanel>
    );
}

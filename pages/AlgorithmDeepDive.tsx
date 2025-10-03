import React, { useState } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import {
    Cpu, Dna, Bot, Lightbulb, CheckSquare, GitMerge, Shuffle, Repeat, Goal, Award, Sparkles, BrainCircuit, ArrowDown, ArrowRight, CornerDownRight, RefreshCw
} from 'lucide-react';
import { cn } from '../utils/cn';

const SectionHeader: React.FC<{ icon: React.ElementType; title: string; subtitle: string }> = ({ icon: Icon, title, subtitle }) => (
  <div className="text-center mb-16">
    <div className="inline-flex items-center justify-center p-4 bg-accent/10 border border-accent/20 rounded-2xl mb-4">
      <Icon className="h-10 w-10 text-accent" />
    </div>
    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{title}</h2>
    <p className="text-lg text-text-muted mt-3 max-w-3xl mx-auto">{subtitle}</p>
  </div>
);

const InfoCard: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode; }> = ({ icon: Icon, title, children }) => (
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

const TimetableGridVisual: React.FC<{ slots: (number | null)[]; highlight?: number | number[]; className?: string }> = ({ slots, highlight, className }) => (
    <div className={cn("grid grid-cols-5 gap-1 p-2 bg-panel rounded-md transition-all duration-300", className)}>
        {slots.map((slot, i) => {
            const isHighlighted = Array.isArray(highlight) ? highlight.includes(i) : highlight === i;
            return (
                <div key={i} className={cn(
                    'h-4 w-4 rounded-sm transition-all duration-300',
                    slot === 1 ? 'bg-accent/80' : slot === 2 ? 'bg-green-500/80' : 'bg-panel-strong',
                    isHighlighted && 'ring-2 ring-yellow-400 scale-125'
                )} />
            );
        })}
    </div>
);

const GeneticAlgorithmVisualizer: React.FC = () => {
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

const GeminiLevelCard: React.FC<{ icon: React.ElementType; level: number; title: string; children: React.ReactNode; isLast?: boolean }> = ({ icon: Icon, level, title, children, isLast }) => (
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

const FlowchartNode: React.FC<{ title: string; children: React.ReactNode; className?: string; animationDelay?: string }> = ({ title, children, className, animationDelay }) => (
    <div className={cn("animate-flow-in", className)} style={{ animationDelay }}>
        <GlassPanel className="p-4 h-full text-center">
            <h4 className="font-bold text-white text-sm">{title}</h4>
            <p className="text-xs text-text-muted mt-1">{children}</p>
        </GlassPanel>
    </div>
);

const FlowchartConnector: React.FC<{ vertical?: boolean; horizontal?: boolean; className?: string; animationDelay?: string }> = ({ vertical, horizontal, className, animationDelay }) => (
    <div className={cn("flex items-center justify-center animate-draw-line", className)} style={{ animationDelay }}>
        {vertical && <ArrowDown className="w-6 h-6 text-accent/70" />}
        {horizontal && <ArrowRight className="w-6 h-6 text-accent/70" />}
    </div>
);

const FullProcessFlowchart = () => {
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


const AlgorithmDeepDive: React.FC = () => {
  return (
    <div className="space-y-24">
      <section className="text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white">
          Under the Hood: The AetherSchedule AI Engine
        </h1>
        <p className="text-xl text-accent mt-2">A Symphony of Algorithms and Intelligence</p>
        <p className="max-w-4xl mx-auto mt-6 text-lg text-text-muted">
          University timetabling is a notoriously complex challenge—a class of problem computer scientists call "NP-hard." A brute-force approach is impossible. Our engine employs a sophisticated, multi-layered strategy, combining battle-tested algorithms with cutting-edge generative AI to find optimal solutions in minutes, not millennia.
        </p>
      </section>

      <section>
        <SectionHeader
          icon={Dna}
          title="The Foundation: A Genetic Algorithm"
          subtitle="Inspired by Darwin's theory of evolution, a Genetic Algorithm (GA) doesn't solve a problem head-on. Instead, it breeds and evolves populations of potential solutions until the 'fittest' one emerges."
        />
        <div className="max-w-3xl mx-auto">
            <GeneticAlgorithmVisualizer />
        </div>
      </section>

      <section>
        <SectionHeader
          icon={Lightbulb}
          title="The Refiner: Advanced Heuristics"
          subtitle="A standard Genetic Algorithm is powerful, but can sometimes get stuck in a 'good enough' solution. We use advanced techniques to polish the results and achieve true excellence."
        />
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <InfoCard icon={BrainCircuit} title="Hyper-Heuristics">
                Instead of a rigid strategy, our engine is a "hyper-heuristic." It intelligently chooses which evolutionary operator (Crossover, Mutation, etc.) is best to use at each stage of the process, adapting its approach on the fly.
            </InfoCard>
            <InfoCard icon={Sparkles} title="Simulated Annealing">
                Borrowed from metallurgy, this technique allows the algorithm to occasionally accept a *worse* solution to escape a local optimum, just like heating metal allows its molecules to rearrange into a stronger structure before cooling. It's perfect for fine-tuning near the end of the process.
            </InfoCard>
        </div>
      </section>

      <section>
        <SectionHeader
          icon={Bot}
          title="The Secret Sauce: Three Levels of Gemini"
          subtitle="This is what elevates our engine from merely smart to truly intelligent. We use Gemini not just to generate content, but as an active participant and strategist in the optimization process itself."
        />
        <div className="max-w-3xl mx-auto space-y-12">
            <GeminiLevelCard icon={Award} level={1} title="The Self-Tuning Judge">
                Gemini analyzes feedback from past timetables (e.g., faculty ratings) to dynamically adjust the fitness function. If faculty consistently dislike morning gaps, Gemini tells the algorithm to penalize that trait more heavily in the next run, making the system learn and adapt over time.
            </GeminiLevelCard>
            <GeminiLevelCard icon={BrainCircuit} level={2} title="The Master Strategist">
                Before the evolution even begins, Gemini creates a custom, multi-phase game plan. It decides the optimal balance of exploration (broad searching) and exploitation (deep refinement) for the specific problem, ensuring the most efficient path to a solution.
            </GeminiLevelCard>
            <GeminiLevelCard icon={Lightbulb} level={3} title="The Creative Interventionist" isLast>
                If the algorithm gets stuck for too long, it sends the problematic timetable to Gemini. Gemini analyzes the deadlock and suggests a creative, "out-of-the-box" structural change to get the evolutionary process moving again, breaking through barriers that pure algorithms might not.
            </GeminiLevelCard>
        </div>
      </section>
      
      <section>
        <SectionHeader
          icon={Cpu}
          title="The Full Process: A Step-by-Step Flow"
          subtitle="Here’s how these layers work in concert when a user clicks 'Generate'."
        />
        <FullProcessFlowchart />
      </section>
    </div>
  );
};

export default AlgorithmDeepDive;


import React from 'react';
import { 
    Cpu, ArrowRight, BrainCircuit, Palette, Atom, Zap, Database,
    Users, Clock, AlertTriangle, CheckCircle, BarChart4, Sliders, Lock
} from 'lucide-react';
import { GlassPanel } from '../components/GlassPanel';
import { GlassButton } from '../components/GlassButton';
import { PublicPageLayout } from '../components/PublicPageLayout';

// FIX: Add onGoToHome to props interface to satisfy PublicPageLayout
interface HomepageProps {
  onGoToApp: () => void;
  onShowHowItWorks: () => void;
  onShowAlgorithmDeepDive: () => void;
  onGoToHome: () => void;
}

const AnimatedTimetableGrid = () => {
    const slots = Array.from({ length: 4 * 5 });
    const occupiedSlots = [1, 3, 5, 8, 10, 11, 14, 17, 19];
    
    return (
        <GlassPanel className="p-4 md:p-6 w-full max-w-lg mx-auto relative overflow-hidden [transform:perspective(1000px)_rotateX(15deg)] group">
            <div className="absolute -inset-2 bg-grid-pattern opacity-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent z-10" />
            <div className="absolute inset-0 animate-hero-glow bg-[hsl(var(--accent-hsl)_/_0.2)] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="grid grid-cols-5 gap-2 relative z-20">
                {slots.map((_, i) => {
                    const isOccupied = occupiedSlots.includes(i);
                    const animationDelay = `${i * 40}ms`;
                    return (
                        <div key={i} className={`h-12 md:h-16 rounded-md animate-fade-in-up`} style={{ animationDelay }}>
                            {isOccupied && (
                                <div className={`w-full h-full rounded-md bg-[hsl(var(--accent-hsl)_/_0.2)] border border-[hsl(var(--accent-hsl)_/_0.3)] flex items-center justify-center`}>
                                   <div className="w-1/2 h-2 bg-[hsl(var(--accent-hsl)_/_0.5)] rounded-full" />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </GlassPanel>
    )
}

const ProblemSolutionCard: React.FC<{ icon: React.ElementType, title: string, items: string[], isProblem?: boolean }> = ({ icon: Icon, title, items, isProblem }) => (
    <GlassPanel className={`p-6 h-full border-2 ${isProblem ? 'border-[hsl(var(--red-hsl)_/_0.2)] bg-[hsl(var(--red-hsl)_/_0.1)]' : 'border-[hsl(var(--green-hsl)_/_0.2)] bg-[hsl(var(--green-hsl)_/_0.1)]'}`}>
        <div className="flex items-center gap-3 mb-4">
            <Icon className={`w-6 h-6 ${isProblem ? 'text-[var(--red-400)]' : 'text-[var(--green-400)]'}`} />
            <h3 className={`text-xl font-bold ${isProblem ? 'text-[var(--red-300)]' : 'text-[var(--green-300)]'}`}>{title}</h3>
        </div>
        <ul className="space-y-2 text-sm text-[var(--text-muted)]">
            {items.map((item, i) => <li key={i} className="flex items-start gap-2"><span className="opacity-50 mt-1">&bull;</span> {item}</li>)}
        </ul>
    </GlassPanel>
);

const CorePillarCard: React.FC<{ icon: React.ElementType, title: string, children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
    <GlassPanel className="p-8 text-center group transition-all duration-300 hover:border-accent/50 hover:-translate-y-2 hover:shadow-[0_0_40px_hsl(var(--accent-hsl)_/_0.2)]">
        <div className="inline-flex items-center justify-center p-4 bg-[hsl(var(--accent-hsl)_/_0.1)] border border-[hsl(var(--accent-hsl)_/_0.2)] rounded-2xl mb-4 transition-all duration-300 group-hover:scale-110 group-hover:bg-[hsl(var(--accent-hsl)_/_0.2)]">
          <Icon className="h-10 w-10 text-[var(--accent)]" />
        </div>
        <h3 className="text-xl font-bold text-[var(--text-white)]">{title}</h3>
        <p className="text-[var(--text-muted)] mt-2 text-sm">{children}</p>
    </GlassPanel>
);

const TechCard: React.FC<{ icon: React.ElementType, title: string, children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
    <GlassPanel className="p-6 h-full">
        <div className="flex items-center gap-4 mb-3">
             <div className="p-2 bg-[var(--panel)] border border-[var(--border)] rounded-lg">
                <Icon className="h-6 w-6 text-[var(--accent)]" />
            </div>
            <h3 className="text-xl font-bold text-[var(--text-white)]">{title}</h3>
        </div>
        <p className="text-sm text-[var(--text-muted)]">{children}</p>
    </GlassPanel>
);

const Homepage: React.FC<HomepageProps> = (props) => {
  return (
    <PublicPageLayout {...props} currentPage="Home">
        <section className="grid md:grid-cols-2 gap-12 items-center">
          <div className="text-center md:text-left animate-fade-in-right">
            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-extrabold text-[var(--text-white)]">
              Intelligent Timetabling, <span className="text-[var(--accent)]">Simplified</span>.
            </h2>
            <p className="max-w-xl mx-auto md:mx-0 mt-6 text-base sm:text-lg text-[var(--text-muted)]">
              Leverage our self-tuning AI engine to generate optimized, conflict-free timetables in minutes, not weeks. Designed for the dynamic needs of higher education.
            </p>
            <div className="mt-10">
              <GlassButton onClick={props.onGoToApp} className="px-8 py-4 text-lg group">
                Launch Scheduler
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
              </GlassButton>
            </div>
          </div>
          <div className="relative animate-fade-in-left">
            <div className="absolute -inset-1/4 bg-accent blur-[120px] opacity-15 rounded-full -z-10" />
            <AnimatedTimetableGrid />
          </div>
        </section>

        <section className="mt-24 sm:mt-32">
             <div className="text-center">
                <h3 className="text-sm font-bold uppercase text-[var(--accent)] tracking-widest">The Challenge</h3>
                <p className="text-2xl sm:text-3xl font-bold text-[var(--text-white)] mt-2">Manual scheduling is a broken puzzle.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 max-w-5xl mx-auto">
                <ProblemSolutionCard 
                    icon={AlertTriangle} 
                    title="The Chaos" 
                    items={[
                        "Countless hours wasted on manual trial-and-error.",
                        "Inevitable clashes and last-minute changes.",
                        "Unbalanced workloads leading to faculty burnout.",
                        "Inefficient room usage and student gaps."
                    ]} 
                    isProblem 
                />
                 <ProblemSolutionCard 
                    icon={CheckCircle} 
                    title="The Clarity" 
                    items={[
                        "Generate multiple, conflict-free options in minutes.",
                        "AI-powered optimization for guaranteed accuracy.",
                        "Fair, balanced schedules that boost satisfaction.",
                        "Maximized resource efficiency across campus."
                    ]} 
                />
            </div>
        </section>

         <section className="mt-24 sm:mt-32">
            <div className="text-center">
                <h3 className="text-sm font-bold uppercase text-[var(--accent)] tracking-widest">Our Solution</h3>
                <p className="text-2xl sm:text-3xl font-bold text-[var(--text-white)] mt-2">A Complete Scheduling Ecosystem</p>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
                <CorePillarCard icon={Cpu} title="AI Optimization Engine">
                    Our hyper-heuristic genetic algorithm, guided by Google Gemini, evolves millions of possibilities to find the optimal schedule.
                </CorePillarCard>
                <CorePillarCard icon={Users} title="Collaborative Workflow">
                    From version control and commenting to a formal approval process, we provide the tools for seamless team collaboration.
                </CorePillarCard>
                 <CorePillarCard icon={Database} title="Unified Data Hub">
                    A single source of truth for all your institutional data—subjects, faculty, rooms, and batches—managed through one intuitive interface.
                </CorePillarCard>
             </div>
        </section>

        <section className="mt-24 sm:mt-32">
            <GlassPanel className="p-8 md:p-12">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                    <div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-white)]">How it Works in 3 Simple Steps</h3>
                        <p className="text-[var(--text-muted)] mt-4 mb-8">We turn complexity into a straightforward, three-stage process that combines your data with our AI's power.</p>
                        <div className="space-y-6">
                            <div className="flex items-start gap-4"><div className="p-2 bg-[hsl(var(--accent-hsl)_/_0.1)] border border-[hsl(var(--accent-hsl)_/_0.2)] rounded-lg mt-1"><Lock className="w-6 h-6 text-[var(--accent)]"/></div><div><h4 className="font-bold text-[var(--text-white)]">1. Define Your World</h4><p className="text-sm text-[var(--text-muted)]">Input your subjects, faculty, rooms, and constraints. This creates the digital blueprint of your institution.</p></div></div>
                            <div className="flex items-start gap-4"><div className="p-2 bg-[hsl(var(--accent-hsl)_/_0.1)] border border-[hsl(var(--accent-hsl)_/_0.2)] rounded-lg mt-1"><Sliders className="w-6 h-6 text-[var(--accent)]"/></div><div><h4 className="font-bold text-[var(--text-white)]">2. Generate with AI</h4><p className="text-sm text-[var(--text-muted)]">Select your batches, click 'Generate', and let the AI engine produce multiple, optimized timetable candidates.</p></div></div>
                            <div className="flex items-start gap-4"><div className="p-2 bg-[hsl(var(--accent-hsl)_/_0.1)] border border-[hsl(var(--accent-hsl)_/_0.2)] rounded-lg mt-1"><BarChart4 className="w-6 h-6 text-[var(--accent)]"/></div><div><h4 className="font-bold text-[var(--text-white)]">3. Refine & Publish</h4><p className="text-sm text-[var(--text-muted)]">Compare candidates, make manual tweaks with our drag-and-drop editor, and publish the final schedule.</p></div></div>
                        </div>
                        <GlassButton onClick={props.onShowHowItWorks} variant="secondary" className="mt-8 group">
                            Explore the Full Process <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"/>
                        </GlassButton>
                    </div>
                    <div className="hidden md:block">
                        <img src="https://storage.googleapis.com/aistudio-hosting/generations/b683ea1c-0112-4f3a-9694-3983a0f124c8/dark_flowchart.png" alt="A dark-themed flowchart showing the three steps of the scheduling process: Define, Generate, and Refine" className="rounded-lg object-cover" />
                    </div>
                </div>
            </GlassPanel>
        </section>
        
        <section className="mt-24 sm:mt-32">
            <div className="text-center">
                <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-white)]">Built on a Foundation of Excellence</h3>
                 <p className="max-w-2xl mx-auto mt-4 text-[var(--text-muted)]">
                    We chose a modern, performant, and scalable tech stack to ensure AetherSchedule is reliable, fast, and future-proof.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
                <TechCard icon={Atom} title="React & TypeScript">
                    The world's leading UI library paired with static typing, for a highly interactive, fast, and maintainable user interface.
                </TechCard>
                 <TechCard icon={Zap} title="Hono">
                    An ultrafast web framework for both the server-side API and routing, key to the application's snappy, responsive feel.
                </TechCard>
                 <TechCard icon={Database} title="Neon & Drizzle ORM">
                    A modern, serverless Postgres database paired with a next-generation TypeScript ORM for a robust, type-safe foundation.
                </TechCard>
                <TechCard icon={BrainCircuit} title="Google Gemini API">
                    The core of our intelligence layer, used as a master strategist and creative problem-solver that guides the optimization process.
                </TechCard>
                 <TechCard icon={Palette} title="Tailwind CSS">
                    A utility-first CSS framework that enables rapid development of our sophisticated and consistent glassmorphism design system.
                </TechCard>
                 <TechCard icon={Zap} title="Vercel Edge">
                    Best-in-class cloud platform for deploying our globally-replicated API and frontend for maximum performance.
                </TechCard>
            </div>
        </section>
    </PublicPageLayout>
  );
};

export default Homepage;

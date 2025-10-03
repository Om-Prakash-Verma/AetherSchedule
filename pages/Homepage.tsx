import React from 'react';
import { 
    Cpu, ArrowRight, BrainCircuit, Palette, Atom, Zap, Database,
    Search, CheckCircle, BarChart4, Sliders, Lock, Replace, Bot
} from 'lucide-react';
import { GlassPanel } from '../components/GlassPanel';
import { GlassButton } from '../components/GlassButton';
import { PublicPageLayout } from '../components/PublicPageLayout';

interface HomepageProps {
  onGoToApp: () => void;
  onShowHowItWorks: () => void;
  onShowAlgorithmDeepDive: () => void;
  onGoToHome: () => void;
}

const HeroVisual = () => {
    const slots = Array.from({ length: 4 * 5 });
    const occupiedSlots = [1, 3, 5, 8, 10, 11, 14, 17, 19];
    
    return (
        <div className="relative [transform:perspective(1200px)_rotateX(15deg)_rotateZ(-5deg)] group">
            <GlassPanel className="p-4 md:p-6 w-full max-w-lg mx-auto relative overflow-hidden">
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
                 <div className="absolute bottom-4 left-4 right-4 z-30">
                    <GlassPanel className="p-2 flex items-center gap-2 border-accent/20 bg-panel-strong/80 backdrop-blur-sm">
                        <Bot size={16} className="text-accent shrink-0" />
                        <p className="text-xs sm:text-sm text-text-muted font-mono overflow-hidden">
                            <span className="typewriter-text">Move all labs to the afternoon...</span>
                        </p>
                    </GlassPanel>
                </div>
            </GlassPanel>
        </div>
    )
}

const FeatureCard: React.FC<{ icon: React.ElementType, title: string, children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
    <GlassPanel className="p-6 text-left group transition-all duration-300 hover:border-accent/50 hover:-translate-y-2 hover:shadow-[0_0_40px_hsl(var(--accent-hsl)_/_0.2)]">
        <div className="flex items-center gap-4 mb-3">
             <div className="p-3 bg-[hsl(var(--accent-hsl)_/_0.1)] border border-[hsl(var(--accent-hsl)_/_0.2)] rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:bg-[hsl(var(--accent-hsl)_/_0.2)]">
                <Icon className="h-6 w-6 text-[var(--accent)]" />
            </div>
            <h3 className="text-lg font-bold text-[var(--text-white)]">{title}</h3>
        </div>
        <p className="text-sm text-[var(--text-muted)]">{children}</p>
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

const WorkflowChart: React.FC = () => {
    const steps = [
        { icon: Lock, title: "1. Define Your World", description: "Input subjects, faculty, rooms, and constraints to create a digital blueprint of your institution." },
        { icon: Sliders, title: "2. Generate with AI", description: "Select batches and let the AI engine produce multiple, optimized timetable candidates." },
        { icon: CheckCircle, title: "3. Refine & Publish", description: "Compare candidates, make manual tweaks, and publish the final schedule with one click." }
    ];

    return (
        <div className="flex flex-col md:flex-row items-stretch justify-center gap-4 md:gap-0">
            {steps.map((step, index) => (
                <React.Fragment key={index}>
                    <div className="flex md:flex-col items-center gap-4 animate-flow-in" style={{ animationDelay: `${index * 200}ms` }}>
                        <div className="p-3 bg-[hsl(var(--accent-hsl)_/_0.1)] border border-[hsl(var(--accent-hsl)_/_0.2)] rounded-lg">
                            <step.icon className="w-6 h-6 text-[var(--accent)]" />
                        </div>
                        <div className="text-left md:text-center">
                            <h4 className="font-bold text-[var(--text-white)]">{step.title}</h4>
                            <p className="text-sm text-[var(--text-muted)] hidden md:block">{step.description}</p>
                        </div>
                    </div>
                    {index < steps.length - 1 && (
                        <div className="h-8 w-px md:h-auto md:w-16 bg-border/50 mx-auto md:mx-0 md:my-auto animate-draw-line" style={{ animationDelay: `${150 + index * 200}ms` }}/>
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};


const Homepage: React.FC<HomepageProps> = (props) => {
  return (
    <PublicPageLayout {...props} currentPage="Home">
        <section className="grid md:grid-cols-2 gap-12 items-center min-h-[70vh]">
          <div className="text-center md:text-left animate-fade-in-right">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[var(--text-white)] tracking-tight">
              From Chaos to Clarity in <span className="text-[var(--accent)]">Minutes</span>.
            </h1>
            <p className="max-w-xl mx-auto md:mx-0 mt-6 text-base sm:text-lg text-[var(--text-muted)]">
              AetherSchedule is your AI co-pilot for academic operations. Generate optimized, conflict-free timetables that balance faculty workload and enhance student satisfaction.
            </p>
            <div className="mt-10 flex items-center justify-center md:justify-start gap-4">
              <GlassButton onClick={props.onGoToApp} className="px-8 py-3 text-lg group">
                Launch App
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
              </GlassButton>
              <GlassButton onClick={props.onShowHowItWorks} variant="secondary" className="px-6 py-3 text-lg">
                How It Works
              </GlassButton>
            </div>
          </div>
          <div className="relative animate-fade-in-left hidden md:block">
            <HeroVisual />
          </div>
        </section>

         <section className="mt-24 sm:mt-32">
            <div className="text-center">
                <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-white)]">The Intelligent Co-Pilot for Academic Operations</h2>
                 <p className="max-w-3xl mx-auto mt-4 text-[var(--text-muted)]">
                    Go beyond basic scheduling. AetherSchedule proactively identifies issues, provides actionable insights, and automates complex tasks, freeing you to focus on strategic goals.
                </p>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
                <FeatureCard icon={Cpu} title="AI Optimization Engine">
                    Our hyper-heuristic genetic algorithm, guided by Google Gemini, evolves millions of possibilities to find the optimal schedule.
                </FeatureCard>
                <FeatureCard icon={Search} title="Proactive Diagnostics">
                    Before scheduling, a "Pre-flight Check" analyzes all data to identify potential bottlenecks, faculty shortages, or impossible constraint combinations.
                </FeatureCard>
                 <FeatureCard icon={Sliders} title="Interactive Refinement">
                    Manually refine AI drafts with an intuitive drag-and-drop editor. The system instantly highlights any conflicts created by your changes.
                </FeatureCard>
                <FeatureCard icon={Bot} title="Natural Language Commands">
                    Instruct the AI in plain English like *"Try to move all of Dr. Smith's classes to the afternoon"* and watch it attempt the changes.
                </FeatureCard>
                <FeatureCard icon={Replace} title="Intelligent Substitute Finder">
                    Instantly finds and ranks the best-suited substitute teachers for a last-minute absence, considering workload and subject expertise.
                </FeatureCard>
                 <FeatureCard icon={BarChart4} title="Gemini-Powered Analytics">
                    Compare any two timetable versions and receive an AI-generated report summarizing key differences and their predicted impact on students and faculty.
                </FeatureCard>
             </div>
        </section>

        <section className="mt-24 sm:mt-32">
            <GlassPanel className="p-8 md:p-12">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-white)]">A Seamless Three-Step Workflow</h3>
                        <p className="text-[var(--text-muted)] mt-4 mb-8">We turn complexity into a straightforward process that combines your data with our AI's power.</p>
                        <div className="space-y-6">
                            <div className="flex items-start gap-4"><div className="p-2 bg-[hsl(var(--accent-hsl)_/_0.1)] border border-[hsl(var(--accent-hsl)_/_0.2)] rounded-lg mt-1"><Lock className="w-6 h-6 text-[var(--accent)]"/></div><div><h4 className="font-bold text-[var(--text-white)]">1. Define Your World</h4><p className="text-sm text-[var(--text-muted)]">Input subjects, faculty, rooms, and constraints to create a digital blueprint of your institution.</p></div></div>
                            <div className="flex items-start gap-4"><div className="p-2 bg-[hsl(var(--accent-hsl)_/_0.1)] border border-[hsl(var(--accent-hsl)_/_0.2)] rounded-lg mt-1"><Sliders className="w-6 h-6 text-[var(--accent)]"/></div><div><h4 className="font-bold text-[var(--text-white)]">2. Generate with AI</h4><p className="text-sm text-[var(--text-muted)]">Select batches and let the AI engine produce multiple, optimized timetable candidates.</p></div></div>
                            <div className="flex items-start gap-4"><div className="p-2 bg-[hsl(var(--accent-hsl)_/_0.1)] border border-[hsl(var(--accent-hsl)_/_0.2)] rounded-lg mt-1"><CheckCircle className="w-6 h-6 text-[var(--accent)]"/></div><div><h4 className="font-bold text-[var(--text-white)]">3. Refine & Publish</h4><p className="text-sm text-[var(--text-muted)]">Compare candidates, make manual tweaks, and publish the final schedule with one click.</p></div></div>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center justify-center p-4">
                        <WorkflowChart />
                    </div>
                </div>
            </GlassPanel>
        </section>
        
        <section className="mt-24 sm:mt-32">
            <div className="text-center">
                <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-white)]">Built on a Modern, Scalable Stack</h2>
                 <p className="max-w-2xl mx-auto mt-4 text-[var(--text-muted)]">
                    We chose a modern, performant, and scalable tech stack to ensure AetherSchedule is reliable, fast, and future-proof.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
                <TechCard icon={Atom} title="React & TypeScript">
                    The world's leading UI library paired with static typing for a highly interactive, fast, and maintainable user interface.
                </TechCard>
                 <TechCard icon={Zap} title="Hono on Vercel Edge">
                    An ultrafast web framework deployed globally for an API and frontend with maximum performance and minimal latency.
                </TechCard>
                 <TechCard icon={Database} title="Neon & Drizzle ORM">
                    A modern, serverless Postgres database paired with a next-generation TypeScript ORM for a robust, type-safe data foundation.
                </TechCard>
                <TechCard icon={BrainCircuit} title="Google Gemini API">
                    The core of our intelligence layer, used as a master strategist and creative problem-solver that guides the optimization process.
                </TechCard>
                 <TechCard icon={Palette} title="Tailwind CSS">
                    A utility-first CSS framework that enables rapid development of our sophisticated and consistent glassmorphism design system.
                </TechCard>
                 <TechCard icon={CheckCircle} title="End-to-End Type Safety">
                    From the database schema to the UI components, a fully type-safe architecture minimizes bugs and improves developer experience.
                </TechCard>
            </div>
        </section>
    </PublicPageLayout>
  );
};

export default Homepage;
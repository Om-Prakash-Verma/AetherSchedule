import React from 'react';
import { 
    University, Cpu, Shield, Database, Layers, ArrowRight, BrainCircuit, Palette, Atom, Zap, UserCheck, ThumbsUp, FileDown,
    Dna, Copy, ShieldCheck, Goal, Sliders, Blocks, MousePointer, AlertTriangle, History, Users, MessageSquare, Lock, Grid3x3, Pin, CalendarOff, Scale, Library, UserPlus, UserCog, RefreshCw, UserSquare, BarChart4, FileText, Smartphone 
} from 'lucide-react';
import { GlassPanel } from '../components/GlassPanel';
import { GlassButton } from '../components/GlassButton';

interface HomepageProps {
  onGoToApp: () => void;
  onShowHowItWorks: () => void;
  onShowAlgorithmDeepDive: () => void;
}

// A simple decorative component for the hero section
const AnimatedTimetableGrid = () => {
    const slots = Array.from({ length: 4 * 5 }); // 4 rows, 5 columns
    const occupiedSlots = [1, 3, 5, 8, 10, 11, 14, 17, 19];
    
    return (
        <GlassPanel className="p-4 md:p-6 w-full max-w-lg mx-auto relative overflow-hidden [transform:perspective(1000px)_rotateX(15deg)]">
            <div className="absolute inset-0 bg-grid-pattern opacity-10" />
            <div className="grid grid-cols-5 gap-2 relative">
                {slots.map((_, i) => {
                    const isOccupied = occupiedSlots.includes(i);
                    const animationDelay = `${i * 50}ms`;
                    return (
                        <div key={i} className={`h-12 md:h-16 rounded-md animate-fade-in-up`} style={{ animationDelay }}>
                            {isOccupied && (
                                <div className={`w-full h-full rounded-md bg-[var(--accent)]/20 border border-[var(--accent)]/30 flex items-center justify-center`}>
                                   <div className="w-1/2 h-2 bg-[var(--accent)]/50 rounded-full" />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
             <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" />
        </GlassPanel>
    )
}

const FeatureDetailCard: React.FC<{ icon: React.ElementType, title: string, children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
    <GlassPanel className="p-6 text-left flex items-start gap-4 h-full">
         <div className="p-2 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg mt-1">
            <Icon className="h-6 w-6 text-[var(--accent)]" />
        </div>
        <div>
            <h3 className="text-md font-bold text-white">{title}</h3>
            <p className="text-sm text-text-muted">{children}</p>
        </div>
    </GlassPanel>
);

const TechCard: React.FC<{ icon: React.ElementType, title: string, children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
    <GlassPanel className="p-6 h-full">
        <div className="flex items-center gap-4 mb-3">
             <div className="p-2 bg-white/5 border border-[var(--border)] rounded-lg">
                <Icon className="h-6 w-6 text-[var(--accent)]" />
            </div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        <p className="text-sm text-text-muted">{children}</p>
    </GlassPanel>
);


const Homepage: React.FC<HomepageProps> = ({ onGoToApp, onShowHowItWorks, onShowAlgorithmDeepDive }) => {
  return (
    <div className="min-h-screen bg-bg text-white font-sans overflow-x-hidden">
       {/* Adds a background decorative gradient */}
       <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-br from-accent/10 via-bg to-bg -z-10" />

      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center py-4 px-4 sm:px-6 lg:px-8 gap-4 md:gap-0">
        <div className="flex items-center gap-3">
          <University className="text-[var(--accent)]" size={32} />
          <h1 className="text-2xl font-bold">AetherSchedule</h1>
        </div>
        <nav className="flex items-center gap-2 flex-wrap justify-center">
          <GlassButton onClick={onShowHowItWorks} variant="secondary">How It Works</GlassButton>
          <GlassButton onClick={onShowAlgorithmDeepDive} variant="secondary">The AI Engine</GlassButton>
          <GlassButton onClick={onGoToApp}>Go to App</GlassButton>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto mt-12 md:mt-24 px-4 sm:px-6 lg:px-8">
        <section className="grid md:grid-cols-2 gap-12 items-center">
          <div className="text-center md:text-left animate-fade-in-right">
            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-extrabold text-white">
              Intelligent Timetabling, <span className="text-[var(--accent)]">Simplified</span>.
            </h2>
            <p className="max-w-xl mx-auto md:mx-0 mt-6 text-base sm:text-lg text-text-muted">
              Leverage our self-tuning AI engine to generate optimized, conflict-free timetables in minutes, not weeks. Designed for the dynamic needs of higher education.
            </p>
            <div className="mt-10">
              <GlassButton onClick={onGoToApp} className="px-8 py-4 text-lg group">
                Launch Scheduler
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
              </GlassButton>
            </div>
          </div>
          <div className="relative animate-fade-in-left">
            <AnimatedTimetableGrid />
          </div>
        </section>

        <section className="mt-24 sm:mt-32">
          <div className="text-center">
            <h3 className="text-2xl sm:text-3xl font-bold text-white">Every Feature for End-to-End Scheduling</h3>
            <p className="max-w-3xl mx-auto mt-4 text-text-muted">
              AetherSchedule is not just a tool; it's a complete ecosystem. We've meticulously designed every feature to address the entire scheduling lifecycle, leaving nothing to chance.
            </p>
          </div>
          
          <div className="mt-12 space-y-12">
              <div>
                  <h4 className="text-xl font-bold text-[var(--accent)] mb-6 text-center">Core Intelligence Engine</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <FeatureDetailCard icon={Dna} title="Hyper-Heuristic Genetic Algorithm">The core evolutionary engine that intelligently breeds, mutates, and evolves millions of potential timetables to find the fittest solutions.</FeatureDetailCard>
                      <FeatureDetailCard icon={BrainCircuit} title="Three-Level Gemini Integration">Goes beyond simple AI. Gemini acts as a self-tuning judge, a master strategist for the algorithm, and a creative problem-solver to break through optimization deadlocks.</FeatureDetailCard>
                      <FeatureDetailCard icon={Copy} title="Multi-Candidate Generation">Why settle for one? The engine produces several distinct, high-quality timetable candidates, each with a detailed scorecard, giving you the power of choice.</FeatureDetailCard>
                      <FeatureDetailCard icon={ShieldCheck} title="Conflict-Free by Design">Hard constraints are the bedrock of the engine. All generated solutions are guaranteed to be free of faculty, room, and batch clashes.</FeatureDetailCard>
                      <FeatureDetailCard icon={Goal} title="Sophisticated Fitness Scoring">Every candidate is meticulously scored against soft constraints like minimizing student/faculty gaps, balancing workloads, and respecting preferences.</FeatureDetailCard>
                  </div>
              </div>
              
              <div>
                  <h4 className="text-xl font-bold text-[var(--accent)] mb-6 text-center">Comprehensive Scheduling & Control</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <FeatureDetailCard icon={Blocks} title="Multi-Batch Master Scheduling">Generate complex master timetables that seamlessly coordinate schedules across multiple batches, semesters, and even entire departments.</FeatureDetailCard>
                      <FeatureDetailCard icon={MousePointer} title="Interactive Visual Editor">Manually refine AI-generated drafts with an intuitive drag-and-drop interface, giving you the perfect blend of automation and human control.</FeatureDetailCard>
                      <FeatureDetailCard icon={AlertTriangle} title="Real-Time Conflict Highlighting">Your intelligent co-pilot. The visual editor instantly flags any manual change that creates a faculty or room conflict, preventing errors before they happen.</FeatureDetailCard>
                      <FeatureDetailCard icon={History} title="Full Version Control">Never lose your work. Save multiple drafts for any timetable, allowing for easy comparison, iteration, and rollback to previous versions.</FeatureDetailCard>
                      <FeatureDetailCard icon={Users} title="Collaborative Approval Workflow">A multi-step process (Draft → Submitted → Approved/Rejected) with role-based permissions ensures schedules are properly vetted by all stakeholders.</FeatureDetailCard>
                      <FeatureDetailCard icon={MessageSquare} title="Integrated Commenting System">Department heads and managers can leave timestamped comments directly on timetable drafts, centralizing all feedback in one place.</FeatureDetailCard>
                  </div>
              </div>
              
              <div>
                  <h4 className="text-xl font-bold text-[var(--accent)] mb-6 text-center">Granular Constraint Management</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <FeatureDetailCard icon={Grid3x3} title="Faculty Availability Matrix">Easily define preferred and unavailable time slots for each faculty member using a simple, visual point-and-click matrix.</FeatureDetailCard>
                      <FeatureDetailCard icon={Pin} title="Pinned Assignments">Lock in mandatory, one-off events like guest lectures or seminars at a fixed time, forcing the AI to schedule everything else around them.</FeatureDetailCard>
                      <FeatureDetailCard icon={CalendarOff} title="Planned Leave Management">Formally block out dates for faculty conferences or holidays to ensure the AI doesn't schedule them when they are unavailable.</FeatureDetailCard>
                      <FeatureDetailCard icon={Scale} title="Global Weight Tuning">You're in control. Administrators can set the base importance of different soft constraints, telling the AI what your institution values most.</FeatureDetailCard>
                  </div>
              </div>
              
              <div>
                  <h4 className="text-xl font-bold text-[var(--accent)] mb-6 text-center">Centralized Data & User Administration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <FeatureDetailCard icon={Library} title="Unified Data Hub">A single source of truth for all institutional data: Subjects, Faculty, Rooms, Batches, and Departments, with full CRUD functionality.</FeatureDetailCard>
                      <FeatureDetailCard icon={UserPlus} title="Automatic Credential Generation">Streamline onboarding. Adding a new faculty member automatically creates their user account and a unique, secure login email.</FeatureDetailCard>
                      <FeatureDetailCard icon={UserCog} title="Full User Management">Admins can create, edit, and delete any user account and assign specific roles, maintaining complete control over the system.</FeatureDetailCard>
                      <FeatureDetailCard icon={Shield} title="Role-Based Access Control (RBAC)">A robust permission system ensures users only see and interact with the features relevant to their role (Admin, Manager, HOD, Faculty, Student).</FeatureDetailCard>
                      <FeatureDetailCard icon={RefreshCw} title="System Reset Functionality">A secure 'danger zone' feature for SuperAdmins to completely reset the application database to its initial seed state for a clean start.</FeatureDetailCard>
                  </div>
              </div>

              <div>
                  <h4 className="text-xl font-bold text-[var(--accent)] mb-6 text-center">User-Centric Experience & Reporting</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <FeatureDetailCard icon={UserSquare} title="Personalized Timetable Views">Students and faculty log in to see a clean, personalized view of only their own approved schedule, eliminating clutter and confusion.</FeatureDetailCard>
                      <FeatureDetailCard icon={ThumbsUp} title="Faculty Feedback Loop">Faculty can rate their generated schedules, providing crucial quantitative data that the Gemini AI uses to self-tune and improve future results.</FeatureDetailCard>
                      <FeatureDetailCard icon={FileDown} title="Versatile Export Options">Integrate with any workflow. Export approved timetables to CSV for spreadsheets or ICS for one-click import into calendar applications like Google or Outlook.</FeatureDetailCard>
                      <FeatureDetailCard icon={BarChart4} title="System Analytics Overview">The main dashboard provides administrators with at-a-glance statistics on all core data entities (subjects, faculty, rooms, etc.).</FeatureDetailCard>
                      <FeatureDetailCard icon={FileText} title="Insightful Reports">Access detailed reports on key metrics like room utilization and faculty workload to make data-driven administrative decisions.</FeatureDetailCard>
                      <FeatureDetailCard icon={Smartphone} title="Responsive & Modern UI">A beautiful and cohesive glassmorphism design system that provides a consistent, intuitive experience on both desktop and mobile devices.</FeatureDetailCard>
                  </div>
              </div>
          </div>
        </section>
        
         <section className="mt-24 sm:mt-32">
            <div className="text-center">
                <h3 className="text-2xl sm:text-3xl font-bold text-white">Built on a Foundation of Excellence</h3>
                 <p className="max-w-2xl mx-auto mt-4 text-text-muted">
                    We chose a modern, performant, and scalable tech stack to ensure AetherSchedule is reliable, fast, and future-proof.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
                <TechCard icon={Atom} title="React & TypeScript">
                    The world's leading UI library paired with static typing. This allows us to build a highly interactive, fast, and maintainable user interface from reusable, error-free components.
                </TechCard>
                 <TechCard icon={Zap} title="Hono">
                    A small, simple, and ultrafast web framework for both the server-side API and client-side routing. Its edge-ready performance is key to the application's snappy, responsive feel.
                </TechCard>
                 <TechCard icon={Database} title="Neon & Drizzle ORM">
                    A modern, serverless Postgres database for infinite scalability, paired with a next-generation TypeScript ORM. This provides a robust, type-safe foundation for all application data.
                </TechCard>
                <TechCard icon={BrainCircuit} title="Google Gemini API">
                    The core of our intelligence layer. We leverage Gemini not for simple text generation, but as a master strategist and creative problem-solver that guides the entire optimization process.
                </TechCard>
                 <TechCard icon={Palette} title="Tailwind CSS">
                    A utility-first CSS framework that enables us to rapidly build a sophisticated and consistent design system, resulting in the beautiful and cohesive glassmorphism theme you see.
                </TechCard>
                 <TechCard icon={Layers} title="Vercel">
                    A best-in-class cloud platform for deploying and scaling modern web applications. Vercel's serverless functions provide the global, on-demand infrastructure our API needs to run efficiently.
                </TechCard>
            </div>
        </section>

        <section className="mt-24 sm:mt-32">
            <GlassPanel className="p-8 md:p-12 text-center">
                 <h3 className="text-2xl sm:text-3xl font-bold text-white">Ready to Revolutionize Your Scheduling?</h3>
                 <p className="max-w-2xl mx-auto mt-4 text-text-muted">
                    Explore the full power of AI-driven timetabling. Launch the application and see the difference.
                </p>
                <div className="mt-8">
                    <GlassButton onClick={onGoToApp} className="px-8 py-4 text-lg group">
                        Go to App
                        <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                    </GlassButton>
                </div>
            </GlassPanel>
        </section>

      </main>

       <footer className="text-center py-12 mt-16 border-t border-[var(--border)] px-4 sm:px-6 lg:px-8">
            <p className="text-text-muted text-sm">&copy; {new Date().getFullYear()} AetherSchedule. A Demo Application.</p>
        </footer>
    </div>
  );
};

export default Homepage;
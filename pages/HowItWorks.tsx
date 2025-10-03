import React from 'react';
import { GlassPanel } from '../components/GlassPanel';
// FIX: Import missing icons 'CheckCircle' and 'ArrowRight'.
import {
  Users, ShieldCheck, Database, Cpu, Bot,
  FileCheck2, UserCheck, CalendarDays,
  BookOpen, Building, UserCog, Lock, Sliders, BarChart4, Pencil, Send, Eye, GraduationCap, ClipboardCheck, Dna, GripVertical, AlertTriangle, CheckCircle, ArrowRight
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

const SubStepCard: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode; }> = ({ icon: Icon, title, children }) => (
    <div className="bg-panel/50 rounded-lg p-4 flex items-start gap-4 border border-transparent hover:border-accent/30 transition-colors h-full">
        <Icon className="w-8 h-8 text-accent/80 shrink-0 mt-1" />
        <div>
            <h4 className="font-semibold text-white">{title}</h4>
            <p className="text-sm text-text-muted">{children}</p>
        </div>
    </div>
);

const FeatureSection: React.FC<{
  step: string;
  title: string;
  description: string;
  children: React.ReactNode;
  visual: React.ReactNode;
  reverse?: boolean;
}> = ({ step, title, description, children, visual, reverse = false }) => (
  <div className="grid md:grid-cols-2 gap-12 items-center">
    <div className={cn(reverse ? "md:order-last" : "")}>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-accent/20 border border-accent/30 font-bold text-accent text-lg">{step}</div>
        <div>
          <h3 className="text-2xl font-bold text-white">{title}</h3>
        </div>
      </div>
      <p className="text-text-muted mb-6">{description}</p>
      <div className="space-y-4">{children}</div>
    </div>
    <div className="flex items-center justify-center animate-fade-in-up">
        {visual}
    </div>
  </div>
);

const RoleCard: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
    <GlassPanel className="p-6 text-center h-full transition-all duration-300 hover:border-accent/50 hover:-translate-y-2 hover:shadow-[0_0_40px_hsl(var(--accent-hsl)_/_0.2)]">
        <div className="inline-flex items-center justify-center p-3 bg-accent/10 border border-accent/20 rounded-xl mb-4">
            <Icon className="w-8 h-8 text-accent"/>
        </div>
        <h4 className="font-bold text-white text-lg">{title}</h4>
        <p className="text-sm text-text-muted mt-2">{children}</p>
    </GlassPanel>
);

// --- NEW VISUAL COMPONENTS ---

const DataBlueprintVisual = () => (
    <GlassPanel className="p-6 relative w-full max-w-md aspect-square flex items-center justify-center bg-grid-pattern">
        <div className="absolute inset-0 bg-gradient-radial from-bg/0 via-bg/80 to-bg" />
        <div className="relative flex items-center justify-center">
            <Database className="w-20 h-20 text-accent/80" />
            {[BookOpen, Users, Building].map((Icon, i) => (
                <div key={i} className="absolute p-3 bg-panel border border-border rounded-xl shadow-lg" style={{ transform: `rotate(${i * 120}deg) translate(120px) rotate(-${i * 120}deg)` }}>
                    <Icon className="w-8 h-8 text-text-muted" />
                </div>
            ))}
        </div>
    </GlassPanel>
);

const ConstraintsVisual = () => (
    <GlassPanel className="p-4 w-full max-w-md">
        <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 15 }).map((_, i) => {
                const isAvailable = [0, 1, 4, 5, 7, 8, 10, 11, 14].includes(i);
                return (
                    <div key={i} className={cn("h-12 rounded-md flex items-center justify-center", isAvailable ? "bg-green-500/10" : "bg-panel-strong/50")}>
                        {isAvailable && <CheckCircle className="w-5 h-5 text-green-500/50" />}
                    </div>
                )
            })}
        </div>
    </GlassPanel>
);

const AIEngineVisual = () => (
    <div className="flex items-center justify-center gap-4 w-full max-w-md">
        <GlassPanel className="p-2 grid grid-cols-3 gap-1">
            {[...Array(9)].map((_, i) => <div key={i} className={cn("w-6 h-6 rounded-sm", Math.random() > 0.5 ? 'bg-accent/30' : 'bg-panel-strong')} />)}
        </GlassPanel>
        <ArrowRight className="w-12 h-12 text-accent shrink-0" />
        <GlassPanel className="p-2 grid grid-cols-3 gap-1">
            {[...Array(9)].map((_, i) => <div key={i} className={cn("w-6 h-6 rounded-sm", i % 4 === 0 ? 'bg-accent/80' : 'bg-panel-strong')} />)}
        </GlassPanel>
    </div>
);

const CollaborationVisual = () => (
    <GlassPanel className="p-4 w-full max-w-md group">
        <div className="grid grid-cols-4 gap-2">
            {[...Array(12)].map((_, i) => {
                const isOccupied = [1, 3, 6, 9, 11].includes(i);
                const isConflict = i === 9;
                return (
                    <div key={i} className={cn("h-16 rounded-lg relative", isOccupied ? 'bg-accent/20' : 'bg-panel-strong')}>
                        {isOccupied && <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><GripVertical size={16} className="text-text-muted/50" /></div>}
                        {isConflict && <div className="absolute bottom-2 left-2"><AlertTriangle size={16} className="text-danger" /></div>}
                    </div>
                )
            })}
        </div>
    </GlassPanel>
);

const DeliveryVisual = () => (
    <div className="relative w-full max-w-md h-72">
        <GlassPanel className="absolute top-0 left-0 w-full h-full p-4">
            <div className="h-full border border-border rounded-lg p-2 bg-panel-strong/50">
                <div className="grid grid-cols-5 gap-2">
                    {[...Array(15)].map((_, i) => <div key={i} className={cn("h-6 rounded-sm", [1,6,8,13].includes(i) ? 'bg-accent/50' : 'bg-panel/50')} />)}
                </div>
            </div>
        </GlassPanel>
        <GlassPanel className="absolute -bottom-4 -right-4 w-32 h-56 p-2 border-2 border-accent/50">
             <div className="h-full border border-border rounded p-1 bg-panel-strong/50">
                <div className="grid grid-cols-2 gap-1">
                    {[...Array(10)].map((_, i) => <div key={i} className={cn("h-6 rounded-sm", [1,5,8].includes(i) ? 'bg-accent/50' : 'bg-panel/50')} />)}
                </div>
            </div>
        </GlassPanel>
    </div>
);


const HowItWorks: React.FC = () => {
  return (
    <div className="space-y-24">
      <section className="text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white">
          The Journey of a Timetable
        </h1>
        <p className="text-xl text-accent mt-2">From Digital Blueprint to Daily Reality</p>
        <p className="max-w-4xl mx-auto mt-6 text-lg text-text-muted">
          AetherSchedule transforms the chaotic, headache-inducing task of university timetabling into an intelligent, automated, and collaborative process. Follow the journey of how thousands of individual requirements become one perfectly synchronized master schedule.
        </p>
      </section>

      <section className="space-y-20">
            <FeatureSection 
                step="01" 
                title="Building the Digital Blueprint"
                description="Before scheduling, we create a perfect digital reflection of your institution's resources and needs. This becomes the single source of truth for the entire system, ensuring the AI has all the pieces to the puzzle."
                visual={<DataBlueprintVisual />}
            >
                <SubStepCard icon={BookOpen} title="Subjects & Curriculum">Define every course, its type (Theory, Lab), and weekly hours. The AI uses this to ensure every course gets the time it needs.</SubStepCard>
                <SubStepCard icon={Users} title="Faculty & Expertise">Map professors to their subject expertise and teaching preferences. This is a key ingredient for both a valid schedule and faculty satisfaction.</SubStepCard>
                <SubStepCard icon={Building} title="Rooms & Resources">Catalog every space with its capacity and type (Lecture Hall, Lab). The AI knows you can't fit 100 students in a room built for 30.</SubStepCard>
            </FeatureSection>
            
            <FeatureSection 
                step="02" 
                title="Defining the Rules of the Road"
                description="Constraints are the essential boundaries that ensure every generated schedule is practical, fair, and physically possible. Think of our AI as a GPS—you tell it the destination, and these are the rules of the road."
                visual={<ConstraintsVisual />}
                reverse={true}
            >
                <SubStepCard icon={UserCheck} title="Hard Constraints (The Unbreakables)">These are the laws of physics. A professor cannot be in two places at once. The AI treats these rules as absolute and will never violate them.</SubStepCard>
                <SubStepCard icon={CalendarDays} title="Soft Constraints (The Ideals)">These are goals, not laws. For example, 'Students should have as few gaps as possible.' The AI's main job is to get as close to these ideals as possible to maximize quality.</SubStepCard>
            </FeatureSection>
            
            <FeatureSection 
                step="03" 
                title="Unleashing the AI Engine"
                description="With the blueprint and rules in place, you simply select the student batches and click 'Generate.' This activates a powerful hyper-heuristic genetic algorithm, guided by Google Gemini, that explores millions of possibilities at once."
                visual={<AIEngineVisual />}
            >
                <SubStepCard icon={Bot} title="The Gemini Game Plan">Before starting, Gemini creates a smart, multi-phase strategy for the genetic algorithm to follow, making the optimization process incredibly efficient.</SubStepCard>
                <SubStepCard icon={Dna} title="Survival of the Fittest">The AI evolves hundreds of random timetables over thousands of generations. The best schedules 'survive' and combine traits to create even better offspring, while weak ones are discarded.</SubStepCard>
            </FeatureSection>
            
            <FeatureSection 
                step="04" 
                title="AI-Human Collaboration"
                description="The AI does 99% of the heavy lifting, producing several near-perfect timetables in minutes. Now, human expertise provides the crucial final touch, turning an optimal solution into the perfect one for your institution."
                visual={<CollaborationVisual />}
                reverse={true}
            >
                 <SubStepCard icon={Eye} title="Compare & Choose">The AI presents its top candidates with a clear report card of their strengths. You choose the one that best aligns with your priorities, like student convenience or faculty satisfaction.</SubStepCard>
                 <SubStepCard icon={Pencil} title="Tweak with Confidence">Simply drag and drop any class to make a manual change. The system instantly warns you if your edit creates a conflict, so you can never make a mistake.</SubStepCard>
                 <SubStepCard icon={Send} title="Review & Approve">Share a final draft with department heads who can add comments directly on the platform, creating a clear, centralized feedback loop before final approval.</SubStepCard>
            </FeatureSection>
            
            <FeatureSection 
                step="05" 
                title="Seamless Delivery to Everyone"
                description="With a single click, the approved timetable is published. The system delivers this information to every single person in the clearest way possible, eliminating confusion entirely."
                visual={<DeliveryVisual />}
            >
                <SubStepCard icon={Users} title="Personalized Views">No more giant, overwhelming spreadsheets. A student logs in and sees only their schedule. A professor sees only the classes they are teaching. All the noise is filtered out.</SubStepCard>
                <SubStepCard icon={FileCheck2} title="Universal Access">Integrate with the tools your community already uses. Export personal timetables to Google/Outlook Calendar or download as a clean PDF/CSV file with one click.</SubStepCard>
            </FeatureSection>
      </section>

      <section>
        <SectionHeader
          icon={ShieldCheck}
          title="Roles & Responsibilities"
          subtitle="A granular, role-based access system ensures every user has precisely the tools and permissions they need to perform their job effectively—no more, no less."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <RoleCard icon={ShieldCheck} title="SuperAdmin">
                The Architect. Configures the system, manages all user accounts, and has a bird's-eye view of the entire scheduling process across all departments.
            </RoleCard>
            <RoleCard icon={ClipboardCheck} title="Timetable Manager">
                The Conductor. Orchestrates the process, from validating core data to running the AI engine and giving the final, institution-wide approval.
            </RoleCard>
            <RoleCard icon={UserCog} title="Department Head">
                The Local Expert. Manages the faculty, courses, and constraints for their own department, ensuring their unique needs are met before submitting schedules for final review.
            </RoleCard>
            <RoleCard icon={GraduationCap} title="Faculty & Student">
                The End Users. Experience the final product with a clean, personalized, and always-accessible view of their schedule. They get the right information, without any of the clutter.
            </RoleCard>
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;
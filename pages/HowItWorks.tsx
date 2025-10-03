import React from 'react';
import { GlassPanel } from '../components/GlassPanel';
import {
  Users, ShieldCheck, Database, Cpu, Bot,
  FileCheck2, UserCheck, CalendarDays,
  BookOpen, Building, UserCog, Lock, Sliders, BarChart4, Pencil, Send, Eye, GraduationCap, ClipboardCheck, Dna
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
  image: string;
  imageAlt: string;
  reverse?: boolean;
}> = ({ step, title, description, children, image, imageAlt, reverse = false }) => (
  <div className="grid md:grid-cols-2 gap-12 items-center">
    {/* FIX: Replaced invalid object syntax in cn() with a ternary operator for conditional classes. */}
    <div className={cn(reverse ? "md:order-first" : "md:order-last")}>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-accent/20 border border-accent/30 font-bold text-accent text-lg">{step}</div>
        <div>
          <h3 className="text-2xl font-bold text-white">{title}</h3>
        </div>
      </div>
      <p className="text-text-muted mb-6">{description}</p>
      <div className="space-y-4">{children}</div>
    </div>
    {/* FIX: Replaced invalid object syntax in cn() with short-circuit evaluation for conditional classes. */}
    <div className={cn("flex items-center justify-center animate-fade-in-up", reverse && "md:order-last")}>
        <GlassPanel className="p-2">
          <img src={image} alt={imageAlt} className="rounded-lg shadow-2xl" />
        </GlassPanel>
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
                image="https://storage.googleapis.com/aistudio-hosting/generations/a41f6e1e-28b3-466a-8d77-2e11a3d13239/data-management-visual.png"
                imageAlt="A screenshot of the data management interface showing lists of subjects, faculty, and rooms."
            >
                <SubStepCard icon={BookOpen} title="Subjects & Curriculum">Define every course, its type (Theory, Lab), and weekly hours. The AI uses this to ensure every course gets the time it needs.</SubStepCard>
                <SubStepCard icon={Users} title="Faculty & Expertise">Map professors to their subject expertise and teaching preferences. This is a key ingredient for both a valid schedule and faculty satisfaction.</SubStepCard>
                <SubStepCard icon={Building} title="Rooms & Resources">Catalog every space with its capacity and type (Lecture Hall, Lab). The AI knows you can't fit 100 students in a room built for 30.</SubStepCard>
            </FeatureSection>
            
            <FeatureSection 
                step="02" 
                title="Defining the Rules of the Road"
                description="Constraints are the essential boundaries that ensure every generated schedule is practical, fair, and physically possible. Think of our AI as a GPS—you tell it the destination, and these are the rules of the road."
                image="https://storage.googleapis.com/aistudio-hosting/generations/a41f6e1e-28b3-466a-8d77-2e11a3d13239/constraints-visual.png"
                imageAlt="A visual of the faculty availability matrix, showing green available slots and gray unavailable ones."
                reverse={true}
            >
                <SubStepCard icon={UserCheck} title="Hard Constraints (The Unbreakables)">These are the laws of physics. A professor cannot be in two places at once. The AI treats these rules as absolute and will never violate them.</SubStepCard>
                <SubStepCard icon={CalendarDays} title="Soft Constraints (The Ideals)">These are goals, not laws. For example, 'Students should have as few gaps as possible.' The AI's main job is to get as close to these ideals as possible to maximize quality.</SubStepCard>
            </FeatureSection>
            
            <FeatureSection 
                step="03" 
                title="Unleashing the AI Engine"
                description="With the blueprint and rules in place, you simply select the student batches and click 'Generate.' This activates a powerful hyper-heuristic genetic algorithm, guided by Google Gemini, that explores millions of possibilities at once."
                image="https://storage.googleapis.com/aistudio-hosting/generations/a41f6e1e-28b3-466a-8d77-2e11a3d13239/ai-engine-visual.png"
                imageAlt="An abstract visualization of a neural network or algorithm in action, with glowing nodes and connections."
            >
                <SubStepCard icon={Bot} title="The Gemini Game Plan">Before starting, Gemini creates a smart, multi-phase strategy for the genetic algorithm to follow, making the optimization process incredibly efficient.</SubStepCard>
                <SubStepCard icon={Dna} title="Survival of the Fittest">The AI evolves hundreds of random timetables over thousands of generations. The best schedules 'survive' and combine traits to create even better offspring, while weak ones are discarded.</SubStepCard>
            </FeatureSection>
            
            <FeatureSection 
                step="04" 
                title="AI-Human Collaboration"
                description="The AI does 99% of the heavy lifting, producing several near-perfect timetables in minutes. Now, human expertise provides the crucial final touch, turning an optimal solution into the perfect one for your institution."
                image="https://storage.googleapis.com/aistudio-hosting/generations/a41f6e1e-28b3-466a-8d77-2e11a3d13239/collaboration-visual.png"
                imageAlt="A screenshot of the scheduler interface, showing a timetable being edited with drag-and-drop handles and conflict highlighting."
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
                image="https://storage.googleapis.com/aistudio-hosting/generations/a41f6e1e-28b3-466a-8d77-2e11a3d13239/delivery-visual.png"
                imageAlt="A mock-up showing a personalized timetable view on a desktop screen and a mobile phone."
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

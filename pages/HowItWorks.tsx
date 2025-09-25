import React from 'react';
import { GlassPanel } from '../components/GlassPanel';
import {
  Users, Shield, Layers, Database, Cpu, Bot, Dna, Lightbulb,
  Shuffle, Trophy, GitMerge, FileCheck2, UserCheck, CalendarDays, Download,
  BookOpen, Building, User, School, Lock, Sliders, BarChart4, Pencil, Send, Eye
} from 'lucide-react';

const SectionHeader: React.FC<{ icon: React.ElementType; title: string; subtitle: string }> = ({ icon: Icon, title, subtitle }) => (
  <div className="text-center mb-12">
    <div className="inline-flex items-center justify-center p-4 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-2xl mb-4">
      <Icon className="h-10 w-10 text-[var(--accent)]" />
    </div>
    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{title}</h2>
    <p className="text-lg text-text-muted mt-3 max-w-3xl mx-auto">{subtitle}</p>
  </div>
);

const WorkflowStep: React.FC<{
  icon: React.ElementType;
  step: string;
  title: string;
  isLast?: boolean;
  children: React.ReactNode;
}> = ({ icon: Icon, step, title, isLast = false, children }) => (
  <div className="relative pl-16">
    {!isLast && (
      <div className="absolute left-[30px] top-12 bottom-0 w-0.5 bg-border" />
    )}
    <div className="absolute left-0 top-0 flex items-center justify-center w-[60px] h-[60px] bg-panel-strong border-2 border-[var(--accent)]/50 rounded-full">
      <Icon className="w-7 h-7 text-[var(--accent)]" />
    </div>
    <div className="ml-4">
      <h3 className="text-2xl font-bold text-white mb-2">{step}. {title}</h3>
      <div className="text-text-muted space-y-4">{children}</div>
    </div>
  </div>
);

const SubStepCard: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode; }> = ({ icon: Icon, title, children }) => (
    <div className="bg-panel/50 rounded-lg p-4 flex items-start gap-4 border border-transparent hover:border-[var(--accent)]/30 transition-colors h-full">
        <Icon className="w-8 h-8 text-[var(--accent)]/80 shrink-0 mt-1" />
        <div>
            <h4 className="font-semibold text-white">{title}</h4>
            <p className="text-sm text-text-muted">{children}</p>
        </div>
    </div>
);


const HowItWorks: React.FC = () => {
  return (
    <div className="space-y-24">
      <section className="text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white">
          The Journey of a Timetable
        </h1>
        <p className="text-xl text-[var(--accent)] mt-2">From Chaos to Clarity</p>
        <p className="max-w-4xl mx-auto mt-6 text-lg text-text-muted">
          AetherSchedule transforms the chaotic, headache-inducing task of university timetabling into an intelligent, automated, and collaborative process. Follow the journey of how thousands of individual requirements become one perfectly synchronized master schedule.
        </p>
      </section>

      <section>
        <div className="max-w-5xl mx-auto space-y-16">
            <WorkflowStep icon={Database} step="01" title="Building a Digital Blueprint">
                <p>Before we can build a house, we need a blueprint and all the right materials. The first step is to create a perfect digital reflection of your institution's resources and needs. This becomes the single source of truth for the entire system.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <SubStepCard icon={BookOpen} title="Subjects">We define every course, its code, its type (a theory class has different needs than a practical lab), and crucially, how many hours it requires per week. The AI uses this to ensure every course gets the time it needs.</SubStepCard>
                    <SubStepCard icon={User} title="Faculty">Who can teach what? We map professors to their subject expertise. This prevents the AI from assigning a history professor to a calculus class. We also record their teaching preferences, a key ingredient for faculty satisfaction.</SubStepCard>
                    <SubStepCard icon={Building} title="Rooms">Every space is cataloged—its name, its capacity, and its type. The AI understands that you can't hold a chemistry lab in a standard lecture hall or fit 100 students in a room built for 30.</SubStepCard>
                    <SubStepCard icon={School} title="Batches">We define every group of students, their department, semester, and the specific list of subjects they must take. This creates the "demand" side of the scheduling puzzle that the AI needs to solve.</SubStepCard>
                </div>
            </WorkflowStep>

            <WorkflowStep icon={Lock} step="02" title="Defining the Rules of the Road">
                <p>Think of our AI like a GPS. You tell it the destination (a finished timetable), but you also have to tell it the rules of the road. Constraints are the essential boundaries that ensure every generated schedule is practical, fair, and physically possible.</p>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <SubStepCard icon={UserCheck} title="Hard Constraints (The Unbreakables)">These are the laws of physics. A professor cannot be in two places at once. A room cannot host two classes simultaneously. The AI treats these rules as absolute and will never violate them.</SubStepCard>
                    <SubStepCard icon={CalendarDays} title="Soft Constraints (The Ideals)">These are goals, not laws. For example, "Students should have as few gaps in their day as possible" or "A professor's workload should be evenly distributed." The AI's main job is to get as close to these ideals as possible.</SubStepCard>
                </div>
            </WorkflowStep>
            
            <WorkflowStep icon={Cpu} step="03" title="The Magic of Intelligent Automation">
                <p>With the blueprint and rules in place, the human operator simply selects the student batches and clicks "Generate." This unleashes a powerful hyper-heuristic genetic algorithm, guided by Google's Gemini, that works like a team of a million schedulers exploring every possibility at once.</p>
                <GlassPanel className="p-6 mt-4 border border-[var(--accent)]/20">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <SubStepCard icon={Bot} title="The Game Plan">Before starting, Gemini creates a smart game plan. It decides to first explore a wide variety of solutions, then focus on improving the best ones it finds, and finally, apply a deep polish to the top contenders. This makes the process incredibly efficient.</SubStepCard>
                         <SubStepCard icon={Dna} title="Survival of the Fittest">The AI creates an initial "population" of hundreds of random (but valid) timetables. It then rapidly evolves them over thousands of generations. The best schedules "survive" and combine their traits to create even better offspring, while weak schedules are discarded.</SubStepCard>
                     </div>
                     <div className="text-center my-4">
                        <p className="font-mono text-[var(--accent)] text-sm">EVOLUTIONARY CORE</p>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <SubStepCard icon={BarChart4} title="The Judge">How does it know which is "best"? Every single timetable is given a fitness score. It loses points for undesirable traits (like a 4-hour gap for a student) and is rewarded for efficiency. The algorithm is obsessed with achieving the highest possible score.</SubStepCard>
                         <SubStepCard icon={Lightbulb} title="The Creative Spark">If the algorithm starts getting stuck on a good-but-not-great solution, Gemini steps in like an expert consultant. It analyzes the problem and provides a creative "nudge" to explore a completely new path, often leading to a breakthrough that evolution alone might have missed.</SubStepCard>
                     </div>
                </GlassPanel>
            </WorkflowStep>

            <WorkflowStep icon={Sliders} step="04" title="AI-Human Collaboration">
                <p>The AI does 99% of the heavy lifting, producing several near-perfect timetables in minutes. Now, human expertise provides the crucial final touch, turning an optimal solution into the perfect one for your institution's unique culture and needs.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    <SubStepCard icon={Eye} title="Compare & Choose">The AI presents you with its top candidates, each with a clear report card of its strengths. You can choose the one that best aligns with your priorities, whether that's student convenience, room usage, or faculty satisfaction.</SubStepCard>
                    <SubStepCard icon={Pencil} title="Tweak with Confidence">See a class you want to move? Simply drag and drop it. The system acts as your intelligent assistant, instantly warning you if your manual change creates a conflict, so you can never make a mistake.</SubStepCard>
                    <SubStepCard icon={Send} title="Review & Approve">Share a final draft with department heads or other stakeholders. They can add comments directly on the platform, creating a clear, centralized feedback loop before the final version is approved and locked.</SubStepCard>
                </div>
            </WorkflowStep>

            <WorkflowStep icon={FileCheck2} step="05" title="Seamless Delivery to Everyone" isLast={true}>
                <p>The hard work is done. With a single click, the approved timetable is published. The system now works to deliver this information to every single person in the clearest way possible, eliminating confusion entirely.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <SubStepCard icon={Users} title="Personalized Views">No more giant, overwhelming spreadsheets. A student logs in and sees only their schedule. A professor sees only the classes they are teaching. All the noise is filtered out, providing instant clarity.</SubStepCard>
                    <SubStepCard icon={Download} title="Universal Access">Integrate the schedule with the tools your staff and students already use. With one click, anyone can export their personal timetable to their Google or Outlook calendar, or download it as a clean CSV file for their records.</SubStepCard>
                </div>
            </WorkflowStep>
        </div>
      </section>

      <section>
        <SectionHeader
          icon={Shield}
          title="Roles & Responsibilities"
          subtitle="A granular, role-based access system ensures every user has precisely the tools and permissions they need to perform their job effectively—no more, no less."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <GlassPanel className="p-6">
                <h4 className="font-bold text-[var(--accent)] text-lg">SuperAdmin</h4>
                <p className="text-sm text-text-muted mt-1">The Architect. Configures the system, manages all user accounts, and has a bird's-eye view of the entire scheduling process across all departments.</p>
            </GlassPanel>
            <GlassPanel className="p-6">
                <h4 className="font-bold text-[var(--accent)] text-lg">Timetable Manager</h4>
                <p className="text-sm text-text-muted mt-1">The Conductor. Orchestrates the process, from validating core data to running the AI engine and giving the final, institution-wide approval.</p>
            </GlassPanel>
            <GlassPanel className="p-6">
                <h4 className="font-bold text-[var(--accent)] text-lg">Department Head</h4>
                <p className="text-sm text-text-muted mt-1">The Local Expert. Manages the faculty, courses, and constraints for their own department, ensuring their unique needs are met before submitting schedules for final review.</p>
            </GlassPanel>
            <GlassPanel className="p-6">
                <h4 className="font-bold text-[var(--accent)] text-lg">Faculty & Student</h4>
                <p className="text-sm text-text-muted mt-1">The End Users. Experience the final product with a clean, personalized, and always-accessible view of their schedule. They get the right information, without any of the clutter.</p>
            </GlassPanel>
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;
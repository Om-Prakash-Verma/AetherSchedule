import React from 'react';
import { GlassPanel } from '../components/GlassPanel';
import {
    Cpu, Dna, Bot, Lightbulb, TestTube2, CheckSquare, GitMerge, Shuffle, Repeat, Goal, Award, Sparkles, BrainCircuit, ArrowDown
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

const InfoCard: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode; }> = ({ icon: Icon, title, children }) => (
    <GlassPanel className="p-6 h-full border border-transparent hover:border-[var(--accent)]/30 transition-colors">
        <div className="flex items-start gap-4">
            <div className="p-2 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg">
                <Icon className="w-6 h-6 text-[var(--accent)]" />
            </div>
            <div>
                <h3 className="font-bold text-white text-lg">{title}</h3>
                <p className="text-sm text-text-muted mt-1">{children}</p>
            </div>
        </div>
    </GlassPanel>
);

const FlowStep: React.FC<{ number: string, title: string, children: React.ReactNode }> = ({ number, title, children }) => (
    <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-[var(--accent)]/20 border border-[var(--accent)]/30 font-bold text-[var(--accent)]">{number}</div>
        <div>
            <h4 className="font-bold text-white">{title}</h4>
            <p className="text-sm text-text-muted">{children}</p>
        </div>
    </div>
);

const AlgorithmDeepDive: React.FC = () => {
  return (
    <div className="space-y-24">
      <section className="text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white">
          Under the Hood: The AetherSchedule AI Engine
        </h1>
        <p className="text-xl text-[var(--accent)] mt-2">A Symphony of Algorithms and Intelligence</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <InfoCard icon={GitMerge} title="Chromosome">
                Each "chromosome" is a single, complete timetable. It's a full set of class assignments, representing one possible solution to the entire puzzle.
            </InfoCard>
            <InfoCard icon={Shuffle} title="Population">
                The algorithm starts by creating a large "population" of hundreds of different chromosomes (timetables). Most of these initial solutions are random and not very good.
            </InfoCard>
            <InfoCard icon={Goal} title="Fitness Function">
                This is the judge. Every single timetable is given a score based on how well it meets our goals. It loses points for student gaps, faculty overwork, and other "bad" traits. The goal of evolution is to maximize this score.
            </InfoCard>
        </div>
        <h3 className="text-2xl font-bold text-center mt-12 mb-8 text-white">The Evolutionary Cycle</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <InfoCard icon={CheckSquare} title="Selection">
                The best timetables (those with the highest fitness scores) are selected to be "parents" for the next generation. This is survival of the fittest in action.
            </InfoCard>
            <InfoCard icon={TestTube2} title="Crossover">
                Two parent timetables are combined. For example, the algorithm might take Monday and Tuesday from Timetable A and the rest of the week from Timetable B, creating a new "child" that inherits traits from both.
            </InfoCard>
            <InfoCard icon={Repeat} title="Mutation">
                To keep the gene pool fresh and avoid getting stuck, the algorithm introduces small, random changes. It might swap two classes or move a single class to a new time slot, exploring new possibilities.
            </InfoCard>
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
          title="The Secret Sauce: Google Gemini Integration"
          subtitle="This is what elevates our engine from merely smart to truly intelligent. We use Gemini not just to generate content, but as an active participant and strategist in the optimization process itself."
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <InfoCard icon={Award} title="Level 1: The Self-Tuning Judge">
                Gemini analyzes feedback from past timetables (e.g., faculty ratings) to dynamically adjust the fitness function. If faculty consistently dislike morning gaps, Gemini tells the algorithm to penalize that trait more heavily in the next run, making the system learn and adapt over time.
            </InfoCard>
            <InfoCard icon={BrainCircuit} title="Level 2: The Master Strategist">
                Before the evolution even begins, Gemini creates a custom, multi-phase game plan. It decides the optimal balance of exploration (broad searching) and exploitation (deep refinement) for the specific problem, ensuring the most efficient path to a solution.
            </InfoCard>
            <InfoCard icon={Lightbulb} title="Level 3: The Creative Interventionist">
                If the algorithm gets stuck for too long, it sends the problematic timetable to Gemini. Gemini analyzes the deadlock and suggests a creative, "out-of-the-box" structural change to get the evolutionary process moving again, breaking through barriers that pure algorithms might not.
            </InfoCard>
        </div>
      </section>
      
      <section>
        <SectionHeader
          icon={Cpu}
          title="The Full Process: A Step-by-Step Flow"
          subtitle="Here’s how these layers work in concert when a user clicks 'Generate'."
        />
        <GlassPanel className="max-w-4xl mx-auto p-8">
            <div className="space-y-6">
                <FlowStep number="1" title="User Request">The process starts when a Timetable Manager selects batches and clicks 'Generate'.</FlowStep>
                <div className="pl-14"><ArrowDown className="text-[var(--accent)]"/></div>
                <FlowStep number="2" title="Gemini Devises Strategy">Gemini analyzes the request and provides a high-level, multi-phase plan for the Genetic Algorithm to follow.</FlowStep>
                <div className="pl-14"><ArrowDown className="text-[var(--accent)]"/></div>
                <FlowStep number="3" title="Initial Population Created">The engine generates hundreds of random, but valid, timetables to form the starting gene pool.</FlowStep>
                <div className="pl-14"><ArrowDown className="text-[var(--accent)]"/></div>
                <FlowStep number="4" title="Evolutionary Loop Begins">For a set number of generations, the engine performs a cycle of Selection, Crossover, and Mutation, guided by Gemini's strategy and the fitness score of each timetable.</FlowStep>
                <div className="pl-14"><ArrowDown className="text-[var(--accent)]"/></div>
                <FlowStep number="5" title="Stagnation Check & Intervention">During the loop, if the top score doesn't improve for several generations, Gemini is called upon for a creative intervention to un-stick the process.</FlowStep>
                <div className="pl-14"><ArrowDown className="text-[var(--accent)]"/></div>
                <FlowStep number="6" title="Final Candidates Emerge">After the loop completes, the population contains highly evolved, high-scoring timetables. The engine selects the top 5 distinct candidates.</FlowStep>
                 <div className="pl-14"><ArrowDown className="text-[var(--accent)]"/></div>
                <FlowStep number="7" title="Results Presented to User">The top candidates, each with a detailed scorecard of its metrics (student gaps, etc.), are presented to the user for final review and refinement.</FlowStep>
            </div>
        </GlassPanel>
      </section>

    </div>
  );
};

export default AlgorithmDeepDive;
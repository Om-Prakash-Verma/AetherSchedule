import React from 'react';
import { Cpu, Dna, Bot, Lightbulb, BrainCircuit } from 'lucide-react';
import { SectionHeader } from '../components/deepdive/SectionHeader';
import { InfoCard } from '../components/deepdive/InfoCard';
import { GeneticAlgorithmVisualizer } from '../components/deepdive/GeneticAlgorithmVisualizer';
import { GeminiLevelCard } from '../components/deepdive/GeminiLevelCard';
import { FullProcessFlowchart } from '../components/deepdive/FullProcessFlowchart';

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
            <InfoCard icon={Lightbulb} title="Simulated Annealing">
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
            <GeminiLevelCard icon={Lightbulb} level={1} title="The Self-Tuning Judge">
                Gemini analyzes feedback from past timetables (e.g., faculty ratings) to dynamically adjust the fitness function. If faculty consistently dislike morning gaps, Gemini tells the algorithm to penalize that trait more heavily in the next run, making the system learn and adapt over time.
            </GeminiLevelCard>
            <GeminiLevelCard icon={BrainCircuit} level={2} title="The Master Strategist">
                Before the evolution even begins, Gemini creates a custom, multi-phase game plan. It decides the optimal balance of exploration (broad searching) and exploitation (deep refinement) for the specific problem, ensuring the most efficient path to a solution.
            </GeminiLevelCard>
            <GeminiLevelCard icon={Bot} level={3} title="The Creative Interventionist" isLast>
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

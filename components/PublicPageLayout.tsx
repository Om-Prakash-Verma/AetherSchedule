import React, { useState, useEffect } from 'react';
import { University, ArrowRight } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { GlassButton } from './GlassButton';
import { cn } from '../utils/cn';

interface PublicPageLayoutProps {
  children: React.ReactNode;
  onGoToApp: () => void;
  onGoToHome: () => void;
  onShowHowItWorks: () => void;
  onShowAlgorithmDeepDive: () => void;
  currentPage: 'Home' | 'HowItWorks' | 'AlgorithmDeepDive';
}

export const PublicPageLayout: React.FC<PublicPageLayoutProps> = ({ 
    children, onGoToApp, onGoToHome, onShowHowItWorks, onShowAlgorithmDeepDive, currentPage 
}) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-white)] font-sans overflow-x-hidden relative">
      <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-radial from-accent/5 to-transparent blur-[150px] -z-10" />
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-br from-accent/10 via-bg to-bg -z-10" />

      <header className={cn(
        "sticky top-0 z-50 transition-colors duration-300",
        isScrolled ? "header-scrolled" : "bg-transparent"
      )}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center py-4 px-4 sm:px-6 lg:px-8 gap-4 md:gap-0">
            <button onClick={onGoToHome} className="flex items-center gap-3">
            <University className="text-[var(--accent)]" size={32} />
            <h1 className="text-2xl font-bold">AetherSchedule</h1>
            </button>
            <nav className="flex items-center gap-2 flex-wrap justify-center">
                {currentPage !== 'Home' && <GlassButton onClick={onGoToHome} variant="secondary">Home</GlassButton>}
                {currentPage !== 'HowItWorks' && <GlassButton onClick={onShowHowItWorks} variant="secondary">How It Works</GlassButton>}
                {currentPage !== 'AlgorithmDeepDive' && <GlassButton onClick={onShowAlgorithmDeepDive} variant="secondary">The AI Engine</GlassButton>}
                <GlassButton onClick={onGoToApp}>Go to App</GlassButton>
            </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto mt-8 sm:mt-12 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
      
      <section className="max-w-7xl mx-auto mt-24 sm:mt-32 px-4 sm:px-6 lg:px-8">
        <GlassPanel className="p-8 md:p-12 text-center">
             <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-white)]">Ready to Revolutionize Your Scheduling?</h3>
             <p className="max-w-2xl mx-auto mt-4 text-[var(--text-muted)]">
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

      <footer className="text-center py-12 mt-16 border-t border-[var(--border)] px-4 sm:px-6 lg:px-8">
        <p className="text-[var(--text-muted)] text-sm">&copy; {new Date().getFullYear()} AetherSchedule. A Demo Application.</p>
      </footer>
    </div>
  );
};

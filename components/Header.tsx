import React from 'react';
import { Menu } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import RealTimeClock from './RealTimeClock';
import { GlassPanel } from './GlassPanel';

export const Header: React.FC = () => {
  const { user, currentPage, toggleSidebar } = useAppContext();

  return (
    <header className="px-4 sm:px-6 lg:px-8 py-4 shrink-0">
        <GlassPanel className="flex justify-between items-center gap-4 p-4">
            <div className="flex items-center gap-4">
                {/* Hamburger Menu for Mobile */}
                <button onClick={toggleSidebar} className="md:hidden text-[var(--text-muted)] hover:text-[var(--text-white)]">
                <Menu size={24} />
                </button>
                <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-white)] capitalize">{currentPage}</h1>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] hidden sm:block">Welcome back, {user?.name || 'Guest'}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <RealTimeClock />
            </div>
        </GlassPanel>
    </header>
  );
};

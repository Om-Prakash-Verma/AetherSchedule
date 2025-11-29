// FIX: Removed invalid file header comment that was causing a syntax error.
import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppContext } from '../hooks/useAppContext';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isSidebarCollapsed, isSidebarOpen, toggleSidebar, currentPage } = useAppContext();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-white)] font-sans">
      <Sidebar />
      <div className={`transition-all duration-300 h-screen flex flex-col
        ${isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'}
      `}>
        <div className="sticky top-0 z-20 bg-bg/80 backdrop-blur-md">
          <Header />
        </div>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div key={currentPage} className="animate-fade-in-up" style={{ animationDuration: '300ms' }}>
                {children}
            </div>
        </main>
      </div>
       {/* Mobile Sidebar Overlay */}
       {isSidebarOpen && (
        <div 
          onClick={toggleSidebar} 
          className="fixed inset-0 z-30 bg-black/75 backdrop-blur-sm md:hidden"
        />
      )}
    </div>
  );
};

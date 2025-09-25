import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppContext } from '../hooks/useAppContext';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isSidebarCollapsed, isSidebarOpen, toggleSidebar } = useAppContext();

  return (
    <div className="min-h-screen bg-bg text-white font-sans">
      <Sidebar />
      <div className={`transition-all duration-300
        ${isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'}
      `}>
        <Header />
        <main className="p-4 sm:p-6 lg:p-8">
            {children}
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

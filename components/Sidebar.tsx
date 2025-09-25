import React from 'react';
import { LogOut, University, ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import { NAV_ITEMS } from '../constants';
import { useAppContext } from '../hooks/useAppContext';
import type { Page } from '../types';

export const Sidebar: React.FC = () => {
  const { 
    currentPage, setCurrentPage, logout, user, 
    isSidebarOpen, toggleSidebar, isSidebarCollapsed, toggleSidebarCollapse
  } = useAppContext();

  const handleNavClick = (page: Page) => {
    setCurrentPage(page);
    if (isSidebarOpen) {
      toggleSidebar();
    }
  };

  const visibleNavItems = NAV_ITEMS.filter(item => {
    if (!user) return false;
    const userRole = user.role;

    // Students and Faculty only see 'My Timetable'
    if (userRole === 'Student' || userRole === 'Faculty') {
      return item.name === 'My Timetable';
    }
    
    // Other roles do not see 'My Timetable'
    if (item.name === 'My Timetable') {
        return false;
    }

    if (userRole === 'DepartmentHead') {
        return ['Dashboard', 'Scheduler', 'Data Management', 'Constraints', 'Reports'].includes(item.name);
    }
    
    // SuperAdmin and TimetableManager see all other items.
    return true;
  });

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 h-full flex flex-col bg-panel/95 backdrop-blur-xl border-r border-[var(--border)] transition-all duration-300
      ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      md:translate-x-0
      ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'}
    `}>
        <div className={`p-4 flex items-center gap-3 border-b border-[var(--border)] shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'justify-center h-[73px]' : 'h-[73px]'}`}>
            <University className="text-[var(--accent)] shrink-0" size={28} />
            <span className={`text-xl font-bold text-white transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>AetherSchedule</span>
            <button onClick={toggleSidebar} className="md:hidden ml-auto text-text-muted">
                <X size={24} />
            </button>
        </div>
      
      <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto">
        {visibleNavItems.map(item => (
          <button
            key={item.name}
            title={item.name}
            onClick={() => handleNavClick(item.name)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group relative
              ${isSidebarCollapsed ? 'justify-center' : ''}
              ${ currentPage === item.name
                ? 'text-white'
                : 'text-text-muted hover:bg-white/10 hover:text-white'
            }`}
          >
             {currentPage === item.name && (
                <span className="absolute inset-0 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-lg shadow-inner" style={{boxShadow: 'inset 0 0 10px 0 hsl(217.2 91.2% 59.8% / 0.2)'}}></span>
             )}
            <item.icon className={`h-5 w-5 shrink-0 transition-colors ${currentPage === item.name ? 'text-[var(--accent)]' : ''}`} />
            <span className={`relative transition-opacity duration-200 whitespace-nowrap ${isSidebarCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>{item.name}</span>
          </button>
        ))}
      </nav>

      {/* User Profile & Logout */}
      <div className="p-2 border-t border-[var(--border)] shrink-0">
          <div className={`p-2 flex items-center gap-3 ${isSidebarCollapsed ? 'flex-col' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-[var(--accent)]/20 border border-[var(--accent)]/30 flex items-center justify-center font-bold text-[var(--accent)] shrink-0">
                  {user?.name.charAt(0)}
              </div>
              <div className={`flex-1 overflow-hidden transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
                  <p className="font-semibold text-sm text-white truncate">{user?.name}</p>
                  <p className="text-xs text-text-muted truncate">{user?.role}</p>
              </div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className={`w-full flex items-center gap-3 px-4 py-3 mt-2 rounded-lg text-sm font-medium text-text-muted hover:bg-white/10 hover:text-white transition-colors
             ${isSidebarCollapsed ? 'justify-center' : ''}`}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={`transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>Logout</span>
          </button>
      </div>

      {/* Collapse Toggle */}
      <button 
        onClick={toggleSidebarCollapse} 
        className="hidden md:block absolute -right-3 top-20 bg-panel border border-[var(--border)] rounded-full p-1.5 text-text-muted hover:text-white transition-all hover:border-[var(--accent)]/50"
      >
        {isSidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
      </button>
    </aside>
  );
};
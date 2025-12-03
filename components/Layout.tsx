import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, BarChart3, Settings, Command, Cloud, Loader2, Menu, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../context/StoreContext';

interface LayoutProps {
  children: React.ReactNode;
}

const SidebarItem = ({ to, icon: Icon, label, onClick }: { to: string, icon: any, label: string, onClick?: () => void }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    return (
        <NavLink
            to={to}
            onClick={onClick}
            className={clsx(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                    ? "bg-primary/20 text-primary border border-primary/20 shadow-[0_0_15px_rgba(99,102,241,0.3)]" 
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
            )}
        >
            <Icon size={20} className={clsx("transition-transform group-hover:scale-110", isActive && "text-primary")} />
            <span className="font-medium">{label}</span>
        </NavLink>
    );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { loading } = useStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on route change (mobile)
  useEffect(() => {
      setIsSidebarOpen(false);
  }, [location.pathname]);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
      if (isSidebarOpen) {
          document.body.style.overflow = 'hidden';
      } else {
          document.body.style.overflow = 'unset';
      }
  }, [isSidebarOpen]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black text-slate-200 selection:bg-primary/30">
      
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-glassBorder px-4 py-3 flex items-center justify-between safe-area-top">
          <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                    <Command size={18} className="text-white" />
                </div>
                <span className="font-bold text-white tracking-tight text-lg">AetherSchedule</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-slate-300 hover:bg-white/10 rounded-lg active:scale-95 transition-transform"
            aria-label="Toggle Menu"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
      </div>

      {/* Backdrop for Mobile */}
      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
          "fixed lg:relative inset-y-0 left-0 z-50 w-72 lg:w-64 flex-shrink-0 flex flex-col border-r border-glassBorder bg-slate-950/95 lg:bg-slate-950/30 backdrop-blur-2xl lg:backdrop-blur-xl p-4 transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1) shadow-2xl lg:shadow-none",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="hidden lg:flex items-center gap-3 px-2 py-4 mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                <Command size={18} className="text-white" />
            </div>
            <div>
                <h1 className="text-lg font-bold text-white tracking-tight">AetherSchedule</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Digital Twin v1.0</p>
            </div>
        </div>
        
        {/* Mobile Sidebar Header */}
        <div className="lg:hidden flex items-center justify-between mb-8 px-2 pt-2">
            <span className="text-slate-400 text-xs uppercase font-bold tracking-widest">Navigation</span>
            <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 text-slate-500 hover:text-white transition-colors"
            >
                <X size={20} />
            </button>
        </div>

        <nav className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1">
            <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" />
            <SidebarItem to="/schedule" icon={Calendar} label="Scheduler" />
            <SidebarItem to="/resources" icon={Users} label="Resources" />
            <SidebarItem to="/analytics" icon={BarChart3} label="Analytics" />
        </nav>

        <div className="mt-auto pt-6 border-t border-glassBorder space-y-4">
            {/* Connection Status Indicator */}
            <div className={clsx(
                "px-4 py-3 rounded-xl border flex items-center gap-3 text-xs font-medium transition-colors",
                loading 
                    ? "bg-slate-800/50 border-slate-700 text-slate-400"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
            )}>
                {loading ? (
                    <Loader2 size={16} className="animate-spin flex-shrink-0" />
                ) : (
                    <Cloud size={16} className="flex-shrink-0" />
                )}
                <div className="min-w-0">
                    <p className="truncate">{loading ? "Connecting..." : "Live Database"}</p>
                    <p className="opacity-60 text-[10px] truncate">
                        {loading ? "Initializing..." : "Firebase Connected"}
                    </p>
                </div>
            </div>

            <SidebarItem to="/settings" icon={Settings} label="Settings" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative w-full custom-scrollbar">
        {/* Spacer for Mobile Header */}
        <div className="h-16 lg:hidden flex-shrink-0" />
        
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto pb-24 safe-area-bottom">
            {children}
        </div>
      </main>
      
      {/* Ambient background effects */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-50 md:opacity-100">
          <div className="absolute top-[-10%] right-[-5%] w-64 md:w-96 h-64 md:h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-10%] left-[-5%] w-64 md:w-96 h-64 md:h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
};

export default Layout;
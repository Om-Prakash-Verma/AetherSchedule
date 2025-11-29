import React,
{
  createContext,
  useState,
  useCallback,
  ReactNode,
  useMemo,
} from 'react';
import * as api from '../services';
import { useToast } from '../hooks/useToast';
import type { User, Page } from '../types';
import { generateTimeSlots } from '../utils/time';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface AppContextType {
  user: User | null;
  isLoading: boolean;
  currentPage: Page;
  timeSlots: string[];
  appInitializationError: string | null;

  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;

  login: (user: User) => void;
  logout: () => void;
  setCurrentPage: (page: Page) => void;
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  
  refreshAllData: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error: appInitializationError } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    staleTime: Infinity,
    retry: (failureCount, error) => {
      // Don't retry on critical server errors, as it indicates a backend problem.
      const message = (error as Error).message || '';
      if (message.includes('500') || message.includes('Failed to fetch')) {
        return false;
      }
      return failureCount < 2;
    },
  });
  
  const timetableSettings = settings?.timetableSettings;
  const timeSlots = useMemo(() => 
    timetableSettings ? generateTimeSlots(timetableSettings) : [],
    [timetableSettings]
  );
  
  const refreshAllData = useCallback(async () => {
      toast.info("Refreshing all data...");
      await queryClient.invalidateQueries();
      toast.success("Data refreshed.");
  }, [queryClient, toast]);

  const login = (loggedInUser: User) => {
    setUser(loggedInUser);
    // Navigate to the correct default page based on role.
    if (loggedInUser.role === 'Student' || loggedInUser.role === 'Faculty') {
        setCurrentPage('My Timetable');
    } else {
        setCurrentPage('Dashboard');
    }
  };

  const logout = () => {
    setUser(null);
    setCurrentPage('Homepage');
    // Clear all cached data on logout to ensure the next user sees fresh data
    queryClient.clear();
  };

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
  const toggleSidebarCollapse = () => setIsSidebarCollapsed(prev => !prev);

  const contextValue = useMemo(() => ({
    user,
    isLoading,
    currentPage,
    timeSlots, 
    appInitializationError: appInitializationError ? appInitializationError.message : null,
    isSidebarOpen,
    isSidebarCollapsed,
    login,
    logout,
    setCurrentPage,
    toggleSidebar,
    toggleSidebarCollapse,
    refreshAllData,
  }), [
      user, isLoading, currentPage, timeSlots, appInitializationError, 
      isSidebarOpen, isSidebarCollapsed, refreshAllData
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};
import React,
{
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useMemo,
} from 'react';
import * as api from '../services';
import { useToast } from '../hooks/useToast';
import type {
  User,
  Page,
  Subject,
  Faculty,
  Room,
  Batch,
  Department,
  GeneratedTimetable,
  Constraints,
  GlobalConstraints,
} from '../types';

interface AppContextType {
  user: User | null;
  users: User[];
  isLoading: boolean;
  currentPage: Page;
  subjects: Subject[];
  faculty: Faculty[];
  rooms: Room[];
  batches: Batch[];
  departments: Department[];
  generatedTimetables: GeneratedTimetable[];
  constraints: Constraints;
  globalConstraints: GlobalConstraints | null;

  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;

  login: (user: User) => void;
  logout: () => void;
  setCurrentPage: (page: Page) => void;
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  
  refreshData: () => Promise<void>;
  setGlobalConstraints: React.Dispatch<React.SetStateAction<GlobalConstraints | null>>;
}

export const AppContext = createContext<AppContextType | null>(null);

const defaultConstraints: Constraints = {
  pinnedAssignments: [],
  plannedLeaves: [],
  facultyAvailability: [],
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>('Dashboard');
  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [generatedTimetables, setGeneratedTimetables] = useState<GeneratedTimetable[]>([]);
  const [constraints, setConstraints] = useState<Constraints>(defaultConstraints);
  const [globalConstraints, setGlobalConstraints] = useState<GlobalConstraints | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toast = useToast();

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.getAllData();
      setUsers(data.users || []);
      setSubjects(data.subjects || []);
      setFaculty(data.faculty || []);
      setRooms(data.rooms || []);
      setBatches(data.batches || []);
      setDepartments(data.departments || []);
      setGeneratedTimetables(data.generatedTimetables || []);
      setConstraints(data.constraints || defaultConstraints);
      setGlobalConstraints(data.globalConstraints || null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load initial data.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const login = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentPage(loggedInUser.role === 'Student' || loggedInUser.role === 'Faculty' ? 'My Timetable' : 'Dashboard');
  };

  const logout = () => {
    setUser(null);
    setCurrentPage('Homepage');
    toast.success('Logged out successfully.');
  };

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
  const toggleSidebarCollapse = () => setIsSidebarCollapsed(prev => !prev);

  const contextValue = useMemo(() => ({
    user,
    users,
    isLoading,
    currentPage,
    subjects,
    faculty,
    rooms,
    batches,
    departments,
    generatedTimetables,
    constraints,
    globalConstraints,
    isSidebarOpen,
    isSidebarCollapsed,
    login,
    logout,
    setCurrentPage,
    toggleSidebar,
    toggleSidebarCollapse,
    refreshData: fetchData,
    setGlobalConstraints,
  }), [
      user, users, isLoading, currentPage, subjects, faculty, rooms, batches, departments,
      generatedTimetables, constraints, globalConstraints, isSidebarOpen, isSidebarCollapsed, fetchData
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};
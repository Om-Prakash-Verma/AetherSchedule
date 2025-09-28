import React,
{
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useMemo,
  useRef,
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
  TimetableSettings,
} from '../types';
import { generateTimeSlots } from '../utils/time';

type LoadingStates = {
  [key in 'users' | 'subjects' | 'faculty' | 'rooms' | 'batches' | 'departments' | 'timetables' | 'constraints' | 'settings']: boolean;
}

interface AppContextType {
  user: User | null;
  users: User[];
  isLoading: boolean; // For initial app shell auth check
  loadingStates: LoadingStates;
  currentPage: Page;
  subjects: Subject[];
  faculty: Faculty[];
  rooms: Room[];
  batches: Batch[];
  departments: Department[];
  generatedTimetables: GeneratedTimetable[];
  constraints: Constraints;
  globalConstraints: GlobalConstraints | null;
  timetableSettings: TimetableSettings | null;
  timeSlots: string[];
  appInitializationError: string | null;

  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;

  login: (user: User) => void;
  logout: () => void;
  setCurrentPage: (page: Page) => void;
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  
  // Data fetching functions
  fetchUsers: () => Promise<void>;
  fetchSubjects: () => Promise<void>;
  fetchFaculty: () => Promise<void>;
  fetchRooms: () => Promise<void>;
  fetchBatches: () => Promise<void>;
  fetchDepartments: () => Promise<void>;
  fetchTimetables: () => Promise<void>;
  fetchConstraints: () => Promise<void>;

  // Combined refresh
  refreshData: () => Promise<void>;
  
  setGlobalConstraints: React.Dispatch<React.SetStateAction<GlobalConstraints | null>>;
  setTimetableSettings: React.Dispatch<React.SetStateAction<TimetableSettings | null>>;
}

export const AppContext = createContext<AppContextType | null>(null);

const defaultConstraints: Constraints = {
  pinnedAssignments: [],
  plannedLeaves: [],
  facultyAvailability: [],
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [appInitializationError, setAppInitializationError] = useState<string | null>(null);
  
  // --- Granular State ---
  const [users, setUsers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [generatedTimetables, setGeneratedTimetables] = useState<GeneratedTimetable[]>([]);
  const [constraints, setConstraints] = useState<Constraints>(defaultConstraints);
  const [globalConstraints, setGlobalConstraints] = useState<GlobalConstraints | null>(null);
  const [timetableSettings, setTimetableSettings] = useState<TimetableSettings | null>(null);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  // Page state
  const [currentPage, setCurrentPage] = useState<Page>('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    users: false, subjects: false, faculty: false, rooms: false, batches: false, 
    departments: false, timetables: false, constraints: false, settings: false
  });

  const toast = useToast();

  // Ref to track if data has been fetched to prevent re-fetches
  const fetchedRef = useRef({
     users: false, subjects: false, faculty: false, rooms: false, batches: false, 
     departments: false, timetables: false, constraints: false
  });

  // --- Optimized Initial Load ---
  const loadInitialShell = useCallback(async () => {
    try {
      setIsLoading(true);
      setAppInitializationError(null);
      setLoadingStates(s => ({...s, settings: true }));
      const { globalConstraints: gc, timetableSettings: ts } = await api.getSettings();
      setGlobalConstraints(gc);
      setTimetableSettings(ts);
    } catch (error: any) {
       const errorMessage = error.message || 'Failed to load initial settings.';
       console.error("App Initialization Error:", errorMessage);
       setAppInitializationError(errorMessage);
       toast.error(errorMessage);
    } finally {
        setIsLoading(false);
        setLoadingStates(s => ({...s, settings: false }));
    }
  }, [toast]);

  useEffect(() => {
    loadInitialShell();
  }, [loadInitialShell]);
  
  useEffect(() => {
    if(timetableSettings) {
        setTimeSlots(generateTimeSlots(timetableSettings));
    }
  }, [timetableSettings]);

  // --- Granular On-Demand Fetching Functions ---
  const createFetcher = <T,>(
    key: keyof LoadingStates, 
    apiCall: () => Promise<T>, 
    setter: (data: T) => void
  ) => useCallback(async () => {
    if (fetchedRef.current[key as keyof typeof fetchedRef.current]) return;

    setLoadingStates(s => ({...s, [key]: true }));
    try {
      const data = await apiCall();
      setter(data);
      fetchedRef.current[key as keyof typeof fetchedRef.current] = true;
    } catch (e: any) {
      toast.error(`Failed to load ${key}: ${e.message}`);
    } finally {
      setLoadingStates(s => ({...s, [key]: false }));
    }
  }, [key, apiCall, setter, toast]);

  const fetchUsers = createFetcher('users', api.getUsers, setUsers);
  const fetchSubjects = createFetcher('subjects', api.getSubjects, setSubjects);
  const fetchFaculty = createFetcher('faculty', api.getFaculty, setFaculty);
  const fetchRooms = createFetcher('rooms', api.getRooms, setRooms);
  const fetchBatches = createFetcher('batches', api.getBatches, setBatches);
  const fetchDepartments = createFetcher('departments', api.getDepartments, setDepartments);
  const fetchTimetables = createFetcher('timetables', api.getTimetables, setGeneratedTimetables);
  const fetchConstraints = createFetcher('constraints', api.getConstraints, setConstraints);

  const refreshData = useCallback(async () => {
      // Reset fetched flags
      Object.keys(fetchedRef.current).forEach(key => {
          (fetchedRef.current as any)[key] = false;
      });
      // Re-fetch everything in parallel
      toast.info("Refreshing all data...");
      // A full refresh should re-fetch settings too
      await Promise.all([
          loadInitialShell(),
          fetchUsers(),
          fetchSubjects(),
          fetchFaculty(),
          fetchRooms(),
          fetchBatches(),
          fetchDepartments(),
          fetchTimetables(),
          fetchConstraints(),
      ]);
      toast.success("Data refreshed.");
  }, [loadInitialShell, fetchUsers, fetchSubjects, fetchFaculty, fetchRooms, fetchBatches, fetchDepartments, fetchTimetables, fetchConstraints, toast]);


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
    loadingStates,
    currentPage,
    subjects,
    faculty,
    rooms,
    batches,
    departments,
    generatedTimetables,
    constraints,
    globalConstraints,
    timetableSettings,
    timeSlots,
    appInitializationError,
    isSidebarOpen,
    isSidebarCollapsed,
    login,
    logout,
    setCurrentPage,
    toggleSidebar,
    toggleSidebarCollapse,
    refreshData,
    fetchUsers,
    fetchSubjects,
    fetchFaculty,
    fetchRooms,
    fetchBatches,
    fetchDepartments,
    fetchTimetables,
    fetchConstraints,
    setGlobalConstraints,
    setTimetableSettings,
  }), [
      user, users, isLoading, loadingStates, currentPage, subjects, faculty, rooms, batches, departments,
      generatedTimetables, constraints, globalConstraints, timetableSettings, timeSlots, appInitializationError, 
      isSidebarOpen, isSidebarCollapsed, refreshData, fetchUsers, fetchSubjects, fetchFaculty, fetchRooms, 
      fetchBatches, fetchDepartments, fetchTimetables, fetchConstraints
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

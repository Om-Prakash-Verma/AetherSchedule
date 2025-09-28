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
  Substitution,
  FacultyAllocation, // NEW: Import type
} from '../types';
import { generateTimeSlots } from '../utils/time';

type LoadingStates = {
  [key in 'users' | 'subjects' | 'faculty' | 'rooms' | 'batches' | 'departments' | 'timetables' | 'constraints' | 'settings' | 'substitutions' | 'facultyAllocations']: boolean;
}

interface AppContextType {
  user: User | null;
  users: User[];
  isLoading: boolean;
  loadingStates: LoadingStates;
  currentPage: Page;
  subjects: Subject[];
  faculty: Faculty[];
  rooms: Room[];
  batches: Batch[];
  departments: Department[];
  generatedTimetables: GeneratedTimetable[];
  constraints: Constraints;
  facultyAllocations: FacultyAllocation[]; // NEW: Add to context
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
  
  fetchUsers: () => Promise<void>;
  fetchSubjects: () => Promise<void>;
  fetchFaculty: () => Promise<void>;
  fetchRooms: () => Promise<void>;
  fetchBatches: () => Promise<void>;
  fetchDepartments: () => Promise<void>;
  fetchTimetables: () => Promise<void>;
  fetchConstraints: () => Promise<void>;
  fetchSubstitutions: () => Promise<void>;
  fetchFacultyAllocations: () => Promise<void>; // NEW: Add fetcher

  refreshData: () => Promise<void>;
  
  setGlobalConstraints: React.Dispatch<React.SetStateAction<GlobalConstraints | null>>;
  setTimetableSettings: React.Dispatch<React.SetStateAction<TimetableSettings | null>>;
}

export const AppContext = createContext<AppContextType | null>(null);

const defaultConstraints: Constraints = {
  pinnedAssignments: [],
  plannedLeaves: [],
  facultyAvailability: [],
  substitutions: [],
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [appInitializationError, setAppInitializationError] = useState<string | null>(null);
  
  const [users, setUsers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [generatedTimetables, setGeneratedTimetables] = useState<GeneratedTimetable[]>([]);
  const [constraints, setConstraints] = useState<Constraints>(defaultConstraints);
  const [facultyAllocations, setFacultyAllocations] = useState<FacultyAllocation[]>([]); // NEW
  const [globalConstraints, setGlobalConstraints] = useState<GlobalConstraints | null>(null);
  const [timetableSettings, setTimetableSettings] = useState<TimetableSettings | null>(null);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  const [currentPage, setCurrentPage] = useState<Page>('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    users: false, subjects: false, faculty: false, rooms: false, batches: false, 
    departments: false, timetables: false, constraints: false, settings: false,
    substitutions: false, facultyAllocations: false,
  });

  const toast = useToast();

  const fetchedRef = useRef({
     users: false, subjects: false, faculty: false, rooms: false, batches: false, 
     departments: false, timetables: false, constraints: false, substitutions: false,
     facultyAllocations: false,
  });

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

  useEffect(() => { loadInitialShell(); }, [loadInitialShell]);
  useEffect(() => { if(timetableSettings) setTimeSlots(generateTimeSlots(timetableSettings)); }, [timetableSettings]);

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
  const fetchFacultyAllocations = createFetcher('facultyAllocations', api.getFacultyAllocations, setFacultyAllocations);
  
  const fetchConstraintsAndSubstitutions = useCallback(async () => {
    // This function fetches the entire constraints object, which includes substitutions.
    const key = 'constraints';
    if (fetchedRef.current[key]) return;
    setLoadingStates(s => ({...s, [key]: true, substitutions: true }));
    try {
        const data = await api.getConstraints();
        setConstraints(data);
        fetchedRef.current.constraints = true;
        fetchedRef.current.substitutions = true; // They are fetched together
    } catch (e: any) {
        toast.error(`Failed to load constraints: ${e.message}`);
    } finally {
        setLoadingStates(s => ({...s, [key]: false, substitutions: false }));
    }
  }, [toast]);
  const fetchConstraints = fetchConstraintsAndSubstitutions;
  const fetchSubstitutions = fetchConstraintsAndSubstitutions;

  const refreshData = useCallback(async () => {
      Object.keys(fetchedRef.current).forEach(key => { (fetchedRef.current as any)[key] = false; });
      toast.info("Refreshing all data...");
      await Promise.all([
          loadInitialShell(), fetchUsers(), fetchSubjects(), fetchFaculty(), fetchRooms(),
          fetchBatches(), fetchDepartments(), fetchTimetables(), fetchConstraints(), fetchFacultyAllocations(),
      ]);
      toast.success("Data refreshed.");
  }, [loadInitialShell, fetchUsers, fetchSubjects, fetchFaculty, fetchRooms, fetchBatches, fetchDepartments, fetchTimetables, fetchConstraints, fetchFacultyAllocations, toast]);

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
    // CRITICAL FIX: Reset the fetched status so the next user can load data.
    Object.keys(fetchedRef.current).forEach(key => {
        (fetchedRef.current as any)[key] = false;
    });
  };
  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
  const toggleSidebarCollapse = () => setIsSidebarCollapsed(prev => !prev);

  const contextValue = useMemo(() => ({
    user, users, isLoading, loadingStates, currentPage, subjects, faculty, rooms, batches, departments,
    generatedTimetables, constraints, facultyAllocations, globalConstraints, timetableSettings, timeSlots, 
    appInitializationError, isSidebarOpen, isSidebarCollapsed, login, logout, setCurrentPage,
    toggleSidebar, toggleSidebarCollapse, refreshData, fetchUsers, fetchSubjects, fetchFaculty,
    fetchRooms, fetchBatches, fetchDepartments, fetchTimetables, fetchConstraints, fetchSubstitutions,
    fetchFacultyAllocations, setGlobalConstraints, setTimetableSettings,
  }), [
      user, users, isLoading, loadingStates, currentPage, subjects, faculty, rooms, batches, departments,
      generatedTimetables, constraints, facultyAllocations, globalConstraints, timetableSettings, timeSlots, appInitializationError, 
      isSidebarOpen, isSidebarCollapsed, refreshData, fetchUsers, fetchSubjects, fetchFaculty, fetchRooms, 
      fetchBatches, fetchDepartments, fetchTimetables, fetchConstraints, fetchSubstitutions, fetchFacultyAllocations
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

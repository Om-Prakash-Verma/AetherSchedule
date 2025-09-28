import { Book, LayoutDashboard, Settings, Sliders, FileText, Calendar, Lock } from 'lucide-react';
import type { NavItem } from './types';

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const NAV_ITEMS: NavItem[] = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'My Timetable', icon: Calendar },
    { name: 'Scheduler', icon: Sliders },
    { name: 'Data Management', icon: Book },
    { name: 'Constraints', icon: Lock },
    { name: 'Reports', icon: FileText },
    { name: 'Settings', icon: Settings },
];

export { ROLES } from './types';
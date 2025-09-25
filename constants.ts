import { Book, LayoutDashboard, Settings, Sliders, FileText, Calendar, Lock } from 'lucide-react';
import type { NavItem } from './types';

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const TIME_SLOTS = [
  '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00',
  '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00'
];

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
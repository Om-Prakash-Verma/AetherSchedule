// FIX: Replaced all JSX syntax with React.createElement calls to make the code valid for a .ts file.
import React from 'react';
import { AlertTriangle, Users as UsersIcon } from 'lucide-react';
import type { Subject, Faculty, Room, Batch, Department, User } from '../../types';

// FIX: Add 'rooms' to the DataMap type to match the data structure and resolve the type error.
type DataMap = {
    subjects: Subject[];
    faculty: Faculty[];
    departments: Department[];
    users: User[];
    batches: Batch[];
    rooms: Room[];
};

type DataType = keyof DataMap;

export const getColumns = (activeTab: DataType, data: DataMap) => {
    const { subjects, faculty, departments, users, batches } = data;

    const columnsMap: Record<DataType, any[]> = {
        subjects: [
            { accessor: 'code', header: 'Code' },
            { 
                accessor: 'name', header: 'Name',
                render: (s: Subject) => (
                    React.createElement('div', { className: "flex items-center gap-2" },
                        React.createElement('span', { key: 'name' }, s.name),
                        !faculty.some(f => f.subjectIds.includes(s.id)) && (
                            React.createElement('div', { key: 'warning', className: "relative group flex items-center" },
                                React.createElement(AlertTriangle, { className: "w-4 h-4 text-yellow-500" }),
                                React.createElement('span', {
                                    className: "absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-xs px-2 py-1 text-xs text-white bg-panel-strong rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-[var(--border)] shadow-lg"
                                }, "Warning: No faculty assigned.")
                            )
                        )
                    )
                )
            },
            { 
                header: 'Taught By', accessor: 'id',
                render: (s: Subject) => faculty.filter(f => f.subjectIds.includes(s.id)).map(f => f.name).join(', ') || React.createElement('span', { className: "text-text-muted" }, "Unassigned")
            },
            { accessor: 'type', header: 'Type' },
            { accessor: 'hoursPerWeek', header: 'Hours/Week' },
        ],
        faculty: [
            { accessor: 'name', header: 'Name' },
            { 
                header: 'Login Account', accessor: 'userId',
                render: (f: Faculty) => {
                    const user = users.find(u => u.id === f.userId);
                    return user 
                        ? React.createElement('div', { className: "flex items-center gap-2" }, 
                            React.createElement(UsersIcon, { size: 14, className: "text-accent" }),
                            React.createElement('span', null, user.email)
                          ) 
                        : React.createElement('span', { className: "text-text-muted" }, "Not Linked");
                }
            },
            { accessor: 'subjectIds', header: 'Subjects', render: (f: Faculty) => (f.subjectIds.map(id => subjects.find(s=>s.id === id)?.code || id).join(', ')) },
        ],
        rooms: [
            { accessor: 'name', header: 'Name' },
            { accessor: 'type', header: 'Type' },
            { accessor: 'capacity', header: 'Capacity' },
        ],
        batches: [
            { accessor: 'name', header: 'Name' },
            { accessor: 'departmentId', header: 'Department', render: (b: Batch) => departments.find(d => d.id === b.departmentId)?.name || 'N/A'},
            { accessor: 'semester', header: 'Semester' },
            { accessor: 'studentCount', header: 'Students' },
        ],
        departments: [
            { accessor: 'code', header: 'Code' },
            { accessor: 'name', header: 'Name' },
        ],
        users: [
            { accessor: 'name', header: 'Name' },
            { accessor: 'email', header: 'Email' },
            { accessor: 'role', header: 'Role' },
            {
                header: 'Association', accessor: 'id',
                render: (u: User) => {
                    if (u.role === 'Student') return `Student of ${batches.find(b => b.id === u.batchId)?.name || 'N/A'}`;
                    if (u.role === 'Faculty') return `Faculty: ${faculty.find(f => f.id === u.facultyId)?.name || 'N/A'}`;
                    if (u.role === 'DepartmentHead') return `HOD of ${departments.find(d => d.id === u.departmentId)?.name || 'N/A'}`;
                    return React.createElement('span', { className: "text-text-muted" }, "-");
                }
            }
        ]
    };
    
    return columnsMap[activeTab];
};

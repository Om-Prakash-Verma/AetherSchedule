import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, X } from 'lucide-react';

interface DataTableProps {
    title: string;
    icon: any;
    data: any[];
    columns: { key: string; label: string; render?: (item: any) => React.ReactNode }[];
    onAdd: () => void;
    onEdit?: (item: any) => void;
    onDelete?: (id: string) => void;
}

const DataTable: React.FC<DataTableProps> = ({ title, icon: Icon, data, columns, onAdd, onEdit, onDelete }) => {
    const [searchTerm, setSearchTerm] = useState('');

    // Filter data based on search term matching any of the column values
    const filteredData = useMemo(() => {
        if (!searchTerm.trim()) return data;

        const lowerTerm = searchTerm.toLowerCase();

        return data.filter(item => {
            // Check if any of the columns defined for this table match the search term
            return columns.some(col => {
                const val = item[col.key];
                if (val === null || val === undefined) return false;
                
                // Handle arrays (like subjects list) or simple primitives
                const stringVal = Array.isArray(val) ? val.join(' ') : String(val);
                return stringVal.toLowerCase().includes(lowerTerm);
            });
        });
    }, [data, searchTerm, columns]);

    return (
        <div className="rounded-2xl border border-glassBorder bg-glass backdrop-blur-md flex flex-col overflow-hidden h-full min-h-[500px] group transition-all duration-300 shadow-xl">
            <div className="p-4 md:p-5 border-b border-glassBorder flex flex-col md:flex-row md:items-center gap-4 bg-slate-900/50">
                {/* Title & Stats */}
                <div className="flex items-center gap-3 min-w-fit justify-between md:justify-start">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Icon size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg leading-tight">{title}</h3>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                                {filteredData.length} {filteredData.length !== data.length ? `found (of ${data.length})` : 'Records'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="flex-1 md:mx-6">
                    <div className="relative group/search">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/search:text-primary transition-colors" />
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={`Search ${title.toLowerCase()}...`}
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2.5 pl-10 pr-10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-slate-500"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5 rounded-full hover:bg-slate-700 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
                
                <button 
                    onClick={onAdd}
                    className="md:ml-auto w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-indigo-500 text-white shadow-lg shadow-primary/20 transition-all active:scale-95 font-medium text-sm whitespace-nowrap"
                    title={`Add ${title}`}
                >
                    <Plus size={18} />
                    <span>Add New</span>
                </button>
            </div>
            <div className="overflow-auto flex-1 p-0 custom-scrollbar">
                <table className="w-full text-sm text-left text-slate-400 min-w-[600px]">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-900/30 sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            {columns.map((col: any) => (
                                <th key={col.key} className="px-6 py-4 font-semibold tracking-wider">{col.label}</th>
                            ))}
                            {(onEdit || onDelete) && <th className="px-6 py-4 w-28 text-right">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-glassBorder">
                        {filteredData.length > 0 ? (
                            filteredData.map((item: any) => (
                                <tr key={item.id} className="hover:bg-white/5 transition-colors group/row">
                                    {columns.map((col: any) => (
                                        <td key={col.key} className="px-6 py-4 whitespace-nowrap">
                                            {col.render ? col.render(item) : item[col.key]}
                                        </td>
                                    ))}
                                    {(onEdit || onDelete) && (
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 transition-opacity">
                                                {onEdit && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            onEdit(item);
                                                        }}
                                                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                        title="Edit"
                                                        type="button"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            onDelete(item.id);
                                                        }}
                                                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                        title="Delete"
                                                        type="button"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        ) : (
                             <tr>
                                <td colSpan={columns.length + ((onEdit || onDelete) ? 1 : 0)} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-500">
                                        <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                                            {searchTerm ? <Search size={32} className="opacity-50" /> : <Icon size={32} className="opacity-50" />}
                                        </div>
                                        <p className="text-base font-medium">
                                            {searchTerm ? `No results for "${searchTerm}"` : 'No records found'}
                                        </p>
                                        <p className="text-sm opacity-60 mt-1">
                                            {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating a new entry.'}
                                        </p>
                                    </div>
                                </td>
                             </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DataTable;
import React from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';

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
    return (
        <div className="rounded-2xl border border-glassBorder bg-glass backdrop-blur-md flex flex-col overflow-hidden h-full min-h-[500px] group transition-all duration-300 shadow-xl">
            <div className="p-5 border-b border-glassBorder flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-900/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Icon size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg">{title}</h3>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{data.length} Records</p>
                    </div>
                </div>
                
                <button 
                    onClick={onAdd}
                    className="sm:ml-auto w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-indigo-500 text-white shadow-lg shadow-primary/20 transition-all active:scale-95 font-medium text-sm"
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
                        {data.length > 0 ? (
                            data.map((item: any) => (
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
                                            <Icon size={32} className="opacity-50" />
                                        </div>
                                        <p className="text-base font-medium">No records found</p>
                                        <p className="text-sm opacity-60 mt-1">Get started by creating a new entry.</p>
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
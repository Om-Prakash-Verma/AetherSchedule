import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { GlassButton } from './GlassButton';

interface DataTableProps<T extends { id: string }> {
  columns: {
    header: string;
    accessor: keyof T;
    render?: (item: T) => React.ReactNode;
  }[];
  data: T[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
}

export function DataTable<T extends { id: string }>({ columns, data, onEdit, onDelete }: DataTableProps<T>) {
  if (!data || data.length === 0) {
    return <div className="text-center py-10 text-text-muted">No data available.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-text-muted uppercase border-b border-[var(--border)]">
          <tr>
            {columns.map(col => <th key={String(col.accessor)} className="px-6 py-3">{col.header}</th>)}
            {(onEdit || onDelete) && <th className="px-6 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr key={item.id} className="border-b border-[var(--border)] hover:bg-white/10">
              {columns.map(col => (
                <td key={String(col.accessor)} className="px-6 py-4 text-white">
                  {col.render ? col.render(item) : String(item[col.accessor] ?? '')}
                </td>
              ))}
              {(onEdit || onDelete) && (
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end items-center gap-2">
                    {onEdit && <GlassButton variant="secondary" title="Edit item" onClick={() => onEdit(item)} className="p-2"><Pencil size={14} /></GlassButton>}
                    {onDelete && <GlassButton variant="secondary" title="Delete item" onClick={() => onDelete(item)} className="p-2 hover:bg-red-500/20 hover:text-red-400"><Trash2 size={14} /></GlassButton>}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
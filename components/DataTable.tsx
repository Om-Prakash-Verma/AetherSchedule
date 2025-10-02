import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { GlassButton } from './GlassButton';
import { Skeleton } from './ui/Skeleton';

interface DataTableProps<T extends { id: string }> {
  columns: {
    header: string;
    accessor: keyof T;
    render?: (item: T) => React.ReactNode;
  }[];
  data: T[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  isLoading?: boolean;
}

function DataTableInner<T extends { id: string }>({ columns, data, onEdit, onDelete, isLoading }: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-[var(--text-muted)] uppercase border-b border-[var(--border)]">
            <tr>
              {columns.map(col => <th key={String(col.accessor)} className="px-6 py-3">{col.header}</th>)}
              {(onEdit || onDelete) && <th className="px-6 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-[var(--border)]">
                {columns.map((col, colIndex) => (
                  <td key={colIndex} className="px-6 py-4">
                    <Skeleton className="h-4 w-full rounded-md" />
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className="px-6 py-4">
                    <div className="flex justify-end items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <Skeleton className="h-8 w-8 rounded-lg" />
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

  if (!data || data.length === 0) {
    return <div className="text-center py-10 text-[var(--text-muted)]">No data available.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-[var(--text-muted)] uppercase border-b border-[var(--border)]">
          <tr>
            {columns.map(col => <th key={String(col.accessor)} className="px-6 py-3">{col.header}</th>)}
            {(onEdit || onDelete) && <th className="px-6 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr key={item.id} className="border-b border-[var(--border)] hover:bg-panel-strong">
              {columns.map(col => (
                <td key={String(col.accessor)} className="px-6 py-4 text-[var(--text-white)]">
                  {col.render ? col.render(item) : String(item[col.accessor] ?? '')}
                </td>
              ))}
              {(onEdit || onDelete) && (
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end items-center gap-2">
                    {onEdit && <GlassButton variant="secondary" title="Edit item" onClick={() => onEdit(item)} className="p-2"><Pencil size={14} /></GlassButton>}
                    {onDelete && <GlassButton variant="secondary" title="Delete item" onClick={() => onDelete(item)} className="p-2 hover:bg-[hsl(var(--red-hsl)_/_0.2)] hover:text-[var(--red-400)]"><Trash2 size={14} /></GlassButton>}
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

export const DataTable = React.memo(DataTableInner) as typeof DataTableInner;
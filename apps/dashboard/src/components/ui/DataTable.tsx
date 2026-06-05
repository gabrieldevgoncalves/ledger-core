'use client';

import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({ columns, rows, onRowClick }: DataTableProps<T>) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  background: 'var(--surface-secondary)',
                  borderBottom: '0.5px solid var(--border)',
                  padding: '8px 16px',
                  textAlign: col.align ?? 'left',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              style={{
                cursor: onRowClick ? 'pointer' : 'default',
                borderBottom: i < rows.length - 1 ? '0.5px solid var(--border)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (onRowClick) {
                  (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-hover)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
              }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: '10px 16px',
                    textAlign: col.align ?? 'left',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    verticalAlign: 'middle',
                  }}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { accounts, type Account, type AccountType } from '@/lib/mock-data';
import { formatUSD, formatCurrency, formatDate } from '@/lib/formatters';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Card } from '@/components/ui/card';

type FilterType = AccountType | 'ALL';
const filterOptions: FilterType[] = ['ALL', 'ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE', 'EQUITY'];

export default function AccountsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('ALL');

  const rows = filter === 'ALL' ? accounts : accounts.filter((a) => a.type === filter);

  const columns: Column<Account>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (a) => (
        <div>
          <div style={{ fontWeight: 500 }}>{a.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginTop: 2 }}>
            {a.id}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (a) => <Badge variant={a.type.toLowerCase() as BadgeVariant}>{a.type}</Badge>,
    },
    {
      key: 'currency',
      header: 'Currency',
      render: (a) => (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
          {a.currency}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      render: (a) => (
        <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(a.balance_cents, a.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (a) => (
        <span style={{
          fontSize: 11,
          color: a.is_active ? '#1b5e20' : 'var(--text-tertiary)',
          fontWeight: 500,
        }}>
          {a.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      render: (a) => (
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {formatDate(a.created_at)}
        </span>
      ),
    },
  ];

  void formatUSD;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Accounts</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {filterOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: '4px 10px',
                borderRadius: 5,
                border: '0.5px solid var(--border-strong)',
                background: filter === opt ? 'var(--surface-secondary)' : 'transparent',
                color: filter === opt ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {opt === 'ALL' ? 'All' : opt.charAt(0) + opt.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={(a) => router.push(`/accounts/${a.id}`)}
        />
      </Card>
    </div>
  );
}

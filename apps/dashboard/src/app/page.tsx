import Link from 'next/link';
import { accounts, journals, reconciliationRuns } from '@/lib/mock-data';
import { formatUSD, formatRelative } from '@/lib/formatters';
import { MetricCard } from '@/components/ui/MetricCard';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { BalanceChart } from '@/components/charts/BalanceChart';

const totalAssets = accounts
  .filter((a) => a.type === 'ASSET' && a.currency === 'USD')
  .reduce((sum, a) => sum + a.balance_cents, 0);

const recentJournals = [...journals].sort(
  (a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
);

const lastRecon = reconciliationRuns[0];

const topAccounts = [...accounts]
  .filter((a) => a.currency === 'USD')
  .sort((a, b) => b.balance_cents - a.balance_cents)
  .slice(0, 5);

function typeVariant(t: string): BadgeVariant {
  return t.toLowerCase() as BadgeVariant;
}

export default function OverviewPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <MetricCard
          label="Total Assets"
          value={formatUSD(totalAssets)}
          delta="+12.4%"
          deltaType="up"
        />
        <MetricCard
          label="Journals Today"
          value={String(journals.length)}
          delta="last 24h"
          deltaType="neutral"
        />
        <MetricCard
          label="Last Reconciliation"
          value={lastRecon.status}
          delta={formatRelative(lastRecon.run_at)}
          deltaType={lastRecon.status === 'PASS' ? 'up' : 'down'}
        />
        <MetricCard
          label="Outbox Lag"
          value="0"
          delta="pending events"
          deltaType="neutral"
        />
      </div>

      <Card>
        <CardHeader title="Cash Operating — Balance History" />
        <div style={{ padding: '16px 16px 12px' }}>
          <BalanceChart accountName="Cash Operating" currency="USD" seedBalance={112500000} />
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Card>
          <CardHeader title="Accounts" action="+ New account" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Type', 'Balance'].map((h, i) => (
                  <th key={h} style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    background: 'var(--surface-secondary)',
                    borderBottom: '0.5px solid var(--border)',
                    padding: '8px 16px',
                    textAlign: i === 2 ? 'right' : 'left',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topAccounts.map((a, i) => (
                <tr key={a.id} style={{ borderBottom: i < topAccounts.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>{a.name}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge variant={typeVariant(a.type)}>{a.type}</Badge>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                    {formatUSD(a.balance_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader
            title="Recent journals"
            action={
              <Link href="/journals" style={{ color: 'var(--brand)', textDecoration: 'none', fontSize: 11 }}>
                View all
              </Link>
            }
          />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Description', 'Status', 'Entries'].map((h, i) => (
                  <th key={h} style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    background: 'var(--surface-secondary)',
                    borderBottom: '0.5px solid var(--border)',
                    padding: '8px 16px',
                    textAlign: i === 2 ? 'right' : 'left',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentJournals.slice(0, 5).map((j, i) => (
                <tr key={j.id} style={{ borderBottom: i < 4 ? '0.5px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{j.description}</div>
                    {j.reference && (
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{j.reference}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge variant={j.status.toLowerCase() as BadgeVariant}>{j.status}</Badge>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: 13 }}>
                    {j.entry_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

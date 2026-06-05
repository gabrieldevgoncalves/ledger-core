import Link from 'next/link';
import { notFound } from 'next/navigation';
import { accounts, cashOperatingEntries } from '@/lib/mock-data';
import { formatUSD, formatCurrency, formatRelative } from '@/lib/formatters';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { BalanceChart } from '@/components/charts/BalanceChart';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AccountPage({ params }: Props) {
  const { id } = await params;
  const account = accounts.find((a) => a.id === id);
  if (!account) notFound();

  const entries = account.id === '01ACCT00000000000000000001' ? cashOperatingEntries : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
        <Link href="/accounts" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
          Accounts
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>{account.name}</span>
      </div>

      <Card>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              {account.name}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge variant={account.type.toLowerCase() as BadgeVariant}>{account.type}</Badge>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                {account.currency}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                {account.id}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
              {formatCurrency(account.balance_cents, account.currency)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>current balance</div>
          </div>
        </div>
        <div style={{ borderTop: '0.5px solid var(--border)', padding: '16px 20px 14px' }}>
          <BalanceChart accountName={account.name} currency={account.currency} seedBalance={account.balance_cents} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Entry History" />
        {entries.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            No entries for this account
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Journal', 'Direction', 'Currency', 'Amount', 'Running Balance', 'Date'].map((h, i) => (
                  <th key={h} style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    background: 'var(--surface-secondary)',
                    borderBottom: '0.5px solid var(--border)',
                    padding: '8px 16px',
                    textAlign: i >= 3 ? 'right' : 'left',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: i < entries.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{e.journal_description}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'monospace' }}>
                      {e.journal_id.slice(0, 12)}…
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: e.direction === 'DEBIT' ? 'var(--badge-posted-fg)' : 'var(--badge-fail-fg)',
                    }}>
                      {e.direction === 'DEBIT' ? '↑ DEBIT' : '↓ CREDIT'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    {e.currency}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                    {e.direction === 'DEBIT'
                      ? `+${formatUSD(e.amount_cents)}`
                      : <span style={{ color: 'var(--text-secondary)' }}>−{formatUSD(e.amount_cents)}</span>
                    }
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                    {formatUSD(e.running_balance_cents)}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {formatRelative(e.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

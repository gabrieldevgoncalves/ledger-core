import Link from 'next/link';
import { notFound } from 'next/navigation';
import { journals, cashOperatingEntries } from '@/lib/mock-data';
import { formatRelative, formatDate, formatUSD } from '@/lib/formatters';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function JournalPage({ params }: Props) {
  const { id } = await params;
  const journal = journals.find((j) => j.id === id);
  if (!journal) notFound();

  const entries = cashOperatingEntries.filter((e) => e.journal_id === id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
        <Link href="/journals" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Journals</Link>
        <span>/</span>
        <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{id.slice(0, 12)}…</span>
      </div>

      <Card>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{journal.description}</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {journal.reference && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reference</div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace' }}>{journal.reference}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Posted</div>
                <div style={{ fontSize: 12 }}>{formatDate(journal.posted_at)} · {formatRelative(journal.posted_at)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Currencies</div>
                <div style={{ fontSize: 12 }}>{journal.currencies.join(', ')}</div>
              </div>
            </div>
          </div>
          <Badge variant={journal.status.toLowerCase() as BadgeVariant}>{journal.status}</Badge>
        </div>
      </Card>

      <Card>
        <CardHeader title={entries.length > 0 ? `Entries (${entries.length} shown of ${journal.entry_count})` : `Entries (${journal.entry_count})`} />
        {entries.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            Entries available in full API view
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Account', 'Direction', 'Amount', 'Currency'].map((h, i) => (
                  <th key={h} style={{
                    fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)',
                    background: 'var(--surface-secondary)', borderBottom: '0.5px solid var(--border)',
                    padding: '8px 16px', textAlign: i >= 2 ? 'right' : 'left',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: i < entries.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
                    {e.journal_id.slice(0, 10)}…
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 500,
                      color: e.direction === 'DEBIT' ? 'var(--badge-posted-fg)' : 'var(--badge-fail-fg)',
                    }}>
                      {e.direction}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                    {formatUSD(e.amount_cents)}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    {e.currency}
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

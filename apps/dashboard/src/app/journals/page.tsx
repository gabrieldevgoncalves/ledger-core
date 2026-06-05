import { journals } from '@/lib/mock-data';
import { formatRelative } from '@/lib/formatters';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const sorted = [...journals].sort(
  (a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
);

const reversedCount = journals.filter((j) => j.status === 'REVERSED').length;
const lastPosted = sorted[0];

export default function JournalsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Journals</h1>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {journals.length} total · {reversedCount} reversed · last posted {formatRelative(lastPosted.posted_at)}
        </span>
      </div>

      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {[
                { label: 'ID',          align: 'left'  },
                { label: 'Description', align: 'left'  },
                { label: 'Status',      align: 'left'  },
                { label: 'Entries',     align: 'right' },
                { label: 'Currencies',  align: 'left'  },
                { label: 'Posted',      align: 'right' },
              ].map(({ label, align }) => (
                <th key={label} style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  background: 'var(--surface-secondary)',
                  borderBottom: '0.5px solid var(--border)',
                  padding: '8px 16px',
                  textAlign: align as 'left' | 'right',
                  whiteSpace: 'nowrap',
                }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((j, i) => (
              <tr key={j.id} style={{ borderBottom: i < sorted.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {j.id.slice(0, 8)}
                </td>
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
                <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-secondary)' }}>
                  {j.currencies.join(', ')}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {formatRelative(j.posted_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

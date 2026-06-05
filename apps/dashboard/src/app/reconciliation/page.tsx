import { reconciliationRuns } from '@/lib/mock-data';
import { formatUSD, formatRelative } from '@/lib/formatters';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';

const lastRun = reconciliationRuns[0];
const failCount = reconciliationRuns.filter((r) => r.status === 'FAIL').length;

export default function ReconciliationPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Reconciliation</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <div style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 12,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Last Run Status</span>
          <Badge variant={lastRun.status.toLowerCase() as BadgeVariant}>{lastRun.status}</Badge>
        </div>
        <div style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 12,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Total Runs</span>
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>{reconciliationRuns.length}</span>
        </div>
        <div style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 12,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Failure Rate</span>
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px', color: failCount > 0 ? 'var(--badge-fail-fg)' : 'var(--text-primary)' }}>
            {failCount} / {reconciliationRuns.length}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Run History"
          action={
            <button style={{
              fontSize: 12,
              padding: '4px 10px',
              border: '0.5px solid var(--border-strong)',
              borderRadius: 5,
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}>
              Run reconciliation now
            </button>
          }
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {reconciliationRuns.map((r, i) => {
            const isFail = r.status === 'FAIL';
            return (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderBottom: i < reconciliationRuns.length - 1 ? '0.5px solid var(--border)' : 'none',
                  borderLeft: isFail ? '2px solid var(--badge-fail-fg)' : '2px solid transparent',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    Daily reconciliation
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {formatRelative(r.run_at)} · {r.duration_ms}ms
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Debits {formatUSD(r.total_debits_cents)} · Credits {formatUSD(r.total_credits_cents)}
                  </span>
                  {r.discrepancy_cents !== 0 && (
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--badge-fail-fg)', fontVariantNumeric: 'tabular-nums' }}>
                      Δ {formatUSD(Math.abs(r.discrepancy_cents))}
                    </span>
                  )}
                  <Badge variant={r.status.toLowerCase() as BadgeVariant}>{r.status}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

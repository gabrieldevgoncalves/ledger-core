import React from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaType?: 'up' | 'down' | 'neutral';
}

const deltaColors = {
  up:      { bg: '#e8f5e9', fg: '#1b5e20' },
  down:    { bg: '#ffebee', fg: '#b71c1c' },
  neutral: { bg: 'var(--surface-secondary)', fg: 'var(--text-secondary)' },
};

export function MetricCard({ label, value, delta, deltaType = 'neutral' }: MetricCardProps) {
  const dc = deltaColors[deltaType];
  return (
    <div style={{
      background: 'var(--surface)',
      border: '0.5px solid var(--border)',
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
        {label}
      </span>
      <span style={{
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: '-0.5px',
        color: 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}>
        {value}
      </span>
      {delta && (
        <span style={{
          display: 'inline-flex',
          alignSelf: 'flex-start',
          fontSize: 11,
          fontWeight: 500,
          padding: '2px 6px',
          borderRadius: 4,
          background: dc.bg,
          color: dc.fg,
        }}>
          {delta}
        </span>
      )}
    </div>
  );
}

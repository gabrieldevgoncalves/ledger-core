'use client';

import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatUSD } from '@/lib/formatters';

interface DataPoint {
  date: string;
  balance: number;
}

interface Props {
  accountName: string;
  currency: string;
  seedBalance?: number;
}

type Range = 7 | 30 | 90;

function seededRand(n: number): number {
  const x = Math.sin(n + 1) * 10000;
  return x - Math.floor(x);
}

function generateSeries(days: Range, seedBalance: number): DataPoint[] {
  const result: DataPoint[] = [];
  const today = new Date('2026-06-05T00:00:00Z');
  const swingPct = 0.12;
  const amplitude = seedBalance * swingPct;

  for (let i = days; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const label = d.toISOString().slice(0, 10);
    const t = (days - i) / days;
    const wave1 = Math.sin(t * Math.PI * 2.5) * amplitude * 0.5;
    const wave2 = Math.sin(t * Math.PI * 6.3 + 1.2) * amplitude * 0.3;
    const noise = (seededRand(i * 31 + days) - 0.5) * amplitude * 0.4;
    const trend = t * amplitude * 0.6;
    const balance = Math.round(Math.max(seedBalance * 0.7, seedBalance * 0.88 + wave1 + wave2 + noise + trend));
    result.push({ date: label, balance });
  }
  return result;
}

const tickUSD = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(v / 100);

interface TooltipPayload {
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface)',
      border: '0.5px solid var(--border-strong)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 3 }}>
        {label ? new Date(label + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
      </div>
      <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
        {formatUSD(payload[0].value)}
      </div>
    </div>
  );
}

export function BalanceChart({ accountName: _, currency: __, seedBalance = 112500000 }: Props) {
  const [range, setRange] = useState<Range>(30);
  const data = generateSeries(range, seedBalance);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 12 }}>
        {([7, 30, 90] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: '3px 9px',
              borderRadius: 5,
              border: '0.5px solid var(--border-strong)',
              background: range === r ? 'var(--surface-secondary)' : 'transparent',
              color: range === r ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {r}d
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#0A85C2" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#0A85C2" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(d: string) =>
              new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={tickUSD}
            width={64}
            domain={(['auto', 'auto'] as [string, string])}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#0A85C2"
            strokeWidth={1.5}
            fill="url(#balGrad)"
            dot={false}
            activeDot={{ r: 3, fill: '#0A85C2', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

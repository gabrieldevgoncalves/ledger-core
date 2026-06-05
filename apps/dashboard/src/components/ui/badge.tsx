import React from 'react';

export type BadgeVariant =
  | 'asset' | 'liability' | 'revenue' | 'expense' | 'equity'
  | 'posted' | 'reversed' | 'pass' | 'fail';

const statusVariants: BadgeVariant[] = ['posted', 'reversed', 'pass', 'fail'];

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  const isStatus = statusVariants.includes(variant);
  const bg = `var(--badge-${variant}-bg)`;
  const fg = `var(--badge-${variant}-fg)`;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: isStatus ? 5 : 0,
      background: bg,
      color: fg,
      fontSize: 11,
      fontWeight: 500,
      padding: '2px 7px',
      borderRadius: 4,
      whiteSpace: 'nowrap',
    }}>
      {isStatus && (
        <span style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: fg,
          flexShrink: 0,
        }} />
      )}
      {children}
    </span>
  );
}

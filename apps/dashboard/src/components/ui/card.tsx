import React from 'react';

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Card({ children, style }: CardProps) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '0.5px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, action }: CardHeaderProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: '0.5px solid var(--border)',
    }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
        {title}
      </span>
      {action && (
        <span style={{ fontSize: 11, color: 'var(--brand)' }}>
          {action}
        </span>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/',              label: 'Overview' },
  { href: '/accounts',      label: 'Accounts' },
  { href: '/journals',      label: 'Journals' },
  { href: '/reconciliation',label: 'Reconciliation' },
  { href: '/fx-rates',      label: 'FX Rates' },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      background: 'var(--surface)',
      border: '0.5px solid var(--border)',
      borderRadius: 12,
      marginBottom: 16,
      height: 44,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px',
        height: '100%',
        borderRight: '0.5px solid var(--border)',
        fontWeight: 600,
        fontSize: 13,
        color: 'var(--text-primary)',
        flexShrink: 0,
      }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--brand)',
          display: 'inline-block',
        }} />
        ledger-core
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px', flex: 1 }}>
        {links.map(({ href, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                padding: '5px 10px',
                borderRadius: 6,
                background: active ? 'var(--surface-secondary)' : 'transparent',
                textDecoration: 'none',
                transition: 'background 0.1s, color 0.1s',
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        height: '100%',
        borderLeft: '0.5px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'var(--brand)',
          color: '#fff',
          fontSize: 10,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          letterSpacing: 0.5,
        }}>
          GG
        </div>
      </div>
    </nav>
  );
}

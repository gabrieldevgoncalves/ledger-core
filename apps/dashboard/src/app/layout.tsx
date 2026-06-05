import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { TopNav } from '@/components/layout/TopNav';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Ledger Core',
  description: 'Double-entry accounting ledger dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px' }}>
          <TopNav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}

export type AccountType = 'ASSET' | 'LIABILITY' | 'REVENUE' | 'EXPENSE' | 'EQUITY';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  balance_cents: number;
  is_active: boolean;
  created_at: string;
}

export interface Journal {
  id: string;
  description: string;
  reference: string | null;
  status: 'POSTED' | 'REVERSED';
  entry_count: number;
  currencies: string[];
  posted_at: string;
}

export interface Entry {
  id: string;
  journal_id: string;
  journal_description: string;
  direction: 'DEBIT' | 'CREDIT';
  amount_cents: number;
  currency: string;
  running_balance_cents: number;
  created_at: string;
}

export interface ReconciliationRun {
  id: string;
  status: 'PASS' | 'FAIL';
  total_debits_cents: number;
  total_credits_cents: number;
  discrepancy_cents: number;
  run_at: string;
  duration_ms: number;
}

export const accounts: Account[] = [
  { id: '01ACCT00000000000000000001', name: 'Cash Operating',       type: 'ASSET',     currency: 'USD', balance_cents: 112500000, is_active: true,  created_at: '2026-01-01T00:00:00Z' },
  { id: '01ACCT00000000000000000002', name: 'Cash Reserve',         type: 'ASSET',     currency: 'USD', balance_cents:  20000000, is_active: true,  created_at: '2026-01-01T00:00:00Z' },
  { id: '01ACCT00000000000000000003', name: 'Accounts Receivable',  type: 'ASSET',     currency: 'USD', balance_cents:    550000, is_active: true,  created_at: '2026-01-15T00:00:00Z' },
  { id: '01ACCT00000000000000000004', name: 'Customer Deposits',    type: 'LIABILITY', currency: 'USD', balance_cents:   7500000, is_active: true,  created_at: '2026-01-01T00:00:00Z' },
  { id: '01ACCT00000000000000000005', name: 'Fees Payable',         type: 'LIABILITY', currency: 'USD', balance_cents:    120000, is_active: true,  created_at: '2026-02-01T00:00:00Z' },
  { id: '01ACCT00000000000000000006', name: 'Transaction Fees',     type: 'REVENUE',   currency: 'USD', balance_cents:    840000, is_active: true,  created_at: '2026-01-01T00:00:00Z' },
  { id: '01ACCT00000000000000000007', name: 'FX Revenue',           type: 'REVENUE',   currency: 'USD', balance_cents:    210000, is_active: true,  created_at: '2026-01-01T00:00:00Z' },
  { id: '01ACCT00000000000000000008', name: 'Processing Costs',     type: 'EXPENSE',   currency: 'USD', balance_cents:    320000, is_active: true,  created_at: '2026-01-01T00:00:00Z' },
  { id: '01ACCT00000000000000000009', name: 'FX Expense',           type: 'EXPENSE',   currency: 'USD', balance_cents:     80000, is_active: true,  created_at: '2026-01-01T00:00:00Z' },
  { id: '01ACCT00000000000000000010', name: 'Owner Capital',        type: 'EQUITY',    currency: 'USD', balance_cents: 100000000, is_active: true,  created_at: '2026-01-01T00:00:00Z' },
  { id: '01ACCT00000000000000000011', name: 'Caixa BRL',            type: 'ASSET',     currency: 'BRL', balance_cents:   5120000, is_active: true,  created_at: '2026-02-15T00:00:00Z' },
  { id: '01ACCT00000000000000000012', name: 'Depósitos BRL',        type: 'LIABILITY', currency: 'BRL', balance_cents:   1280000, is_active: false, created_at: '2026-02-15T00:00:00Z' },
];

export const journals: Journal[] = [
  { id: '01JRNL00000000000000000001', description: 'Initial capital contribution',       reference: 'WIRE-2026-001',  status: 'POSTED',   entry_count: 2, currencies: ['USD'],        posted_at: '2026-01-02T09:00:00Z' },
  { id: '01JRNL00000000000000000002', description: 'Customer deposit — wire transfer',   reference: 'DEP-0042',       status: 'POSTED',   entry_count: 2, currencies: ['USD'],        posted_at: '2026-01-10T11:30:00Z' },
  { id: '01JRNL00000000000000000003', description: 'Reserve fund transfer',              reference: 'INT-XFER-001',   status: 'POSTED',   entry_count: 2, currencies: ['USD'],        posted_at: '2026-01-15T14:00:00Z' },
  { id: '01JRNL00000000000000000004', description: 'Fee collection Q1',                 reference: 'FEE-Q1-2026',    status: 'REVERSED', entry_count: 2, currencies: ['USD'],        posted_at: '2026-02-01T08:00:00Z' },
  { id: '01JRNL00000000000000000005', description: 'USD→BRL FX conversion',             reference: 'FX-20260210',    status: 'POSTED',   entry_count: 4, currencies: ['USD', 'BRL'], posted_at: '2026-02-10T10:00:00Z' },
  { id: '01JRNL00000000000000000006', description: 'Processing cost settlement',         reference: 'PROC-FEB-2026',  status: 'POSTED',   entry_count: 2, currencies: ['USD'],        posted_at: '2026-02-28T17:00:00Z' },
  { id: '01JRNL00000000000000000007', description: 'Customer deposit — ACH batch',       reference: 'ACH-BATCH-007',  status: 'POSTED',   entry_count: 2, currencies: ['USD'],        posted_at: '2026-03-05T09:15:00Z' },
  { id: '01JRNL00000000000000000008', description: 'FX revenue recognition Mar',         reference: 'FX-REV-MAR',     status: 'POSTED',   entry_count: 2, currencies: ['USD'],        posted_at: '2026-03-31T23:59:00Z' },
  { id: '01JRNL00000000000000000009', description: 'Fee collection Q2',                 reference: 'FEE-Q2-2026',    status: 'POSTED',   entry_count: 2, currencies: ['USD'],        posted_at: '2026-04-01T08:00:00Z' },
  { id: '01JRNL00000000000000000010', description: 'Reversal of fee collection Q1',     reference: 'REV-FEE-Q1',     status: 'POSTED',   entry_count: 2, currencies: ['USD'],        posted_at: '2026-04-02T08:30:00Z' },
  { id: '01JRNL00000000000000000011', description: 'Reserve top-up',                    reference: 'INT-XFER-002',   status: 'POSTED',   entry_count: 2, currencies: ['USD'],        posted_at: '2026-04-15T10:00:00Z' },
  { id: '01JRNL00000000000000000012', description: 'Accounts receivable settlement',    reference: 'AR-SETTLE-012',  status: 'POSTED',   entry_count: 2, currencies: ['USD'],        posted_at: '2026-05-01T14:00:00Z' },
  { id: '01JRNL00000000000000000013', description: 'BRL deposit — Pix transfer',        reference: 'PIX-20260510',   status: 'POSTED',   entry_count: 2, currencies: ['BRL'],        posted_at: '2026-05-10T11:00:00Z' },
  { id: '01JRNL00000000000000000014', description: 'Processing cost settlement May',    reference: 'PROC-MAY-2026',  status: 'POSTED',   entry_count: 2, currencies: ['USD'],        posted_at: '2026-05-31T17:30:00Z' },
  { id: '01JRNL00000000000000000015', description: 'Customer deposit — SWIFT',          reference: 'SWIFT-20260603', status: 'POSTED',   entry_count: 2, currencies: ['USD'],        posted_at: '2026-06-03T09:00:00Z' },
];

export const cashOperatingEntries: Entry[] = [
  { id: '01ENTR00000000000000000001', journal_id: '01JRNL00000000000000000001', journal_description: 'Initial capital contribution',     direction: 'DEBIT',  amount_cents: 100000000, currency: 'USD', running_balance_cents: 100000000, created_at: '2026-01-02T09:00:00Z' },
  { id: '01ENTR00000000000000000002', journal_id: '01JRNL00000000000000000002', journal_description: 'Customer deposit — wire transfer', direction: 'DEBIT',  amount_cents:   5000000, currency: 'USD', running_balance_cents: 105000000, created_at: '2026-01-10T11:30:00Z' },
  { id: '01ENTR00000000000000000003', journal_id: '01JRNL00000000000000000003', journal_description: 'Reserve fund transfer',            direction: 'CREDIT', amount_cents:  20000000, currency: 'USD', running_balance_cents:  85000000, created_at: '2026-01-15T14:00:00Z' },
  { id: '01ENTR00000000000000000004', journal_id: '01JRNL00000000000000000005', journal_description: 'USD→BRL FX conversion',           direction: 'CREDIT', amount_cents:   2000000, currency: 'USD', running_balance_cents:  83000000, created_at: '2026-02-10T10:00:00Z' },
  { id: '01ENTR00000000000000000005', journal_id: '01JRNL00000000000000000006', journal_description: 'Processing cost settlement',       direction: 'CREDIT', amount_cents:    200000, currency: 'USD', running_balance_cents:  82800000, created_at: '2026-02-28T17:00:00Z' },
  { id: '01ENTR00000000000000000006', journal_id: '01JRNL00000000000000000007', journal_description: 'Customer deposit — ACH batch',     direction: 'DEBIT',  amount_cents:  15000000, currency: 'USD', running_balance_cents:  97800000, created_at: '2026-03-05T09:15:00Z' },
  { id: '01ENTR00000000000000000007', journal_id: '01JRNL00000000000000000011', journal_description: 'Reserve top-up',                  direction: 'CREDIT', amount_cents:   5000000, currency: 'USD', running_balance_cents:  92800000, created_at: '2026-04-15T10:00:00Z' },
  { id: '01ENTR00000000000000000008', journal_id: '01JRNL00000000000000000012', journal_description: 'Accounts receivable settlement',  direction: 'DEBIT',  amount_cents:   4200000, currency: 'USD', running_balance_cents:  97000000, created_at: '2026-05-01T14:00:00Z' },
  { id: '01ENTR00000000000000000009', journal_id: '01JRNL00000000000000000014', journal_description: 'Processing cost settlement May',  direction: 'CREDIT', amount_cents:    120000, currency: 'USD', running_balance_cents:  96880000, created_at: '2026-05-31T17:30:00Z' },
  { id: '01ENTR00000000000000000010', journal_id: '01JRNL00000000000000000015', journal_description: 'Customer deposit — SWIFT',        direction: 'DEBIT',  amount_cents:  15620000, currency: 'USD', running_balance_cents: 112500000, created_at: '2026-06-03T09:00:00Z' },
];

const now = new Date('2026-06-05T08:00:00Z');
function daysAgo(d: number): string {
  const t = new Date(now.getTime() - d * 86400000);
  t.setUTCHours(0, 1, 0, 0);
  return t.toISOString();
}

export const reconciliationRuns: ReconciliationRun[] = [
  { id: '01RECON0000000000000000001', status: 'PASS', total_debits_cents: 139820000, total_credits_cents: 139820000, discrepancy_cents:  0, run_at: daysAgo(0), duration_ms: 142 },
  { id: '01RECON0000000000000000002', status: 'PASS', total_debits_cents: 124200000, total_credits_cents: 124200000, discrepancy_cents:  0, run_at: daysAgo(1), duration_ms: 131 },
  { id: '01RECON0000000000000000003', status: 'FAIL', total_debits_cents: 124200000, total_credits_cents: 124200001, discrepancy_cents: -1, run_at: daysAgo(2), duration_ms: 198 },
  { id: '01RECON0000000000000000004', status: 'PASS', total_debits_cents: 108580000, total_credits_cents: 108580000, discrepancy_cents:  0, run_at: daysAgo(3), duration_ms: 127 },
  { id: '01RECON0000000000000000005', status: 'PASS', total_debits_cents:  93460000, total_credits_cents:  93460000, discrepancy_cents:  0, run_at: daysAgo(4), duration_ms: 118 },
  { id: '01RECON0000000000000000006', status: 'PASS', total_debits_cents:  78340000, total_credits_cents:  78340000, discrepancy_cents:  0, run_at: daysAgo(5), duration_ms: 109 },
];

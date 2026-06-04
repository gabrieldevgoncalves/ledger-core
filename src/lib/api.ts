async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  description: string | null;
  is_active: boolean;
  balance_minor_units: number;
  created_at: string;
}

export interface Entry {
  id: string;
  journal_id: string;
  direction: string;
  amount: number;
  currency: string;
  created_at: string;
}

export interface JournalListItem {
  id: string;
  description: string | null;
  reference: string | null;
  status: string;
  entry_count: number;
  posted_at: string;
}

export interface JournalEntry {
  id: string;
  account_id: string;
  direction: string;
  amount: number;
  currency: string;
}

export interface JournalDetail {
  id: string;
  description: string | null;
  reference: string | null;
  status: string;
  fx_rate: number | null;
  fx_base_currency: string | null;
  fx_quote_currency: string | null;
  reverses_journal_id: string | null;
  reversed_by_id: string | null;
  entries: JournalEntry[];
  posted_at: string;
}

export interface BalanceSeries {
  date: string;
  balance_minor_units: number;
}

export interface BalanceHistory {
  account_id: string;
  currency: string;
  granularity: string;
  series: BalanceSeries[];
}

export interface ReconciliationRun {
  id: string;
  status: string;
  total_debits: number;
  total_credits: number;
  discrepancy: number;
  affected_accounts: string[];
  duration_ms: number;
  run_at: string;
}

export interface Paginated<T> {
  data: T[];
  next_cursor: string | null;
}

// ── Fetchers ───────────────────────────────────────────────────────────────

export const fetchAccounts = (params?: { cursor?: string; limit?: string }) =>
  apiFetch<Paginated<Account>>("/api/v1/accounts", { limit: "100", ...params });

export const fetchAccount = (id: string) =>
  apiFetch<Account>(`/api/v1/accounts/${id}`);

export const fetchAccountEntries = (id: string, params?: { cursor?: string; limit?: string }) =>
  apiFetch<Paginated<Entry>>(`/api/v1/accounts/${id}/entries`, { limit: "50", ...params });

export const fetchBalanceHistory = (
  id: string,
  params: { from: string; to: string; granularity: string }
) =>
  apiFetch<BalanceHistory>(`/api/v1/accounts/${id}/balance/history`, params);

export const fetchJournals = (params?: { cursor?: string; limit?: string }) =>
  apiFetch<Paginated<JournalListItem>>("/api/v1/journals", { limit: "100", ...params });

export const fetchJournal = (id: string) =>
  apiFetch<JournalDetail>(`/api/v1/journals/${id}`);

export const fetchReconciliationRuns = () =>
  apiFetch<ReconciliationRun[]>("/api/v1/reconciliation/runs");

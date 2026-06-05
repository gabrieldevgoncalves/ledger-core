import { Injectable, Optional } from '@nestjs/common';
import { generateUlid } from '../shared/domain/ulid';
import { LedgerError } from '../shared/errors/ledger-errors';
import { MetricsService } from '../metrics/metrics.service';
import { AccountsRepository, AccountRow, AccountWithBalance, EntryRow } from './accounts.repository';
import { CreateAccountDto } from './dto/create-account.dto';
import { ListAccountsDto } from './dto/list-accounts.dto';
import { ListEntriesDto } from './dto/list-entries.dto';
import { Granularity } from './dto/balance-history.dto';

export interface AccountResponse {
  id: string;
  name: string;
  type: string;
  currency: string;
  description: string | null;
  metadata: unknown;
  is_active: boolean;
  created_at: string;
}

export interface AccountWithBalanceResponse extends AccountResponse {
  balance_minor_units: number;
}

export interface EntryResponse {
  id: string;
  journal_id: string;
  direction: string;
  amount: number;
  currency: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  next_cursor: string | null;
}

export interface BalanceResponse {
  account_id: string;
  currency: string;
  balance_minor_units: number;
  computed_at: string;
}

export interface BalanceAsOfResponse {
  account_id: string;
  currency: string;
  balance_minor_units: number;
  as_of: string;
}

export interface BalanceHistoryResponse {
  account_id: string;
  currency: string;
  granularity: string;
  series: { date: string; balance_minor_units: number }[];
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly repository: AccountsRepository,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async create(dto: CreateAccountDto): Promise<AccountResponse> {
    const account = await this.repository.create({
      id: generateUlid(),
      name: dto.name,
      type: dto.type,
      currency: dto.currency.toUpperCase(),
      description: dto.description,
      metadata: dto.metadata ?? {},
    });
    this.metrics?.incAccountCreated();
    return this.toResponse(account);
  }

  async findAll(dto: ListAccountsDto): Promise<PaginatedResponse<AccountWithBalanceResponse>> {
    const limit = dto.limit ?? 20;
    const rows = await this.repository.findMany({
      type: dto.type,
      currency: dto.currency,
      cursor: dto.cursor,
      limit,
    });

    const hasMore = rows.length > limit;
    const data = (hasMore ? rows.slice(0, limit) : rows).map((row) =>
      this.toResponseWithBalance(row),
    );

    return {
      data,
      next_cursor: hasMore ? data[data.length - 1].id : null,
    };
  }

  async findById(id: string): Promise<AccountWithBalanceResponse> {
    const account = await this.repository.findById(id);
    if (!account) throw new LedgerError('ACCOUNT_NOT_FOUND');
    const balance = await this.repository.getBalance(id, account.currency);
    return this.toResponseWithBalance({ ...account, balance_minor_units: balance });
  }

  async deactivate(id: string): Promise<{ id: string; is_active: false }> {
    const account = await this.repository.deactivate(id);
    if (!account) throw new LedgerError('ACCOUNT_NOT_FOUND');
    return { id: account.id, is_active: false };
  }

  async findEntries(
    id: string,
    dto: ListEntriesDto,
  ): Promise<PaginatedResponse<EntryResponse>> {
    const account = await this.repository.findById(id);
    if (!account) throw new LedgerError('ACCOUNT_NOT_FOUND');

    const limit = dto.limit ?? 50;
    const rows = await this.repository.findEntries({
      accountId: id,
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
      cursor: dto.cursor,
      limit,
    });

    const hasMore = rows.length > limit;
    const data = (hasMore ? rows.slice(0, limit) : rows).map((row) =>
      this.toEntryResponse(row),
    );

    return {
      data,
      next_cursor: hasMore ? data[data.length - 1].id : null,
    };
  }

  async getBalance(id: string): Promise<BalanceResponse> {
    const account = await this.repository.findById(id);
    if (!account) throw new LedgerError('ACCOUNT_NOT_FOUND');
    const balance = await this.repository.getBalance(id, account.currency);
    return {
      account_id: id,
      currency: account.currency,
      balance_minor_units: Number(balance),
      computed_at: new Date().toISOString(),
    };
  }

  async getBalanceAsOf(id: string, timestamp: string): Promise<BalanceAsOfResponse> {
    const account = await this.repository.findById(id);
    if (!account) throw new LedgerError('ACCOUNT_NOT_FOUND');
    const asOf = new Date(timestamp);
    const balance = await this.repository.getBalanceAsOf(id, account.currency, asOf);
    return {
      account_id: id,
      currency: account.currency,
      balance_minor_units: Number(balance),
      as_of: asOf.toISOString(),
    };
  }

  async getBalanceHistory(
    id: string,
    from: string,
    to: string,
    granularity: Granularity,
  ): Promise<BalanceHistoryResponse> {
    const account = await this.repository.findById(id);
    if (!account) throw new LedgerError('ACCOUNT_NOT_FOUND');

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const [openingBalance, periodNets] = await Promise.all([
      this.repository.getBalanceBefore(id, account.currency, fromDate),
      this.repository.getNetByPeriod(id, account.currency, fromDate, toDate, granularity),
    ]);

    const netMap = new Map<string, bigint>();
    for (const row of periodNets) {
      netMap.set(row.period.toISOString().split('T')[0], row.net);
    }

    const buckets = generateBuckets(fromDate, toDate, granularity);
    let running = openingBalance;
    const series = buckets.map((date) => {
      const key = formatDate(date);
      const net = netMap.get(key) ?? 0n;
      running += net;
      return { date: key, balance_minor_units: Number(running) };
    });

    return {
      account_id: id,
      currency: account.currency,
      granularity,
      series,
    };
  }

  private toResponse(account: AccountRow): AccountResponse {
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      description: account.description,
      metadata: account.metadata,
      is_active: account.is_active,
      created_at: account.created_at.toISOString(),
    };
  }

  private toResponseWithBalance(account: AccountWithBalance): AccountWithBalanceResponse {
    return {
      ...this.toResponse(account),
      balance_minor_units: Number(account.balance_minor_units),
    };
  }

  private toEntryResponse(row: EntryRow): EntryResponse {
    return {
      id: row.id,
      journal_id: row.journal_id,
      direction: row.direction,
      amount: Number(row.amount),
      currency: row.currency,
      created_at: row.created_at.toISOString(),
    };
  }
}

function generateBuckets(from: Date, to: Date, granularity: Granularity): Date[] {
  const buckets: Date[] = [];
  const current = truncateToGranularity(from, granularity);
  const end = truncateToGranularity(to, granularity);

  while (current <= end) {
    buckets.push(new Date(current));
    advanceBy(current, granularity);
  }
  return buckets;
}

function truncateToGranularity(date: Date, granularity: Granularity): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  if (granularity === Granularity.WEEKLY) {
    // PostgreSQL date_trunc('week') uses ISO 8601 weeks (Monday start)
    const day = d.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat
    const daysToMonday = (day + 6) % 7;
    d.setUTCDate(d.getUTCDate() - daysToMonday);
  } else if (granularity === Granularity.MONTHLY) {
    d.setUTCDate(1);
  }
  return d;
}

function advanceBy(date: Date, granularity: Granularity): void {
  if (granularity === Granularity.DAILY) {
    date.setUTCDate(date.getUTCDate() + 1);
  } else if (granularity === Granularity.WEEKLY) {
    date.setUTCDate(date.getUTCDate() + 7);
  } else {
    date.setUTCMonth(date.getUTCMonth() + 1);
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

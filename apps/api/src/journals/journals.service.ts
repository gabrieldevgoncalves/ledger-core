import { Injectable, Optional } from '@nestjs/common';
import { AccountsRepository, AccountRow } from '../accounts/accounts.repository';
import { generateUlid } from '../shared/domain/ulid';
import { LedgerError } from '../shared/errors/ledger-errors';
import { MetricsService } from '../metrics/metrics.service';
import { PostJournalDto } from './dto/post-journal.dto';
import { ListJournalsDto } from './dto/list-journals.dto';
import { checkDoubleEntry } from './invariant/double-entry.invariant';
import {
  JournalsRepository,
  JournalWithEntries,
  JournalListRow,
} from './journals.repository';

export interface JournalEntryResponse {
  id: string;
  account_id: string;
  direction: string;
  amount: number;
  currency: string;
}

export interface JournalResponse {
  id: string;
  description: string | null;
  reference: string | null;
  status: string;
  fx_rate: number | null;
  fx_base_currency: string | null;
  fx_quote_currency: string | null;
  reverses_journal_id: string | null;
  reversed_by_id: string | null;
  entries: JournalEntryResponse[];
  posted_at: string;
}

export interface JournalListResponse {
  id: string;
  description: string | null;
  reference: string | null;
  status: string;
  entry_count: number;
  posted_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  next_cursor: string | null;
}

export interface PostResult {
  journal: JournalResponse;
  created: boolean;
}

@Injectable()
export class JournalsService {
  constructor(
    private readonly repository: JournalsRepository,
    private readonly accountsRepository: AccountsRepository,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async post(dto: PostJournalDto): Promise<PostResult> {
    // INV-07: minimum 2 entries
    if (!dto.entries || dto.entries.length < 2) {
      throw new LedgerError('INVALID_JOURNAL', { entries_count: dto.entries?.length ?? 0 });
    }

    // INV-04: amount > 0
    for (const e of dto.entries) {
      if (e.amount <= 0) {
        throw new LedgerError('INVALID_AMOUNT', { amount: e.amount });
      }
    }

    // Idempotency via reference
    if (dto.reference) {
      const existing = await this.repository.findByReference(dto.reference);
      if (existing) {
        return { journal: this.formatJournal(existing), created: false };
      }
    }

    // INV check: all account_ids exist
    const accountIds = [...new Set(dto.entries.map((e) => e.account_id))];
    const accounts = await this.accountsRepository.findByIds(accountIds);

    for (const id of accountIds) {
      if (!accounts.find((a) => a.id === id)) {
        throw new LedgerError('ACCOUNT_NOT_FOUND', { account_id: id });
      }
    }

    // INV-08: all accounts active
    for (const account of accounts) {
      if (!account.is_active) {
        throw new LedgerError('ACCOUNT_INACTIVE', { account_id: account.id });
      }
    }

    // INV-01: per-currency debit = credit
    checkDoubleEntry(dto.entries);

    // INV-05: entry currency matches account currency
    for (const e of dto.entries) {
      const account = accounts.find((a) => a.id === e.account_id) as AccountRow;
      if (e.currency.toUpperCase() !== account.currency) {
        throw new LedgerError('CURRENCY_MISMATCH', {
          account_id: e.account_id,
          entry_currency: e.currency.toUpperCase(),
          account_currency: account.currency,
        });
      }
    }

    const journal = await this.repository.create({
      id: generateUlid(),
      description: dto.description,
      reference: dto.reference,
      metadata: dto.metadata ?? {},
      fx_rate: dto.fx_rate,
      fx_base_currency: dto.fx_base_currency,
      fx_quote_currency: dto.fx_quote_currency,
      entries: dto.entries.map((e) => ({
        id: generateUlid(),
        account_id: e.account_id,
        direction: e.direction,
        amount: e.amount,
        currency: e.currency.toUpperCase(),
      })),
    });

    this.metrics?.incJournalPosted();
    return { journal: this.formatJournal(journal), created: true };
  }

  async findAll(
    dto: ListJournalsDto,
  ): Promise<PaginatedResponse<JournalListResponse>> {
    const limit = dto.limit ?? 20;
    const rows = await this.repository.findMany({
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
      account_id: dto.account_id,
      reference: dto.reference,
      cursor: dto.cursor,
      limit,
    });

    const hasMore = rows.length > limit;
    const data = (hasMore ? rows.slice(0, limit) : rows).map((r) =>
      this.toListResponse(r),
    );

    return {
      data,
      next_cursor: hasMore ? data[data.length - 1].id : null,
    };
  }

  async findById(id: string): Promise<JournalResponse> {
    const journal = await this.repository.findById(id);
    if (!journal) throw new LedgerError('JOURNAL_NOT_FOUND');
    return this.formatJournal(journal);
  }

  async reverse(id: string, description?: string): Promise<JournalResponse> {
    const original = await this.repository.findById(id);
    if (!original) throw new LedgerError('JOURNAL_NOT_FOUND');

    // INV-06: single reversal
    if (original.status === 'REVERSED') {
      throw new LedgerError('ALREADY_REVERSED', { journal_id: id });
    }

    const reversal = await this.repository.reverse(id, {
      id: generateUlid(),
      description: description ?? `Reversal of journal ${id}`,
      entries: original.entries.map((e) => ({
        id: generateUlid(),
        account_id: e.account_id,
        direction: e.direction as 'DEBIT' | 'CREDIT',
        amount: e.amount,
        currency: e.currency,
      })),
    });

    this.metrics?.incJournalReversed();
    return this.formatJournal(reversal);
  }

  private formatJournal(journal: JournalWithEntries): JournalResponse {
    return {
      id: journal.id,
      description: journal.description,
      reference: journal.reference,
      status: journal.status,
      fx_rate: journal.fx_rate != null ? Number(journal.fx_rate) : null,
      fx_base_currency: journal.fx_base_currency,
      fx_quote_currency: journal.fx_quote_currency,
      reverses_journal_id: journal.reverses_journal_id,
      reversed_by_id: journal.reversed_by_id,
      entries: journal.entries.map((e) => ({
        id: e.id,
        account_id: e.account_id,
        direction: e.direction,
        amount: Number(e.amount),
        currency: e.currency,
      })),
      posted_at: journal.posted_at.toISOString(),
    };
  }

  private toListResponse(row: JournalListRow): JournalListResponse {
    return {
      id: row.id,
      description: row.description,
      reference: row.reference,
      status: row.status,
      entry_count: row.entry_count,
      posted_at: row.posted_at.toISOString(),
    };
  }
}

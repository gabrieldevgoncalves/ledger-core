import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';

export interface JournalEntryRow {
  id: string;
  journal_id: string;
  account_id: string;
  direction: string;
  amount: bigint;
  currency: string;
  created_at: Date;
}

export interface JournalRow {
  id: string;
  description: string | null;
  reference: string | null;
  metadata: unknown;
  fx_rate: Prisma.Decimal | null;
  fx_base_currency: string | null;
  fx_quote_currency: string | null;
  reverses_journal_id: string | null;
  reversed_by_id: string | null;
  status: string;
  posted_at: Date;
  created_at: Date;
}

export interface JournalWithEntries extends JournalRow {
  entries: JournalEntryRow[];
}

export interface JournalListRow {
  id: string;
  description: string | null;
  reference: string | null;
  status: string;
  entry_count: number;
  posted_at: Date;
}

export interface CreateEntryData {
  id: string;
  account_id: string;
  direction: string;
  amount: number;
  currency: string;
}

export interface CreateJournalData {
  id: string;
  description?: string;
  reference?: string;
  metadata: Record<string, unknown>;
  fx_rate?: number;
  fx_base_currency?: string;
  fx_quote_currency?: string;
  entries: CreateEntryData[];
}

export interface ReverseData {
  id: string;
  description: string;
  entries: Array<{
    id: string;
    account_id: string;
    direction: 'DEBIT' | 'CREDIT';
    amount: bigint;
    currency: string;
  }>;
}

export interface ListJournalOpts {
  from?: Date;
  to?: Date;
  account_id?: string;
  reference?: string;
  cursor?: string;
  limit: number;
}

@Injectable()
export class JournalsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async findByReference(reference: string): Promise<JournalWithEntries | null> {
    const journal = await this.prisma.journal.findUnique({
      where: { reference },
      include: { entries: { orderBy: { created_at: 'asc' } } },
    });
    return journal as JournalWithEntries | null;
  }

  async findById(id: string): Promise<JournalWithEntries | null> {
    const journal = await this.prisma.journal.findUnique({
      where: { id },
      include: { entries: { orderBy: { created_at: 'asc' } } },
    });
    return journal as JournalWithEntries | null;
  }

  async create(data: CreateJournalData): Promise<JournalWithEntries> {
    return this.prisma.$transaction(async (tx) => {
      const journal = await tx.journal.create({
        data: {
          id: data.id,
          description: data.description ?? null,
          reference: data.reference ?? null,
          metadata: data.metadata as Prisma.InputJsonValue,
          fx_rate: data.fx_rate ?? null,
          fx_base_currency: data.fx_base_currency ?? null,
          fx_quote_currency: data.fx_quote_currency ?? null,
        },
      });

      const entries: JournalEntryRow[] = [];
      for (const e of data.entries) {
        const entry = await tx.entry.create({
          data: {
            id: e.id,
            journal_id: journal.id,
            account_id: e.account_id,
            direction: e.direction,
            amount: BigInt(e.amount),
            currency: e.currency,
          },
        });
        entries.push(entry as unknown as JournalEntryRow);
      }

      const currencies = [...new Set(entries.map((e) => e.currency))];
      const total_debit_by_currency = entries
        .filter((e) => e.direction === 'DEBIT')
        .reduce((acc, e) => {
          acc[e.currency] = (acc[e.currency] ?? 0) + Number(e.amount);
          return acc;
        }, {} as Record<string, number>);

      await this.outbox.write(tx, 'journal.posted', {
        journal_id: journal.id,
        reference: journal.reference ?? null,
        entry_count: entries.length,
        currencies,
        total_debit_by_currency,
        posted_at: journal.posted_at.toISOString(),
      });

      return { ...journal, entries } as JournalWithEntries;
    });
  }

  async findMany(opts: ListJournalOpts): Promise<JournalListRow[]> {
    const conditions: Prisma.Sql[] = [];

    if (opts.cursor) conditions.push(Prisma.sql`j.id < ${opts.cursor}`);
    if (opts.from) conditions.push(Prisma.sql`j.posted_at >= ${opts.from}`);
    if (opts.to) {
      const toInclusive = new Date(opts.to.getTime() + 24 * 60 * 60 * 1000 - 1);
      conditions.push(Prisma.sql`j.posted_at <= ${toInclusive}`);
    }
    if (opts.account_id) {
      conditions.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM entries e
          WHERE e.journal_id = j.id AND e.account_id = ${opts.account_id}
        )`,
      );
    }
    if (opts.reference) conditions.push(Prisma.sql`j.reference = ${opts.reference}`);

    const whereClause =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.sql``;

    return this.prisma.$queryRaw<JournalListRow[]>`
      SELECT
        j.id, j.description, j.reference, j.status, j.posted_at,
        COUNT(e.id)::int AS entry_count
      FROM journals j
      LEFT JOIN entries e ON e.journal_id = j.id
      ${whereClause}
      GROUP BY j.id
      ORDER BY j.id DESC
      LIMIT ${opts.limit + 1}
    `;
  }

  async reverse(originalId: string, data: ReverseData): Promise<JournalWithEntries> {
    return this.prisma.$transaction(async (tx) => {
      const reversal = await tx.journal.create({
        data: {
          id: data.id,
          description: data.description,
          reverses_journal_id: originalId,
          metadata: {} as Prisma.InputJsonValue,
        },
      });

      const entries: JournalEntryRow[] = [];
      for (const e of data.entries) {
        const flipped = e.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT';
        const entry = await tx.entry.create({
          data: {
            id: e.id,
            journal_id: reversal.id,
            account_id: e.account_id,
            direction: flipped,
            amount: e.amount,
            currency: e.currency,
          },
        });
        entries.push(entry as unknown as JournalEntryRow);
      }

      await tx.journal.update({
        where: { id: originalId },
        data: { status: 'REVERSED', reversed_by_id: reversal.id },
      });

      await this.outbox.write(tx, 'journal.reversed', {
        reversal_journal_id: reversal.id,
        original_journal_id: originalId,
        reversed_at: reversal.posted_at.toISOString(),
      });

      return { ...reversal, entries } as JournalWithEntries;
    });
  }
}

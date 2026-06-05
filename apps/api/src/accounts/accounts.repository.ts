import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Granularity } from './dto/balance-history.dto';

export interface AccountRow {
  id: string;
  name: string;
  type: string;
  currency: string;
  description: string | null;
  metadata: unknown;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AccountWithBalance extends AccountRow {
  balance_minor_units: bigint;
}

export interface EntryRow {
  id: string;
  journal_id: string;
  direction: string;
  amount: bigint;
  currency: string;
  created_at: Date;
}

export interface PeriodNet {
  period: Date;
  net: bigint;
}

const GRANULARITY_SQL: Record<Granularity, string> = {
  [Granularity.DAILY]: 'day',
  [Granularity.WEEKLY]: 'week',
  [Granularity.MONTHLY]: 'month',
};

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    id: string;
    name: string;
    type: string;
    currency: string;
    description?: string;
    metadata: Record<string, unknown>;
  }): Promise<AccountRow> {
    return this.prisma.account.create({
      data: {
        id: data.id,
        name: data.name,
        type: data.type,
        currency: data.currency,
        description: data.description ?? null,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    }) as Promise<AccountRow>;
  }

  async findById(id: string): Promise<AccountRow | null> {
    return this.prisma.account.findUnique({ where: { id } }) as Promise<AccountRow | null>;
  }

  async findMany(opts: {
    type?: string;
    currency?: string;
    cursor?: string;
    limit: number;
  }): Promise<AccountWithBalance[]> {
    const where: Prisma.Sql[] = [];
    if (opts.cursor) where.push(Prisma.sql`a.id > ${opts.cursor}`);
    if (opts.type) where.push(Prisma.sql`a.type = ${opts.type}`);
    if (opts.currency) where.push(Prisma.sql`a.currency = ${opts.currency}`);

    const whereClause =
      where.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(where, ' AND ')}`
        : Prisma.sql``;

    return this.prisma.$queryRaw<AccountWithBalance[]>`
      SELECT
        a.id, a.name, a.type, a.currency, a.description,
        a.metadata, a.is_active, a.created_at, a.updated_at,
        COALESCE(
          SUM(CASE WHEN e.direction = 'DEBIT' THEN e.amount ELSE -e.amount END),
          0
        )::bigint AS balance_minor_units
      FROM accounts a
      LEFT JOIN entries e ON e.account_id = a.id AND e.currency = a.currency
      ${whereClause}
      GROUP BY a.id, a.name, a.type, a.currency, a.description,
               a.metadata, a.is_active, a.created_at, a.updated_at
      ORDER BY a.id ASC
      LIMIT ${opts.limit + 1}
    `;
  }

  async findByIds(ids: string[]): Promise<AccountRow[]> {
    if (ids.length === 0) return [];
    return this.prisma.account.findMany({
      where: { id: { in: ids } },
    }) as Promise<AccountRow[]>;
  }

  async deactivate(id: string): Promise<AccountRow | null> {
    try {
      return await this.prisma.account.update({
        where: { id },
        data: { is_active: false },
      }) as AccountRow;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        return null;
      }
      throw e;
    }
  }

  async findEntries(opts: {
    accountId: string;
    from?: Date;
    to?: Date;
    cursor?: string;
    limit: number;
  }): Promise<EntryRow[]> {
    const conditions: Prisma.Sql[] = [Prisma.sql`e.account_id = ${opts.accountId}`];
    if (opts.from) conditions.push(Prisma.sql`e.created_at >= ${opts.from}`);
    if (opts.to) conditions.push(Prisma.sql`e.created_at <= ${opts.to}`);
    // cursor = last seen id; entries sorted DESC so next page has id < cursor
    if (opts.cursor) conditions.push(Prisma.sql`e.id < ${opts.cursor}`);

    return this.prisma.$queryRaw<EntryRow[]>`
      SELECT e.id, e.journal_id, e.direction, e.amount, e.currency, e.created_at
      FROM entries e
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ${opts.limit + 1}
    `;
  }

  async getBalance(accountId: string, currency: string): Promise<bigint> {
    const rows = await this.prisma.$queryRaw<[{ balance: bigint }]>`
      SELECT COALESCE(
        SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE -amount END),
        0
      )::bigint AS balance
      FROM entries
      WHERE account_id = ${accountId} AND currency = ${currency}
    `;
    return rows[0].balance;
  }

  async getBalanceAsOf(accountId: string, currency: string, asOf: Date): Promise<bigint> {
    const rows = await this.prisma.$queryRaw<[{ balance: bigint }]>`
      SELECT COALESCE(
        SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE -amount END),
        0
      )::bigint AS balance
      FROM entries
      WHERE account_id = ${accountId} AND currency = ${currency}
        AND created_at <= ${asOf}
    `;
    return rows[0].balance;
  }

  async getBalanceBefore(accountId: string, currency: string, before: Date): Promise<bigint> {
    const rows = await this.prisma.$queryRaw<[{ balance: bigint }]>`
      SELECT COALESCE(
        SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE -amount END),
        0
      )::bigint AS balance
      FROM entries
      WHERE account_id = ${accountId} AND currency = ${currency}
        AND created_at < ${before}
    `;
    return rows[0].balance;
  }

  async getNetByPeriod(
    accountId: string,
    currency: string,
    from: Date,
    to: Date,
    granularity: Granularity,
  ): Promise<PeriodNet[]> {
    const gran = GRANULARITY_SQL[granularity];
    // end of 'to' day inclusive
    const toInclusive = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
    return this.prisma.$queryRaw<PeriodNet[]>`
      SELECT
        date_trunc(${gran}, created_at)::date AS period,
        SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE -amount END)::bigint AS net
      FROM entries
      WHERE account_id = ${accountId} AND currency = ${currency}
        AND created_at >= ${from} AND created_at <= ${toInclusive}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
  }
}

import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { MetricsService } from '../metrics/metrics.service';
import { generateUlid } from '../shared/domain/ulid';

export interface ReconciliationResult {
  id: string;
  status: string;
  total_debits: number;
  total_credits: number;
  discrepancy: number;
  affected_accounts: string[];
  duration_ms: number;
  run_at: string;
}

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async run(): Promise<ReconciliationResult> {
    const start = Date.now();

    const [totals] = await this.prisma.$queryRaw<
      [{ total_debits: bigint; total_credits: bigint }]
    >`
      SELECT
        COALESCE(SUM(CASE WHEN direction = 'DEBIT'  THEN amount ELSE 0 END), 0)::bigint AS total_debits,
        COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE 0 END), 0)::bigint AS total_credits
      FROM entries
    `;

    const discrepancy = totals.total_debits - totals.total_credits;
    const status = discrepancy === 0n ? 'PASS' : 'FAIL';

    let affected: { account_id: string }[] = [];
    if (discrepancy !== 0n) {
      affected = await this.prisma.$queryRaw<{ account_id: string }[]>`
        WITH bad_journals AS (
          SELECT journal_id
          FROM entries
          GROUP BY journal_id, currency
          HAVING SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE -amount END) != 0
        )
        SELECT DISTINCT account_id
        FROM entries
        WHERE journal_id IN (SELECT journal_id FROM bad_journals)
      `;
    }

    const duration_ms = Date.now() - start;
    const affected_accounts = affected.map((r) => r.account_id);

    const saved = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const rec = await tx.reconciliationRun.create({
        data: {
          id: generateUlid(),
          status,
          total_debits: totals.total_debits,
          total_credits: totals.total_credits,
          discrepancy,
          affected_accounts,
          duration_ms,
        },
      });

      await this.outbox.write(tx, 'reconciliation.completed', {
        run_id: rec.id,
        status,
        total_debits: Number(totals.total_debits),
        total_credits: Number(totals.total_credits),
        discrepancy: Number(discrepancy),
        affected_accounts,
      });

      return rec;
    });

    this.metrics?.incReconciliationRun(status as 'PASS' | 'FAIL');

    return {
      id: saved.id,
      status: saved.status,
      total_debits: Number(saved.total_debits),
      total_credits: Number(saved.total_credits),
      discrepancy: Number(saved.discrepancy),
      affected_accounts: saved.affected_accounts,
      duration_ms: saved.duration_ms,
      run_at: saved.run_at.toISOString(),
    };
  }

  async listRuns(limit = 20): Promise<ReconciliationResult[]> {
    const rows = await this.prisma.reconciliationRun.findMany({
      orderBy: { run_at: 'desc' },
      take: limit,
    });
    return rows.map((r) => this.toResult(r));
  }

  async getRun(id: string): Promise<ReconciliationResult | null> {
    const row = await this.prisma.reconciliationRun.findUnique({ where: { id } });
    return row ? this.toResult(row) : null;
  }

  private toResult(r: {
    id: string; status: string; total_debits: bigint; total_credits: bigint;
    discrepancy: bigint; affected_accounts: string[]; duration_ms: number; run_at: Date;
  }): ReconciliationResult {
    return {
      id: r.id,
      status: r.status,
      total_debits: Number(r.total_debits),
      total_credits: Number(r.total_credits),
      discrepancy: Number(r.discrepancy),
      affected_accounts: r.affected_accounts,
      duration_ms: r.duration_ms,
      run_at: r.run_at.toISOString(),
    };
  }
}

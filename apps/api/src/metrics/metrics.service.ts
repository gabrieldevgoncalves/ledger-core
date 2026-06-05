import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('ledger_journals_posted_total')
    private readonly journalsPosted: Counter<string>,
    @InjectMetric('ledger_journals_reversed_total')
    private readonly journalsReversed: Counter<string>,
    @InjectMetric('ledger_accounts_created_total')
    private readonly accountsCreated: Counter<string>,
    @InjectMetric('ledger_reconciliation_runs_total')
    private readonly reconciliationRuns: Counter<string>,
  ) {}

  incJournalPosted(): void {
    this.journalsPosted.inc();
  }

  incJournalReversed(): void {
    this.journalsReversed.inc();
  }

  incAccountCreated(): void {
    this.accountsCreated.inc();
  }

  incReconciliationRun(status: 'PASS' | 'FAIL'): void {
    this.reconciliationRuns.inc({ status });
  }
}

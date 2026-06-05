import { Global, Module } from '@nestjs/common';
import {
  makeCounterProvider,
} from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  providers: [
    makeCounterProvider({
      name: 'ledger_journals_posted_total',
      help: 'Total journals posted',
    }),
    makeCounterProvider({
      name: 'ledger_journals_reversed_total',
      help: 'Total journal reversals',
    }),
    makeCounterProvider({
      name: 'ledger_accounts_created_total',
      help: 'Total accounts created',
    }),
    makeCounterProvider({
      name: 'ledger_reconciliation_runs_total',
      help: 'Total reconciliation runs by status',
      labelNames: ['status'],
    }),
    MetricsService,
  ],
  exports: [MetricsService],
})
export class MetricsModule {}

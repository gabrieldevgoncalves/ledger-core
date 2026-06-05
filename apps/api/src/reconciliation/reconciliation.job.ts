import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { ReconciliationService } from './reconciliation.service';

@Processor('reconciliation')
@Injectable()
export class ReconciliationJob extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ReconciliationJob.name);

  constructor(
    @InjectQueue('reconciliation') private readonly queue: Queue,
    private readonly service: ReconciliationService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const existing = await this.queue.getRepeatableJobs();
    for (const job of existing.filter((j) => j.name === 'daily')) {
      await this.queue.removeRepeatableByKey(job.key);
    }
    const pattern = this.config.get<string>('RECONCILIATION_CRON', '0 0 * * *');
    await this.queue.add('daily', {}, { repeat: { pattern } });
    this.logger.log(`Reconciliation cron scheduled: ${pattern}`);
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Running reconciliation job [${job.id}]`);
    const result = await this.service.run();
    this.logger.log(`Reconciliation ${result.status} — discrepancy: ${result.discrepancy}`);
  }
}

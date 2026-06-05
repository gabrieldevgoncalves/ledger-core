import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Processor('outbox')
@Injectable()
export class OutboxRelay extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(OutboxRelay.name);

  constructor(
    @InjectQueue('outbox') private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly amqp: AmqpConnection,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const existing = await this.queue.getRepeatableJobs();
    for (const job of existing.filter((j) => j.name === 'flush')) {
      await this.queue.removeRepeatableByKey(job.key);
    }
    await this.queue.add('flush', {}, { repeat: { every: 500 } });
    this.logger.log('Outbox relay scheduled every 500ms');
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'flush') return;

    const rows = await this.prisma.outbox.findMany({
      where: { status: 'PENDING' },
      orderBy: { created_at: 'asc' },
      take: 10,
    });

    for (const row of rows) {
      try {
        await this.amqp.publish('ledger.events', row.event_type, row.payload as object);
        await this.prisma.outbox.update({
          where: { id: row.id },
          data: { status: 'SENT', sent_at: new Date() },
        });
        this.logger.debug(`Published ${row.event_type} [${row.id}]`);
      } catch (err) {
        const newAttempts = row.attempts + 1;
        const isDead = newAttempts >= 3;

        this.logger.warn(`Failed to publish outbox event ${row.id}: ${err}`);
        await this.prisma.outbox.update({
          where: { id: row.id },
          data: {
            attempts: { increment: 1 },
            last_error: String(err),
            ...(isDead ? { status: 'FAILED' } : {}),
          },
        });

        if (isDead) {
          this.logger.error(
            `outbox.relay.dead: event ${row.id} (${row.event_type}) failed after ${newAttempts} attempts — ${err}`,
          );
        }
      }
    }
  }
}

import { Controller, Get, HttpCode } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { PrismaService } from '../prisma/prisma.service';

interface HealthResponse {
  status: 'ok' | 'error';
  checks: {
    database: { status: 'ok' | 'error'; latency_ms: number };
    rabbitmq: { status: 'ok' | 'error' };
    outbox_lag: { status: 'ok' | 'error'; pending_events: number };
  };
  version: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly amqp: AmqpConnection,
  ) {}

  @Get()
  @HttpCode(200)
  async check(): Promise<HealthResponse> {
    const [database, outbox_lag] = await Promise.all([
      this.checkDatabase(),
      this.checkOutboxLag(),
    ]);
    const rabbitmq = this.checkRabbitMQ();
    const allOk = database.status === 'ok' && rabbitmq.status === 'ok' && outbox_lag.status === 'ok';

    return {
      status: allOk ? 'ok' : 'error',
      checks: { database, rabbitmq, outbox_lag },
      version: '1.0.0',
    };
  }

  private async checkDatabase(): Promise<{ status: 'ok' | 'error'; latency_ms: number }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', latency_ms: Date.now() - start };
    } catch {
      return { status: 'error', latency_ms: Date.now() - start };
    }
  }

  private checkRabbitMQ(): { status: 'ok' | 'error' } {
    try {
      return { status: this.amqp.managedConnection.isConnected() ? 'ok' : 'error' };
    } catch {
      return { status: 'error' };
    }
  }

  private async checkOutboxLag(): Promise<{ status: 'ok' | 'error'; pending_events: number }> {
    try {
      const pending_events = await this.prisma.outbox.count({ where: { status: 'PENDING' } });
      return { status: pending_events > 100 ? 'error' : 'ok', pending_events };
    } catch {
      return { status: 'error', pending_events: -1 };
    }
  }
}

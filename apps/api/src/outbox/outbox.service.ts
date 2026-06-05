import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { generateUlid } from '../shared/domain/ulid';

@Injectable()
export class OutboxService {
  async write(
    tx: Prisma.TransactionClient,
    eventType: string,
    payload: object,
  ): Promise<void> {
    const envelope = {
      event_id: generateUlid(),
      event_type: eventType,
      version: '1.0' as const,
      occurred_at: new Date().toISOString(),
      payload,
    };
    await tx.outbox.create({
      data: {
        id: generateUlid(),
        event_type: eventType,
        payload: envelope as unknown as Prisma.InputJsonValue,
      },
    });
  }
}

import { Module } from '@nestjs/common';
import { OutboxModule } from '../outbox/outbox.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, OutboxModule],
  controllers: [HealthController],
})
export class HealthModule {}

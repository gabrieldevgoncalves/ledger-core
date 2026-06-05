import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { OutboxModule } from '../outbox/outbox.module';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationJob } from './reconciliation.job';
import { ReconciliationController } from './reconciliation.controller';

@Module({
  imports: [
    PrismaModule,
    OutboxModule,
    BullModule.registerQueue({ name: 'reconciliation' }),
  ],
  controllers: [ReconciliationController],
  providers: [ReconciliationService, ReconciliationJob],
})
export class ReconciliationModule {}

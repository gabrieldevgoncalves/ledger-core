import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { OutboxService } from './outbox.service';
import { OutboxRelay } from './outbox.relay';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: 'outbox' }),
    RabbitMQModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        exchanges: [{ name: 'ledger.events', type: 'topic' }],
        uri: config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'),
        connectionInitOptions: { wait: false },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [OutboxService, OutboxRelay],
  exports: [OutboxService, RabbitMQModule],
})
export class OutboxModule {}

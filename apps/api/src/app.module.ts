import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AccountsModule } from './accounts/accounts.module';
import { JournalsModule } from './journals/journals.module';
import { OutboxModule } from './outbox/outbox.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { FxRatesModule } from './fx-rates/fx-rates.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: parseInt(config.get<string>('REDIS_PORT', '6380'), 10),
        },
      }),
      inject: [ConfigService],
    }),
    PrometheusModule.register({ path: 'metrics', defaultMetrics: { enabled: true } }),
    MetricsModule,
    PrismaModule,
    HealthModule,
    AccountsModule,
    JournalsModule,
    OutboxModule,
    ReconciliationModule,
    FxRatesModule,
  ],
})
export class AppModule {}

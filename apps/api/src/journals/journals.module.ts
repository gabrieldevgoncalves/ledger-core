import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { OutboxModule } from '../outbox/outbox.module';
import { JournalsController } from './journals.controller';
import { JournalsService } from './journals.service';
import { JournalsRepository } from './journals.repository';

@Module({
  imports: [AccountsModule, OutboxModule],
  controllers: [JournalsController],
  providers: [JournalsService, JournalsRepository],
  exports: [JournalsService],
})
export class JournalsModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FxRatesService } from './fx-rates.service';
import { FxRatesController } from './fx-rates.controller';

@Module({
  imports: [PrismaModule],
  controllers: [FxRatesController],
  providers: [FxRatesService],
})
export class FxRatesModule {}

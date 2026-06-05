import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { FxRatesService } from './fx-rates.service';
import { UpsertFxRateDto } from './dto/upsert-fx-rate.dto';
import { ListFxRatesDto } from './dto/list-fx-rates.dto';

@Controller('fx-rates')
export class FxRatesController {
  constructor(private readonly service: FxRatesService) {}

  @Post()
  @HttpCode(200)
  upsert(@Body() dto: UpsertFxRateDto) {
    return this.service.upsert(dto);
  }

  @Get()
  list(@Query() dto: ListFxRatesDto) {
    return this.service.list(dto);
  }

  @Get('latest')
  getLatest(@Query('base') base: string, @Query('quote') quote: string) {
    return this.service.getLatest(base, quote);
  }
}

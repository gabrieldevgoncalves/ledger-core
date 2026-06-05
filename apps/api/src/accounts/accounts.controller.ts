import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { ListAccountsDto } from './dto/list-accounts.dto';
import { ListEntriesDto } from './dto/list-entries.dto';
import { BalanceAsOfDto } from './dto/balance-as-of.dto';
import { BalanceHistoryDto, Granularity } from './dto/balance-history.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateAccountDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() dto: ListAccountsDto) {
    return this.service.findAll(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id/deactivate')
  @HttpCode(200)
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }

  @Get(':id/entries')
  findEntries(@Param('id') id: string, @Query() dto: ListEntriesDto) {
    return this.service.findEntries(id, dto);
  }

  @Get(':id/balance')
  getBalance(@Param('id') id: string) {
    return this.service.getBalance(id);
  }

  @Get(':id/balance/as-of')
  getBalanceAsOf(@Param('id') id: string, @Query() dto: BalanceAsOfDto) {
    return this.service.getBalanceAsOf(id, dto.timestamp);
  }

  @Get(':id/balance/history')
  getBalanceHistory(@Param('id') id: string, @Query() dto: BalanceHistoryDto) {
    return this.service.getBalanceHistory(
      id,
      dto.from,
      dto.to,
      dto.granularity ?? Granularity.DAILY,
    );
  }
}

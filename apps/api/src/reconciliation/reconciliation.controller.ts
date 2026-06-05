import { Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';

@Controller('reconciliation')
export class ReconciliationController {
  constructor(private readonly service: ReconciliationService) {}

  @Post('run')
  @HttpCode(200)
  run() {
    return this.service.run();
  }

  @Get('runs')
  listRuns(@Query('limit') limit?: string) {
    return this.service.listRuns(limit ? parseInt(limit, 10) : 20);
  }

  @Get('runs/:id')
  async getRunById(@Param('id') id: string) {
    const run = await this.service.getRun(id);
    if (!run) throw new NotFoundException('Reconciliation run not found');
    return run;
  }
}

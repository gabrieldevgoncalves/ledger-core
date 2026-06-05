import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateUlid } from '../shared/domain/ulid';
import { UpsertFxRateDto } from './dto/upsert-fx-rate.dto';
import { ListFxRatesDto } from './dto/list-fx-rates.dto';

export interface FxRateResponse {
  id: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  effective_date: string;
  created_at: string;
}

@Injectable()
export class FxRatesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(dto: UpsertFxRateDto): Promise<FxRateResponse> {
    const base = dto.base_currency.toUpperCase();
    const quote = dto.quote_currency.toUpperCase();
    const effectiveDate = new Date(dto.effective_date);

    const row = await this.prisma.fxRate.upsert({
      where: {
        base_currency_quote_currency_effective_date: {
          base_currency: base,
          quote_currency: quote,
          effective_date: effectiveDate,
        },
      },
      update: { rate: new Prisma.Decimal(dto.rate) },
      create: {
        id: generateUlid(),
        base_currency: base,
        quote_currency: quote,
        rate: new Prisma.Decimal(dto.rate),
        effective_date: effectiveDate,
      },
    });

    return this.toResponse(row);
  }

  async list(dto: ListFxRatesDto): Promise<FxRateResponse[]> {
    const where: Prisma.FxRateWhereInput = {};
    if (dto.base) where.base_currency = dto.base.toUpperCase();
    if (dto.quote) where.quote_currency = dto.quote.toUpperCase();
    if (dto.date) where.effective_date = new Date(dto.date);

    const rows = await this.prisma.fxRate.findMany({
      where,
      orderBy: { effective_date: 'desc' },
    });

    return rows.map((r) => this.toResponse(r));
  }

  async getLatest(base: string, quote: string): Promise<FxRateResponse> {
    const row = await this.prisma.fxRate.findFirst({
      where: {
        base_currency: base.toUpperCase(),
        quote_currency: quote.toUpperCase(),
      },
      orderBy: { effective_date: 'desc' },
    });

    if (!row) {
      throw new NotFoundException(`No rate found for ${base}/${quote}`);
    }

    return this.toResponse(row);
  }

  private toResponse(row: {
    id: string;
    base_currency: string;
    quote_currency: string;
    rate: Prisma.Decimal;
    effective_date: Date;
    created_at: Date;
  }): FxRateResponse {
    return {
      id: row.id,
      base_currency: row.base_currency,
      quote_currency: row.quote_currency,
      rate: Number(row.rate),
      effective_date: row.effective_date.toISOString().split('T')[0],
      created_at: row.created_at.toISOString(),
    };
  }
}

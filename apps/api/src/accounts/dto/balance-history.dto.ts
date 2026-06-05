import { IsDateString, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

export enum Granularity {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export class BalanceHistoryDto {
  @IsDateString()
  @IsNotEmpty()
  from: string;

  @IsDateString()
  @IsNotEmpty()
  to: string;

  @IsOptional()
  @IsEnum(Granularity)
  granularity?: Granularity = Granularity.DAILY;
}

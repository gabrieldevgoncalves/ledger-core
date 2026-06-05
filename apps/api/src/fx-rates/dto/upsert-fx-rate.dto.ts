import { IsDateString, IsNotEmpty, IsNumber, IsPositive, IsString, Length } from 'class-validator';

export class UpsertFxRateDto {
  @IsString() @IsNotEmpty() @Length(3, 3)
  base_currency: string;

  @IsString() @IsNotEmpty() @Length(3, 3)
  quote_currency: string;

  @IsNumber() @IsPositive()
  rate: number;

  @IsDateString()
  effective_date: string;
}

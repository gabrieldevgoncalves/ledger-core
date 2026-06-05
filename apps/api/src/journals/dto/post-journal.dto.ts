import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

export enum Direction {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export class EntryLineDto {
  @IsString()
  @IsNotEmpty()
  account_id: string;

  @IsEnum(Direction)
  direction: Direction;

  // No @Min(1) here — business rule checked in service → INVALID_AMOUNT (422)
  @IsInt()
  amount: number;

  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  currency: string;
}

export class PostJournalDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  fx_rate?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  fx_base_currency?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  fx_quote_currency?: string;

  // No @ArrayMinSize(2) — business rule checked in service → INVALID_JOURNAL (422)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntryLineDto)
  entries: EntryLineDto[];
}

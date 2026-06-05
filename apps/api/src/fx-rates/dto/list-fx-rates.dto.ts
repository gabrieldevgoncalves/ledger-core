import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class ListFxRatesDto {
  @IsOptional() @IsString() @Length(3, 3)
  base?: string;

  @IsOptional() @IsString() @Length(3, 3)
  quote?: string;

  @IsOptional() @IsDateString()
  date?: string;
}

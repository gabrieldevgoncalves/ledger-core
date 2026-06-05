import { IsDateString, IsNotEmpty } from 'class-validator';

export class BalanceAsOfDto {
  @IsDateString()
  @IsNotEmpty()
  timestamp: string;
}

import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectAbsenceDto {
  @ApiPropertyOptional({ description: 'Optionale Notiz zur Ablehnung', example: 'Personalbedarf in diesem Zeitraum' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueryCalendarDto {
  @ApiProperty({ description: 'Startdatum des Zeitraums (ISO-Datum)', example: '2026-04-01' })
  @IsDateString()
  from!: string;

  @ApiProperty({ description: 'Enddatum des Zeitraums (ISO-Datum)', example: '2026-04-30' })
  @IsDateString()
  to!: string;
}

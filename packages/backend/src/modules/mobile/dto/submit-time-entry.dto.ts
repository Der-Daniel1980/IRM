import {
  IsDateString,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitTimeEntryDto {
  @ApiProperty({ description: 'Startzeit (ISO 8601)', example: '2026-04-03T08:00:00Z' })
  @IsDateString()
  startedAt: string;

  @ApiPropertyOptional({ description: 'Endzeit (ISO 8601)', example: '2026-04-03T10:30:00Z' })
  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @ApiPropertyOptional({ description: 'Dauer in Minuten', minimum: 1, maximum: 1440 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMin?: number;

  @ApiPropertyOptional({ description: 'Notizen', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

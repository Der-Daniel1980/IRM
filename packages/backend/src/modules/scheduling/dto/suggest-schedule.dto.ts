import {
  IsString,
  IsOptional,
  IsInt,
  IsUUID,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SuggestScheduleDto {
  @ApiPropertyOptional({ description: 'Auftrags-UUID (optional)', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  workOrderId?: string;

  @ApiProperty({ description: 'Tätigkeitstyp-UUID', format: 'uuid' })
  @IsUUID('4')
  activityTypeId!: string;

  @ApiProperty({ description: 'Immobilien-UUID', format: 'uuid' })
  @IsUUID('4')
  propertyId!: string;

  @ApiProperty({ description: 'Dauer in Minuten', minimum: 1, maximum: 1440 })
  @IsInt()
  @Min(1)
  @Max(1440)
  @Type(() => Number)
  durationMin!: number;

  @ApiPropertyOptional({
    description: 'Bevorzugtes Datum (ISO 8601). Default: heute.',
    example: '2026-04-15',
  })
  @IsOptional()
  @IsDateString()
  preferredDate?: string;

  @ApiPropertyOptional({
    description: 'Maximale Anzahl Vorschläge (default 5)',
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  maxSuggestions?: number;
}

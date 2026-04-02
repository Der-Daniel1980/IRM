import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AbsenceStatus, AbsenceType } from '@prisma/client';

export class QueryAbsenceDto {
  @ApiPropertyOptional({ description: 'Filter nach Mitarbeiter-UUID' })
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiPropertyOptional({ description: 'Filter nach Abwesenheitstyp', enum: AbsenceType })
  @IsOptional()
  @IsEnum(AbsenceType)
  type?: AbsenceType;

  @ApiPropertyOptional({ description: 'Filter nach Status', enum: AbsenceStatus })
  @IsOptional()
  @IsEnum(AbsenceStatus)
  status?: AbsenceStatus;

  @ApiPropertyOptional({ description: 'Datumsbereich: von (ISO 8601 Datum)', example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Datumsbereich: bis (ISO 8601 Datum)', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Seitennummer (1-basiert)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: 'Einträge pro Seite', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

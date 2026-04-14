import { IsOptional, IsUUID, IsDateString, IsIn, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export const ROUTE_SHEET_STATUSES = ['DRAFT', 'ISSUED', 'IN_PROGRESS', 'COMPLETED'] as const;

export class QueryRouteSheetsDto {
  @ApiPropertyOptional({ description: 'Filter nach Mitarbeiter-UUID', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  staffId?: string;

  @ApiPropertyOptional({ description: 'Filter nach Datum (ISO 8601)', example: '2026-04-10' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Filter nach Status',
    enum: ROUTE_SHEET_STATUSES,
  })
  @IsOptional()
  @IsIn(ROUTE_SHEET_STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: 'Seitennummer (ab 1)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page: number = 1;

  @ApiPropertyOptional({ description: 'Einträge pro Seite', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  limit: number = 20;
}

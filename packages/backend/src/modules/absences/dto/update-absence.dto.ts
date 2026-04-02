import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AbsenceType } from '@prisma/client';

export class UpdateAbsenceDto {
  @ApiPropertyOptional({ description: 'Abwesenheitstyp', enum: AbsenceType })
  @IsOptional()
  @IsEnum(AbsenceType)
  type?: AbsenceType;

  @ApiPropertyOptional({ description: 'Startdatum (ISO 8601 Datum)', example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Enddatum (ISO 8601 Datum)', example: '2026-05-10' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Notizen / Begründung' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

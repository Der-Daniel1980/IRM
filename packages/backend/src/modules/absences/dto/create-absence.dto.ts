import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AbsenceType } from '@prisma/client';

export class CreateAbsenceDto {
  @ApiProperty({ description: 'Mitarbeiter-UUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  staffId!: string;

  @ApiProperty({ description: 'Abwesenheitstyp', enum: AbsenceType, example: AbsenceType.VACATION })
  @IsEnum(AbsenceType)
  type!: AbsenceType;

  @ApiProperty({ description: 'Startdatum (ISO 8601 Datum)', example: '2026-05-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'Enddatum (ISO 8601 Datum)', example: '2026-05-10' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: 'Notizen / Begründung', example: 'Geplanter Urlaub' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

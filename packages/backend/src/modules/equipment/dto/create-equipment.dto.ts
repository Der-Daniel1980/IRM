import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EquipmentCategory } from '@prisma/client';

export class CreateEquipmentDto {
  @ApiProperty({ description: 'Name des Geräts / Fahrzeugs', example: 'Großflächenmäher 1' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    enum: EquipmentCategory,
    description: 'Kategorie: MACHINE, VEHICLE, TOOL, MATERIAL',
    example: EquipmentCategory.MACHINE,
  })
  @IsEnum(EquipmentCategory)
  category!: EquipmentCategory;

  @ApiProperty({ description: 'Gerätetyp-Bezeichnung', example: 'Rasenmäher' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  equipmentType!: string;

  @ApiPropertyOptional({ description: 'Kennzeichen (nur KFZ)', example: 'B-IRM 123' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  licensePlate?: string;

  @ApiProperty({ description: 'Erfordert Führerschein', default: false })
  @IsBoolean()
  requiresLicense: boolean = false;

  @ApiPropertyOptional({ description: 'Führerscheinklasse', example: 'B' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  requiredLicenseType?: string;

  @ApiPropertyOptional({ description: 'Aktueller Standort', example: 'Depot Nord' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({
    description: 'Datum der nächsten Wartung (ISO 8601)',
    example: '2026-06-01',
  })
  @IsOptional()
  @IsDateString()
  nextMaintenance?: string;

  @ApiPropertyOptional({ description: 'Interne Notizen' })
  @IsOptional()
  @IsString()
  notes?: string;
}

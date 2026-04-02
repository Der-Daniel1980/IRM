import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UnitUsageType } from '@prisma/client';

export class CreatePropertyUnitDto {
  @ApiProperty({ description: 'Einheitennummer', example: 'WE-01' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  unitNumber!: string;

  @ApiProperty({ description: 'Etage', example: '2. OG' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  floor!: string;

  @ApiPropertyOptional({ description: 'Name des Mieters', example: 'Max Mustermann' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tenantName?: string;

  @ApiPropertyOptional({ description: 'Telefon des Mieters', example: '+49 30 12345678' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tenantPhone?: string;

  @ApiPropertyOptional({
    description: 'Nutzungsart',
    enum: UnitUsageType,
    default: UnitUsageType.RESIDENTIAL,
  })
  @IsOptional()
  @IsEnum(UnitUsageType)
  usageType?: UnitUsageType;

  @ApiPropertyOptional({ description: 'Fläche in m²', example: 75.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  areaSqm?: number;

  @ApiPropertyOptional({ description: 'Interne Notizen' })
  @IsOptional()
  @IsString()
  notes?: string;
}

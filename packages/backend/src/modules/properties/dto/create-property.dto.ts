import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  IsUUID,
  MaxLength,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyType } from '@prisma/client';

export class CreatePropertyDto {
  @ApiProperty({ description: 'Kunden-UUID', example: 'uuid-here' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ description: 'Bezeichnung der Immobilie', example: 'Wohnanlage Mitte' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: 'Straße und Hausnummer', example: 'Musterstraße 1' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  addressStreet!: string;

  @ApiProperty({ description: 'Postleitzahl', example: '10115' })
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  addressZip!: string;

  @ApiProperty({ description: 'Stadt', example: 'Berlin' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  addressCity!: string;

  @ApiPropertyOptional({ description: 'Breitengrad', example: 52.520008 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Längengrad', example: 13.404954 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Immobilientyp',
    enum: PropertyType,
    default: PropertyType.RESIDENTIAL,
  })
  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @ApiPropertyOptional({ description: 'Gesamtfläche in m²', example: 1500.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalAreaSqm?: number;

  @ApiPropertyOptional({ description: 'Grünfläche in m²', example: 300.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  greenAreaSqm?: number;

  @ApiPropertyOptional({ description: 'Anzahl der Etagen', example: 4, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  floors?: number;

  @ApiPropertyOptional({ description: 'Interne Notizen' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Zusätzliche Metadaten (JSONB)' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

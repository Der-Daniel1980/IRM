import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEmail,
  IsEnum,
  IsNumber,
  IsUUID,
  MaxLength,
  MinLength,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType } from '@prisma/client';

export class CreateStaffDto {
  @ApiProperty({ description: 'Vorname', example: 'Max' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ description: 'Nachname', example: 'Mustermann' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional({ description: 'E-Mail-Adresse (eindeutig)', example: 'max.mustermann@firma.de' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ description: 'Telefon', example: '+49 30 12345678' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Mobil', example: '+49 151 12345678' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  mobile?: string;

  @ApiPropertyOptional({ description: 'Adresse', example: 'Musterstraße 1, 12345 Berlin' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ description: 'Breitengrad (WGS84)', example: 52.52 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Längengrad (WGS84)', example: 13.405 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiProperty({
    description: 'Beschäftigungstyp',
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
    example: EmploymentType.FULL_TIME,
  })
  @IsEnum(EmploymentType)
  employmentType: EmploymentType = EmploymentType.FULL_TIME;

  @ApiPropertyOptional({ description: 'Wochenstunden', example: 40 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(168)
  weeklyHours?: number;

  @ApiPropertyOptional({ description: 'Farbe als HEX (für Kalenderdarstellung)', example: '#3B82F6', default: '#3B82F6' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Farbe muss ein gültiger HEX-Wert sein (z.B. #3B82F6)' })
  color?: string;

  @ApiPropertyOptional({ description: 'Keycloak User-UUID (optional)', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

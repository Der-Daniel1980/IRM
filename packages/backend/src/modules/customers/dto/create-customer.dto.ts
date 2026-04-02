import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEmail,
  MaxLength,
  MinLength,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({ description: 'Firmen- oder Privatname', example: 'Mustermann GmbH' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  companyName!: string;

  @ApiProperty({ description: 'Firma (true) oder Privatperson (false)', default: true })
  @IsBoolean()
  isCompany!: boolean;

  @ApiPropertyOptional({ description: 'Straße und Hausnummer', example: 'Musterstraße 1' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressStreet?: string;

  @ApiPropertyOptional({ description: 'Postleitzahl', example: '12345' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  addressZip?: string;

  @ApiPropertyOptional({ description: 'Stadt', example: 'Berlin' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  addressCity?: string;

  @ApiProperty({ description: 'Ländercode (ISO 3166-1 Alpha-2)', default: 'DE', example: 'DE' })
  @IsString()
  @Length(2, 2)
  addressCountry: string = 'DE';

  @ApiPropertyOptional({ description: 'Telefonnummer', example: '+49 30 12345678' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'E-Mail-Adresse', example: 'info@mustermann.de' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ description: 'Ansprechpartner', example: 'Max Mustermann' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactPerson?: string;

  @ApiPropertyOptional({ description: 'Interne Notizen' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Interner Kunde (z.B. eigene Objekte)', default: false })
  @IsBoolean()
  isInternal: boolean = false;
}

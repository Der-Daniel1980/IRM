import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsBoolean,
  IsOptional,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: 'Keycloak-Username (eindeutig)', example: 'max.mustermann' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  username!: string;

  @ApiProperty({ description: 'E-Mail-Adresse', example: 'max.mustermann@firma.de' })
  @IsEmail()
  email!: string;

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

  @ApiPropertyOptional({ description: 'Initialkennwort (temporär)', example: 'Temp1234!' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  initialPassword?: string;

  @ApiPropertyOptional({
    description: 'Zuzuweisende Rollen',
    example: ['irm-disponent'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @ApiPropertyOptional({ description: 'Benutzer aktiviert', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

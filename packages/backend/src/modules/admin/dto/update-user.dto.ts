import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsBoolean,
  IsOptional,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'E-Mail-Adresse', example: 'neue.email@firma.de' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Vorname', example: 'Max' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Nachname', example: 'Mustermann' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Benutzer aktiviert/deaktiviert' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class AssignRolesDto {
  @ApiPropertyOptional({
    description: 'Liste der zuzuweisenden Realm-Rollen',
    example: ['irm-disponent', 'irm-objektverwalter'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  roles!: string[];
}

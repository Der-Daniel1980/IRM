import {
  IsString,
  IsBoolean,
  IsOptional,
  IsObject,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFormulaDto {
  @ApiProperty({
    description: 'Name der Formel',
    example: 'Rasenmähen Zeitberechnung',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiProperty({
    description: 'UUID der zugehörigen Tätigkeit',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  activityTypeId!: string;

  @ApiProperty({
    description: 'Formel-Ausdruck mit Variablen in geschweiften Klammern',
    example: '({green_area_sqm} / {mow_rate_sqm_per_hour} * 60) + {setup_time_min}',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  formulaExpression!: string;

  @ApiProperty({
    description: 'Variablen-Definitionen als Objekt',
    example: {
      green_area_sqm: {
        label: 'Grünfläche (m²)',
        source: 'property.green_area_sqm',
        type: 'number',
      },
      mow_rate_sqm_per_hour: {
        label: 'Mähleistung (m²/h)',
        type: 'number',
        default: 500,
      },
    },
  })
  @IsObject()
  variables!: Record<
    string,
    {
      label: string;
      type: string;
      source?: string;
      default?: number;
    }
  >;

  @ApiPropertyOptional({
    description: 'Standard-Werte für Variablen',
    example: { mow_rate_sqm_per_hour: 500, setup_time_min: 15 },
  })
  @IsOptional()
  @IsObject()
  defaultValues?: Record<string, number>;

  @ApiPropertyOptional({ description: 'Beschreibung der Formel' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Formel aktiv', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import { IsObject, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CalculateFormulaDto {
  @ApiProperty({ description: 'UUID der Formel' })
  @IsUUID('4')
  formulaId!: string;

  @ApiPropertyOptional({ description: 'UUID der Immobilie (für automatische Variablenbefüllung)' })
  @IsOptional()
  @IsUUID('4')
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Manuelle Überschreibungen von Variablen-Werten',
    example: { mow_rate_sqm_per_hour: 600, setup_time_min: 20 },
  })
  @IsOptional()
  @IsObject()
  overrides?: Record<string, number>;
}

export interface CalculateFormulaResult {
  result: number;
  unit: string;
  usedValues: Record<string, number>;
  expression: string;
}

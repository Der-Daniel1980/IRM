import {
  IsUUID,
  IsOptional,
  IsDateString,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRouteSheetDto {
  @ApiProperty({ description: 'Mitarbeiter-UUID', format: 'uuid' })
  @IsUUID('4')
  staffId!: string;

  @ApiPropertyOptional({
    description: 'Fahrzeug/KFZ-UUID (Equipment mit Kategorie VEHICLE)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  vehicleId?: string;

  @ApiProperty({
    description: 'Datum des Laufzettels (ISO 8601)',
    example: '2026-04-10',
  })
  @IsDateString()
  date!: string;

  @ApiProperty({
    description: 'Auftrags-UUIDs in gewünschter Reihenfolge',
    type: [String],
    format: 'uuid',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  workOrderIds!: string[];
}

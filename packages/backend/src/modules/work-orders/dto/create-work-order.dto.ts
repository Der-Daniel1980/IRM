import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsArray,
  IsUUID,
  IsDateString,
  MaxLength,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export const WORK_ORDER_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type WorkOrderPriorityType = (typeof WORK_ORDER_PRIORITIES)[number];

export class CreateWorkOrderDto {
  @ApiProperty({ description: 'Immobilien-UUID', format: 'uuid' })
  @IsUUID('4')
  propertyId!: string;

  @ApiProperty({ description: 'Tätigkeitstyp-UUID', format: 'uuid' })
  @IsUUID('4')
  activityTypeId!: string;

  @ApiProperty({ description: 'Titel des Auftrags', example: 'Rasenmähen Frühjahr 2026' })
  @IsString()
  @MinLength(1)
  @MaxLength(250)
  title!: string;

  @ApiPropertyOptional({ description: 'Beschreibung / Details' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Priorität',
    enum: WORK_ORDER_PRIORITIES,
    default: 'NORMAL',
  })
  @IsOptional()
  @IsIn(WORK_ORDER_PRIORITIES)
  priority?: WorkOrderPriorityType;

  @ApiPropertyOptional({ description: 'Geplantes Datum (ISO 8601)', example: '2026-04-15' })
  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @ApiPropertyOptional({
    description: 'Geplante Startzeit (HH:MM)',
    example: '08:00',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  plannedStartTime?: string;

  @ApiPropertyOptional({
    description: 'Geplante Dauer in Minuten (optional — wird sonst per Formel berechnet)',
    minimum: 1,
    maximum: 1440,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  @Type(() => Number)
  plannedDurationMin?: number;

  @ApiPropertyOptional({
    description: 'Zugewiesene Mitarbeiter (UUID[])',
    type: [String],
    format: 'uuid',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assignedStaff?: string[];

  @ApiPropertyOptional({
    description: 'Zugewiesene Geräte (UUID[])',
    type: [String],
    format: 'uuid',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assignedEquipment?: string[];

  @ApiPropertyOptional({ description: 'Interne Notizen zum Auftrag' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

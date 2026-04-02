import {
  IsUUID,
  IsOptional,
  IsArray,
  IsIn,
  ArrayMinSize,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const ROUTE_SHEET_STATUSES = ['DRAFT', 'ISSUED', 'IN_PROGRESS', 'COMPLETED'] as const;
export type RouteSheetStatusType = (typeof ROUTE_SHEET_STATUSES)[number];

export class UpdateRouteSheetDto {
  @ApiPropertyOptional({
    description: 'Fahrzeug/KFZ-UUID (null = kein Fahrzeug)',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  vehicleId?: string | null;

  @ApiPropertyOptional({
    description: 'Auftrags-UUIDs in neuer Reihenfolge (ersetzt komplette Reihenfolge)',
    type: [String],
    format: 'uuid',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  workOrderIds?: string[];

  @ApiPropertyOptional({
    description: 'Neuer Status',
    enum: ROUTE_SHEET_STATUSES,
  })
  @IsOptional()
  @IsIn(ROUTE_SHEET_STATUSES)
  status?: RouteSheetStatusType;
}

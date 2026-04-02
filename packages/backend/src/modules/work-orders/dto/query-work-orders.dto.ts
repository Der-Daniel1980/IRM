import {
  IsOptional,
  IsString,
  IsIn,
  IsInt,
  IsUUID,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { WORK_ORDER_STATUSES, WorkOrderStatusType } from './update-work-order.dto';
import { WORK_ORDER_PRIORITIES, WorkOrderPriorityType } from './create-work-order.dto';

export class QueryWorkOrdersDto {
  @ApiPropertyOptional({
    description: 'Filter nach Status',
    enum: WORK_ORDER_STATUSES,
  })
  @IsOptional()
  @IsIn(WORK_ORDER_STATUSES)
  status?: WorkOrderStatusType;

  @ApiPropertyOptional({ description: 'Filter nach Immobilie (UUID)', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Filter nach zugewiesenem Mitarbeiter (UUID)', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  assignedStaffId?: string;

  @ApiPropertyOptional({ description: 'Filter nach Tätigkeit (UUID)', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  activityTypeId?: string;

  @ApiPropertyOptional({
    description: 'Filter nach Priorität',
    enum: WORK_ORDER_PRIORITIES,
  })
  @IsOptional()
  @IsIn(WORK_ORDER_PRIORITIES)
  priority?: WorkOrderPriorityType;

  @ApiPropertyOptional({
    description: 'Geplantes Datum ab (ISO 8601)',
    example: '2026-04-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Geplantes Datum bis (ISO 8601)',
    example: '2026-04-30',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Freitextsuche in Titel, Auftragsnummer' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Seitennummer (ab 1)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page: number = 1;

  @ApiPropertyOptional({ description: 'Einträge pro Seite', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit: number = 20;
}

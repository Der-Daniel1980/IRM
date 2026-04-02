import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateWorkOrderDto } from './create-work-order.dto';

export const WORK_ORDER_STATUSES = [
  'DRAFT',
  'PLANNED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export type WorkOrderStatusType = (typeof WORK_ORDER_STATUSES)[number];

export class UpdateWorkOrderDto extends PartialType(CreateWorkOrderDto) {
  @ApiPropertyOptional({
    description: 'Auftragsstatus',
    enum: WORK_ORDER_STATUSES,
  })
  @IsOptional()
  @IsIn(WORK_ORDER_STATUSES)
  status?: WorkOrderStatusType;

  @ApiPropertyOptional({ description: 'Abschlussnotizen' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  completionNotes?: string;
}

import { PartialType } from '@nestjs/mapped-types';
import { CreateStaffDto } from './create-staff.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStaffDto extends PartialType(CreateStaffDto) {
  @ApiPropertyOptional({ description: 'Mitarbeiterstatus (aktiv/inaktiv)', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreatePropertyDto } from './create-property.dto';

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {
  @ApiPropertyOptional({ description: 'Immobilienstatus (aktiv/inaktiv)', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

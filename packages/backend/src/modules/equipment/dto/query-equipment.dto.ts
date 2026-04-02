import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EquipmentCategory, EquipmentStatus } from '@prisma/client';

export class QueryEquipmentDto {
  @ApiPropertyOptional({ description: 'Volltextsuche über Name, Gerätetyp, GER-Nummer' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: EquipmentCategory,
    description: 'Filter nach Kategorie',
  })
  @IsOptional()
  @IsEnum(EquipmentCategory)
  category?: EquipmentCategory;

  @ApiPropertyOptional({
    enum: EquipmentStatus,
    description: 'Filter nach Status',
  })
  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @ApiPropertyOptional({ description: 'Seitennummer (1-basiert)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Einträge pro Seite',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

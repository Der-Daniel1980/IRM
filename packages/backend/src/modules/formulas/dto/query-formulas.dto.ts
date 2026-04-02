import { IsBoolean, IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class QueryFormulasDto {
  @ApiPropertyOptional({ description: 'Filter nach Tätigkeits-UUID' })
  @IsOptional()
  @IsUUID('4')
  activityTypeId?: string;

  @ApiPropertyOptional({ description: 'Filter nach Aktivstatus' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Seitennummer', default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Einträge pro Seite',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit: number = 20;
}

import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  IsEnum,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType } from '@prisma/client';

export class QueryStaffDto {
  @ApiPropertyOptional({ description: 'Volltextsuche über Name, Nummer, E-Mail', example: 'Mustermann' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter nach Aktivstatus', default: true })
  @IsOptional()
  @Transform(({ value }: { value: string }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter nach Beschäftigungstyp', enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ description: 'Filter nach Fähigkeits-UUID', example: 'a1b2c3d4-...' })
  @IsOptional()
  @IsUUID()
  skillId?: string;

  @ApiPropertyOptional({ description: 'Seitennummer (1-basiert)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: 'Einträge pro Seite', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

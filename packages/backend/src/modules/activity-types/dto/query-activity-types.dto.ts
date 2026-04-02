import { IsOptional, IsString, IsBoolean, IsInt, Min, Max, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class QueryActivityTypesDto {
  @ApiPropertyOptional({ description: 'Freitextsuche in Name, Code, Beschreibung' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter nach Kategorie', example: 'Garten' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ description: 'Filter nach aktivem Status' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: string }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;

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

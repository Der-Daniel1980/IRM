import { IsOptional, IsString, IsBoolean, IsInt, Min, Max, IsEnum, IsUUID } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyType } from '@prisma/client';

export class QueryPropertiesDto {
  @ApiPropertyOptional({
    description: 'Volltextsuche über Name, Adresse und Objektnummer',
    example: 'Mitte',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtert nach Kunden-UUID',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filtert nach Immobilientyp',
    enum: PropertyType,
  })
  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @ApiPropertyOptional({
    description: 'Filtert nach Stadt',
    example: 'Berlin',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Nur aktive (true) oder inaktive (false) Immobilien anzeigen',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: string }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

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

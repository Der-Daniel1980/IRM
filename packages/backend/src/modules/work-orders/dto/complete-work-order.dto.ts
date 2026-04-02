import { IsOptional, IsString, IsInt, MaxLength, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CompleteWorkOrderDto {
  @ApiPropertyOptional({ description: 'Abschlussnotizen / Bemerkungen' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  completionNotes?: string;

  @ApiPropertyOptional({
    description: 'Tatsächliche Dauer in Minuten (wenn nicht automatisch berechnet)',
    minimum: 1,
    maximum: 1440,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  @Type(() => Number)
  actualDurationMin?: number;
}

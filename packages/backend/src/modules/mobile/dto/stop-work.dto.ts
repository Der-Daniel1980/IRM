import { IsOptional, IsString, IsInt, Min, Max, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class StopWorkDto {
  @ApiPropertyOptional({ description: 'Abschlussnotizen', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  completionNotes?: string;

  @ApiPropertyOptional({
    description: 'Tatsächliche Dauer in Minuten (wird automatisch berechnet falls leer)',
    minimum: 1,
    maximum: 1440,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  actualDurationMin?: number;
}

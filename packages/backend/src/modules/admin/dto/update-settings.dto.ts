import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsPositive,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    description: 'Arbeitsbeginn (HH:MM)',
    example: '07:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Format muss HH:MM sein (z.B. 07:00)' })
  workDayStart?: string;

  @ApiPropertyOptional({
    description: 'Arbeitsende (HH:MM)',
    example: '17:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Format muss HH:MM sein (z.B. 17:00)' })
  workDayEnd?: string;

  @ApiPropertyOptional({
    description: 'Pufferzeit zwischen Aufträgen in Minuten',
    example: 15,
    minimum: 0,
    maximum: 120,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  bufferBetweenOrdersMin?: number;

  @ApiPropertyOptional({ description: 'Firmenname', example: 'IRM GmbH' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({
    description: 'Firmenanschrift',
    example: 'Musterstraße 1, 37073 Göttingen',
  })
  @IsOptional()
  @IsString()
  companyAddress?: string;

  @ApiPropertyOptional({
    description: 'Standard-Mähleistung in qm/Stunde',
    example: 500,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  defaultMowRateSqmPerHour?: number;

  @ApiPropertyOptional({
    description: 'Standard-Räumleistung in qm/Stunde',
    example: 200,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  defaultClearRateSqmPerHour?: number;
}

import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsIn,
  IsArray,
  IsUUID,
  MaxLength,
  MinLength,
  Min,
  Max,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export const RECURRENCE_INTERVALS = [
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'SEASONAL',
] as const;

export type RecurrenceInterval = (typeof RECURRENCE_INTERVALS)[number];

export class CreateActivityTypeDto {
  @ApiProperty({ description: 'Eindeutiger Code der Tätigkeit', example: 'RASEN' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;

  @ApiProperty({ description: 'Name der Tätigkeit', example: 'Rasenmähen' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ description: 'Kategorie der Tätigkeit', example: 'Garten' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  category!: string;

  @ApiPropertyOptional({ description: 'Beschreibung der Tätigkeit' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Standarddauer in Minuten', default: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  @Type(() => Number)
  defaultDurationMin?: number;

  @ApiPropertyOptional({ description: 'Wiederkehrende Tätigkeit', default: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'Wiederholungsintervall',
    enum: RECURRENCE_INTERVALS,
    nullable: true,
  })
  @IsOptional()
  @IsIn(RECURRENCE_INTERVALS)
  recurrenceInterval?: RecurrenceInterval | null;

  @ApiPropertyOptional({ description: 'Saisonbeginn (Monat 1-12)', minimum: 1, maximum: 12 })
  @ValidateIf((o: CreateActivityTypeDto) => o.isRecurring === true && o.recurrenceInterval === 'SEASONAL')
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  seasonStart?: number | null;

  @ApiPropertyOptional({ description: 'Saisonende (Monat 1-12)', minimum: 1, maximum: 12 })
  @ValidateIf((o: CreateActivityTypeDto) => o.isRecurring === true && o.recurrenceInterval === 'SEASONAL')
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  seasonEnd?: number | null;

  @ApiPropertyOptional({ description: 'Lucide-Icon-Name', example: 'Scissors', default: 'ClipboardList' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ description: 'HEX-Farbe', example: '#22C55E', default: '#6B7280' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color muss ein gültiger HEX-Farbwert sein (z.B. #22C55E)' })
  color?: string;

  @ApiPropertyOptional({ description: 'Tätigkeit aktiv', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'IDs der erforderlichen Fähigkeiten',
    type: [String],
    format: 'uuid',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  requiredSkillIds?: string[];

  @ApiPropertyOptional({
    description: 'IDs der Standard-Ausrüstung',
    type: [String],
    format: 'uuid',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  defaultEquipmentIds?: string[];
}

import { IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AvailabilityQueryDto {
  @ApiProperty({ description: 'Mitarbeiter-UUID', format: 'uuid' })
  @IsUUID('4')
  staffId!: string;

  @ApiProperty({ description: 'Start-Datum (ISO 8601)', example: '2026-04-01' })
  @IsDateString()
  from!: string;

  @ApiProperty({ description: 'End-Datum (ISO 8601)', example: '2026-04-14' })
  @IsDateString()
  to!: string;
}

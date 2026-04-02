import { IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReplanDto {
  @ApiProperty({ description: 'Mitarbeiter-UUID der ausfällt', format: 'uuid' })
  @IsUUID('4')
  staffId!: string;

  @ApiProperty({ description: 'Beginn des Ausfallzeitraums (ISO 8601)', example: '2026-04-01' })
  @IsDateString()
  fromDate!: string;

  @ApiProperty({ description: 'Ende des Ausfallzeitraums (ISO 8601)', example: '2026-04-07' })
  @IsDateString()
  toDate!: string;
}

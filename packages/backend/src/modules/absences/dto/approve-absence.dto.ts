import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveAbsenceDto {
  @ApiPropertyOptional({ description: 'Optionale Notiz zur Genehmigung', example: 'Genehmigt' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

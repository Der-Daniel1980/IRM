import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QuerySkillsDto {
  @ApiPropertyOptional({ description: 'Filter nach Kategorie', example: 'Garten' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}

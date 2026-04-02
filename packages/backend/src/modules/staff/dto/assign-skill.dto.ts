import { IsEnum, IsOptional, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SkillLevel } from '@prisma/client';

export class AssignSkillDto {
  @ApiProperty({ description: 'Fähigkeits-UUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  skillId!: string;

  @ApiProperty({ description: 'Fähigkeitslevel', enum: SkillLevel, default: SkillLevel.BASIC })
  @IsEnum(SkillLevel)
  level: SkillLevel = SkillLevel.BASIC;

  @ApiPropertyOptional({ description: 'Zertifikat gültig bis (ISO-Datum)', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  certifiedUntil?: string;
}

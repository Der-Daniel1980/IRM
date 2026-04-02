import {
  IsString,
  IsBoolean,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSkillDto {
  @ApiProperty({ description: 'Name der Fähigkeit (eindeutig)', example: 'Rasenmähen' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Kategorie der Fähigkeit', example: 'Garten' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  category!: string;

  @ApiPropertyOptional({ description: 'Beschreibung der Fähigkeit', example: 'Rasenmähen mit Benzin- oder Elektromäher' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Erfordert Zertifizierung', default: false })
  @IsOptional()
  @IsBoolean()
  requiresCertification?: boolean;

  @ApiPropertyOptional({ description: 'Lucide-Icon-Name', example: 'Scissors', default: 'Star' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;
}

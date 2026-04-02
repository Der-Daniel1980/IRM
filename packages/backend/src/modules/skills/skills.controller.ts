import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SkillsService } from './skills.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { QuerySkillsDto } from './dto/query-skills.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Skill } from '@prisma/client';

@ApiTags('skills')
@ApiBearerAuth('keycloak-jwt')
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({ summary: 'Fähigkeiten-Katalog abrufen', description: 'Gibt alle Fähigkeiten zurück, optional gefiltert nach Kategorie.' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter nach Kategorie (z.B. Garten, Reinigung)' })
  @ApiResponse({ status: 200, description: 'Fähigkeiten-Liste erfolgreich abgerufen' })
  @ApiResponse({ status: 401, description: 'Nicht authentifiziert' })
  findAll(@Query() query: QuerySkillsDto): Promise<Skill[]> {
    return this.skillsService.findAll(query);
  }

  @Get(':id')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({ summary: 'Einzelne Fähigkeit abrufen' })
  @ApiParam({ name: 'id', description: 'Fähigkeits-UUID' })
  @ApiResponse({ status: 200, description: 'Fähigkeit erfolgreich abgerufen' })
  @ApiResponse({ status: 404, description: 'Fähigkeit nicht gefunden' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Skill> {
    return this.skillsService.findOne(id);
  }

  @Post()
  @Roles('irm-admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Neue Fähigkeit anlegen' })
  @ApiResponse({ status: 201, description: 'Fähigkeit erfolgreich angelegt' })
  @ApiResponse({ status: 400, description: 'Validierungsfehler' })
  @ApiResponse({ status: 409, description: 'Fähigkeit mit diesem Namen existiert bereits' })
  create(@Body() dto: CreateSkillDto): Promise<Skill> {
    return this.skillsService.create(dto);
  }

  @Patch(':id')
  @Roles('irm-admin')
  @ApiOperation({ summary: 'Fähigkeit aktualisieren' })
  @ApiParam({ name: 'id', description: 'Fähigkeits-UUID' })
  @ApiResponse({ status: 200, description: 'Fähigkeit erfolgreich aktualisiert' })
  @ApiResponse({ status: 400, description: 'Validierungsfehler' })
  @ApiResponse({ status: 404, description: 'Fähigkeit nicht gefunden' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSkillDto,
  ): Promise<Skill> {
    return this.skillsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('irm-admin')
  @ApiOperation({
    summary: 'Fähigkeit löschen',
    description: 'Löscht die Fähigkeit. Schlägt fehl, wenn Mitarbeiter diese Fähigkeit haben.',
  })
  @ApiParam({ name: 'id', description: 'Fähigkeits-UUID' })
  @ApiResponse({ status: 200, description: 'Fähigkeit erfolgreich gelöscht' })
  @ApiResponse({ status: 400, description: 'Fähigkeit ist Mitarbeitern zugeordnet' })
  @ApiResponse({ status: 404, description: 'Fähigkeit nicht gefunden' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<Skill> {
    return this.skillsService.remove(id);
  }
}

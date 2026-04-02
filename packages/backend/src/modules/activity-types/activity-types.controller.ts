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
import { ActivityTypesService, PaginatedActivityTypes, ActivityTypeWithRelations } from './activity-types.service';
import { CreateActivityTypeDto } from './dto/create-activity-type.dto';
import { UpdateActivityTypeDto } from './dto/update-activity-type.dto';
import { QueryActivityTypesDto } from './dto/query-activity-types.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('activity-types')
@ApiBearerAuth('keycloak-jwt')
@Controller('activity-types')
export class ActivityTypesController {
  constructor(private readonly activityTypesService: ActivityTypesService) {}

  @Get()
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({
    summary: 'Tätigkeitskatalog abrufen',
    description: 'Gibt alle Tätigkeiten zurück, paginiert und optional gefiltert.',
  })
  @ApiQuery({ name: 'search', required: false, description: 'Freitextsuche in Name, Code, Beschreibung' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter nach Kategorie' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter nach Status' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Seitennummer (ab 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Einträge pro Seite' })
  @ApiResponse({ status: 200, description: 'Tätigkeitsliste erfolgreich abgerufen' })
  @ApiResponse({ status: 401, description: 'Nicht authentifiziert' })
  findAll(@Query() query: QueryActivityTypesDto): Promise<PaginatedActivityTypes> {
    return this.activityTypesService.findAll(query);
  }

  @Get(':id')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({ summary: 'Einzelne Tätigkeit abrufen (inkl. Fähigkeiten & Ausstattung)' })
  @ApiParam({ name: 'id', description: 'Tätigkeits-UUID' })
  @ApiResponse({ status: 200, description: 'Tätigkeit erfolgreich abgerufen' })
  @ApiResponse({ status: 404, description: 'Tätigkeit nicht gefunden' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ActivityTypeWithRelations> {
    return this.activityTypesService.findOne(id);
  }

  @Post()
  @Roles('irm-admin', 'irm-disponent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Neue Tätigkeit anlegen' })
  @ApiResponse({ status: 201, description: 'Tätigkeit erfolgreich angelegt' })
  @ApiResponse({ status: 400, description: 'Validierungsfehler' })
  @ApiResponse({ status: 409, description: 'Tätigkeit mit diesem Code existiert bereits' })
  create(@Body() dto: CreateActivityTypeDto): Promise<ActivityTypeWithRelations> {
    return this.activityTypesService.create(dto);
  }

  @Patch(':id')
  @Roles('irm-admin', 'irm-disponent')
  @ApiOperation({
    summary: 'Tätigkeit aktualisieren',
    description: 'Aktualisiert Felder und ersetzt verknüpfte Fähigkeiten/Ausstattung vollständig.',
  })
  @ApiParam({ name: 'id', description: 'Tätigkeits-UUID' })
  @ApiResponse({ status: 200, description: 'Tätigkeit erfolgreich aktualisiert' })
  @ApiResponse({ status: 400, description: 'Validierungsfehler' })
  @ApiResponse({ status: 404, description: 'Tätigkeit nicht gefunden' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityTypeDto,
  ): Promise<ActivityTypeWithRelations> {
    return this.activityTypesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('irm-admin')
  @ApiOperation({
    summary: 'Tätigkeit löschen',
    description: 'Löscht die Tätigkeit. Schlägt fehl wenn aktive Aufträge damit verknüpft sind.',
  })
  @ApiParam({ name: 'id', description: 'Tätigkeits-UUID' })
  @ApiResponse({ status: 200, description: 'Tätigkeit erfolgreich gelöscht' })
  @ApiResponse({ status: 400, description: 'Tätigkeit hat aktive Aufträge' })
  @ApiResponse({ status: 404, description: 'Tätigkeit nicht gefunden' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<ActivityTypeWithRelations> {
    return this.activityTypesService.remove(id);
  }
}

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
import { EquipmentService, PaginatedEquipment } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { QueryEquipmentDto } from './dto/query-equipment.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Equipment } from '@prisma/client';

@ApiTags('equipment')
@ApiBearerAuth('keycloak-jwt')
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get('available')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({
    summary: 'Verfügbare Geräte abrufen',
    description: 'Gibt alle Geräte mit Status AVAILABLE zurück (für Auftragszuordnung).',
  })
  @ApiResponse({ status: 200, description: 'Liste der verfügbaren Geräte' })
  findAvailable(): Promise<Equipment[]> {
    return this.equipmentService.findAvailable();
  }

  @Get()
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({
    summary: 'Geräteliste abrufen',
    description: 'Gibt eine paginierte Liste aller Geräte zurück. Unterstützt Suche und Filterung.',
  })
  @ApiQuery({ name: 'search', required: false, description: 'Volltextsuche über Name, Typ, GER-Nummer, Kennzeichen' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter: MACHINE, VEHICLE, TOOL, MATERIAL' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter: AVAILABLE, IN_USE, MAINTENANCE, BROKEN' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Seitennummer (Standard: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Einträge pro Seite (Standard: 20, Max: 100)' })
  @ApiResponse({ status: 200, description: 'Geräteliste erfolgreich abgerufen' })
  @ApiResponse({ status: 401, description: 'Nicht authentifiziert' })
  @ApiResponse({ status: 403, description: 'Fehlende Berechtigung' })
  findAll(@Query() query: QueryEquipmentDto): Promise<PaginatedEquipment> {
    return this.equipmentService.findAll(query);
  }

  @Get(':id')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({ summary: 'Einzelnes Gerät abrufen' })
  @ApiParam({ name: 'id', description: 'Geräte-UUID' })
  @ApiResponse({ status: 200, description: 'Gerät erfolgreich abgerufen' })
  @ApiResponse({ status: 404, description: 'Gerät nicht gefunden' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Equipment> {
    return this.equipmentService.findOne(id);
  }

  @Post()
  @Roles('irm-admin', 'irm-disponent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Neues Gerät anlegen',
    description: 'Erstellt ein neues Gerät mit automatischer Nummernvergabe (GER-0001).',
  })
  @ApiResponse({ status: 201, description: 'Gerät erfolgreich angelegt' })
  @ApiResponse({ status: 400, description: 'Validierungsfehler' })
  @ApiResponse({ status: 409, description: 'Gerätenummer bereits vergeben' })
  create(@Body() dto: CreateEquipmentDto): Promise<Equipment> {
    return this.equipmentService.create(dto);
  }

  @Patch(':id')
  @Roles('irm-admin', 'irm-disponent')
  @ApiOperation({ summary: 'Gerät aktualisieren', description: 'Aktualisiert Stammdaten und/oder Status eines Geräts.' })
  @ApiParam({ name: 'id', description: 'Geräte-UUID' })
  @ApiResponse({ status: 200, description: 'Gerät erfolgreich aktualisiert' })
  @ApiResponse({ status: 400, description: 'Validierungsfehler' })
  @ApiResponse({ status: 404, description: 'Gerät nicht gefunden' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEquipmentDto,
  ): Promise<Equipment> {
    return this.equipmentService.update(id, dto);
  }

  @Delete(':id')
  @Roles('irm-admin')
  @ApiOperation({
    summary: 'Gerät löschen',
    description: 'Löscht ein Gerät. Nur möglich wenn Status AVAILABLE und keine aktiven Aufträge vorhanden.',
  })
  @ApiParam({ name: 'id', description: 'Geräte-UUID' })
  @ApiResponse({ status: 200, description: 'Gerät erfolgreich gelöscht' })
  @ApiResponse({ status: 400, description: 'Gerät kann nicht gelöscht werden (Status oder aktive Aufträge)' })
  @ApiResponse({ status: 404, description: 'Gerät nicht gefunden' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<Equipment> {
    return this.equipmentService.remove(id);
  }
}

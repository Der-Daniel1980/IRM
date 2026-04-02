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
import {
  PropertiesService,
  PaginatedProperties,
  PropertyWithUnits,
  GeoJsonFeatureCollection,
} from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { QueryPropertiesDto } from './dto/query-properties.dto';
import { CreatePropertyUnitDto } from './dto/create-property-unit.dto';
import { UpdatePropertyUnitDto } from './dto/update-property-unit.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Property, PropertyUnit } from '@prisma/client';

@ApiTags('properties')
@ApiBearerAuth('keycloak-jwt')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  // ─── Immobilien ──────────────────────────────────────────────────────────────

  @Get()
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({
    summary: 'Immobilienliste abrufen',
    description: 'Gibt eine paginierte Liste aller Immobilien zurück. Unterstützt Suche und Filterung.',
  })
  @ApiQuery({ name: 'search', required: false, description: 'Volltextsuche über Name, Adresse und Objektnummer' })
  @ApiQuery({ name: 'customerId', required: false, description: 'Filter nach Kunden-UUID' })
  @ApiQuery({ name: 'propertyType', required: false, description: 'Filter nach Immobilientyp' })
  @ApiQuery({ name: 'city', required: false, description: 'Filter nach Stadt' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter: aktive/inaktive Immobilien' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Seitennummer (Standard: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Einträge pro Seite (Standard: 20, Max: 100)' })
  @ApiResponse({ status: 200, description: 'Immobilienliste erfolgreich abgerufen' })
  @ApiResponse({ status: 401, description: 'Nicht authentifiziert' })
  @ApiResponse({ status: 403, description: 'Fehlende Berechtigung' })
  findAll(@Query() query: QueryPropertiesDto): Promise<PaginatedProperties> {
    return this.propertiesService.findAll(query);
  }

  @Get(':id')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({ summary: 'Einzelne Immobilie abrufen (inkl. Einheiten)' })
  @ApiParam({ name: 'id', description: 'Immobilien-UUID' })
  @ApiResponse({ status: 200, description: 'Immobilie erfolgreich abgerufen' })
  @ApiResponse({ status: 404, description: 'Immobilie nicht gefunden' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PropertyWithUnits> {
    return this.propertiesService.findOne(id);
  }

  @Post()
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Neue Immobilie anlegen',
    description: 'Erstellt eine neue Immobilie mit automatischer Objektnummernvergabe (OBJ-NNNNNNN). Wenn Koordinaten übergeben werden, wird der geo_point via PostGIS gesetzt.',
  })
  @ApiResponse({ status: 201, description: 'Immobilie erfolgreich angelegt' })
  @ApiResponse({ status: 400, description: 'Validierungsfehler' })
  @ApiResponse({ status: 409, description: 'Objektnummer bereits vergeben' })
  create(@Body() dto: CreatePropertyDto): Promise<Property> {
    return this.propertiesService.create(dto);
  }

  @Patch(':id')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter')
  @ApiOperation({ summary: 'Immobilie aktualisieren' })
  @ApiParam({ name: 'id', description: 'Immobilien-UUID' })
  @ApiResponse({ status: 200, description: 'Immobilie erfolgreich aktualisiert' })
  @ApiResponse({ status: 400, description: 'Validierungsfehler' })
  @ApiResponse({ status: 404, description: 'Immobilie nicht gefunden' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
  ): Promise<Property> {
    return this.propertiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('irm-admin', 'irm-disponent')
  @ApiOperation({
    summary: 'Immobilie deaktivieren (Soft Delete)',
    description: 'Setzt isActive=false. Immobilien werden nicht physisch gelöscht.',
  })
  @ApiParam({ name: 'id', description: 'Immobilien-UUID' })
  @ApiResponse({ status: 200, description: 'Immobilie erfolgreich deaktiviert' })
  @ApiResponse({ status: 404, description: 'Immobilie nicht gefunden' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<Property> {
    return this.propertiesService.remove(id);
  }

  // ─── Einheiten ───────────────────────────────────────────────────────────────

  @Get(':id/units')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({ summary: 'Einheiten einer Immobilie abrufen' })
  @ApiParam({ name: 'id', description: 'Immobilien-UUID' })
  @ApiResponse({ status: 200, description: 'Einheitenliste erfolgreich abgerufen' })
  @ApiResponse({ status: 404, description: 'Immobilie nicht gefunden' })
  findUnits(@Param('id', ParseUUIDPipe) id: string): Promise<PropertyUnit[]> {
    return this.propertiesService.findUnits(id);
  }

  @Post(':id/units')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Neue Einheit zur Immobilie hinzufügen' })
  @ApiParam({ name: 'id', description: 'Immobilien-UUID' })
  @ApiResponse({ status: 201, description: 'Einheit erfolgreich angelegt' })
  @ApiResponse({ status: 400, description: 'Validierungsfehler' })
  @ApiResponse({ status: 404, description: 'Immobilie nicht gefunden' })
  createUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePropertyUnitDto,
  ): Promise<PropertyUnit> {
    return this.propertiesService.createUnit(id, dto);
  }

  @Patch(':id/units/:unitId')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter')
  @ApiOperation({ summary: 'Einheit aktualisieren' })
  @ApiParam({ name: 'id', description: 'Immobilien-UUID' })
  @ApiParam({ name: 'unitId', description: 'Einheiten-UUID' })
  @ApiResponse({ status: 200, description: 'Einheit erfolgreich aktualisiert' })
  @ApiResponse({ status: 404, description: 'Einheit oder Immobilie nicht gefunden' })
  updateUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Body() dto: UpdatePropertyUnitDto,
  ): Promise<PropertyUnit> {
    return this.propertiesService.updateUnit(id, unitId, dto);
  }

  @Delete(':id/units/:unitId')
  @Roles('irm-admin', 'irm-disponent')
  @ApiOperation({ summary: 'Einheit löschen' })
  @ApiParam({ name: 'id', description: 'Immobilien-UUID' })
  @ApiParam({ name: 'unitId', description: 'Einheiten-UUID' })
  @ApiResponse({ status: 200, description: 'Einheit erfolgreich gelöscht' })
  @ApiResponse({ status: 404, description: 'Einheit oder Immobilie nicht gefunden' })
  removeUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
  ): Promise<PropertyUnit> {
    return this.propertiesService.removeUnit(id, unitId);
  }
}

// ─── Map-Controller (separater Pfad) ─────────────────────────────────────────

@ApiTags('map')
@ApiBearerAuth('keycloak-jwt')
@Controller('map')
export class MapController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get('properties')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({
    summary: 'GeoJSON aller aktiven Immobilien',
    description: 'Gibt einen GeoJSON FeatureCollection mit allen aktiven Immobilien zurück, die Koordinaten haben. Für die Leaflet-Karte.',
  })
  @ApiResponse({ status: 200, description: 'GeoJSON erfolgreich abgerufen' })
  getGeoJson(): Promise<GeoJsonFeatureCollection> {
    return this.propertiesService.getGeoJson();
  }
}

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
  Res,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiProduces,
} from '@nestjs/swagger';
import {
  RouteSheetsService,
  PaginatedRouteSheets,
  RouteSheetWithItems,
} from './route-sheets.service';
import { CreateRouteSheetDto } from './dto/create-route-sheet.dto';
import { UpdateRouteSheetDto } from './dto/update-route-sheet.dto';
import { QueryRouteSheetsDto } from './dto/query-route-sheets.dto';
import { Roles } from '../../common/decorators/roles.decorator';

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags('route-sheets')
@ApiBearerAuth('keycloak-jwt')
@Controller('route-sheets')
export class RouteSheetsController {
  constructor(private readonly routeSheetsService: RouteSheetsService) {}

  // GET /api/v1/route-sheets
  @Get()
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({
    summary: 'Laufzettel-Liste abrufen',
    description: 'Gibt alle Laufzettel zurück, paginiert und optional gefiltert.',
  })
  @ApiQuery({ name: 'staffId', required: false, description: 'Filter nach Mitarbeiter-UUID' })
  @ApiQuery({ name: 'date', required: false, description: 'Filter nach Datum (ISO 8601)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter nach Status' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Seitennummer (ab 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Einträge pro Seite' })
  @ApiResponse({ status: 200, description: 'Laufzettel-Liste erfolgreich abgerufen' })
  async findAll(@Query() query: QueryRouteSheetsDto): Promise<PaginatedRouteSheets> {
    return this.routeSheetsService.findAll(query);
  }

  // GET /api/v1/route-sheets/:id
  @Get(':id')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({
    summary: 'Einzelnen Laufzettel abrufen',
    description: 'Gibt einen Laufzettel mit allen Items (inkl. Auftrags-Details) zurück.',
  })
  @ApiParam({ name: 'id', description: 'Laufzettel-UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Laufzettel erfolgreich abgerufen' })
  @ApiResponse({ status: 404, description: 'Laufzettel nicht gefunden' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<RouteSheetWithItems> {
    return this.routeSheetsService.findOne(id);
  }

  // POST /api/v1/route-sheets
  @Post()
  @Roles('irm-admin', 'irm-disponent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Laufzettel erstellen',
    description:
      'Erstellt einen neuen Laufzettel für einen Mitarbeiter mit Aufträgen in gewünschter Reihenfolge. Fahrzeiten werden automatisch berechnet.',
  })
  @ApiResponse({ status: 201, description: 'Laufzettel erfolgreich erstellt' })
  @ApiResponse({ status: 400, description: 'Ungültige Eingabedaten' })
  @ApiResponse({ status: 404, description: 'Mitarbeiter, Fahrzeug oder Aufträge nicht gefunden' })
  async create(@Body() dto: CreateRouteSheetDto): Promise<RouteSheetWithItems> {
    return this.routeSheetsService.create(dto);
  }

  // PATCH /api/v1/route-sheets/:id
  @Patch(':id')
  @Roles('irm-admin', 'irm-disponent')
  @ApiOperation({
    summary: 'Laufzettel aktualisieren',
    description:
      'Ändert Reihenfolge, Fahrzeug oder Status eines Laufzettels. Bei neuer Reihenfolge werden Fahrzeiten neu berechnet.',
  })
  @ApiParam({ name: 'id', description: 'Laufzettel-UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Laufzettel erfolgreich aktualisiert' })
  @ApiResponse({ status: 400, description: 'Ungültiger Statusübergang oder Eingabedaten' })
  @ApiResponse({ status: 404, description: 'Laufzettel nicht gefunden' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRouteSheetDto,
  ): Promise<RouteSheetWithItems> {
    return this.routeSheetsService.update(id, dto);
  }

  // DELETE /api/v1/route-sheets/:id
  @Delete(':id')
  @Roles('irm-admin', 'irm-disponent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Laufzettel löschen',
    description: 'Löscht einen Laufzettel. Nur im Status DRAFT möglich.',
  })
  @ApiParam({ name: 'id', description: 'Laufzettel-UUID', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Laufzettel erfolgreich gelöscht' })
  @ApiResponse({ status: 400, description: 'Löschen nur im Status DRAFT möglich' })
  @ApiResponse({ status: 404, description: 'Laufzettel nicht gefunden' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.routeSheetsService.remove(id);
  }

  // GET /api/v1/route-sheets/:id/pdf
  @Get(':id/pdf')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-mitarbeiter')
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary: 'PDF generieren und herunterladen',
    description:
      'Generiert den Laufzettel als PDF (Puppeteer) und gibt ihn als Download zurück.',
  })
  @ApiParam({ name: 'id', description: 'Laufzettel-UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'PDF-Datei', content: { 'application/pdf': {} } })
  @ApiResponse({ status: 404, description: 'Laufzettel nicht gefunden' })
  async downloadPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { filePath, sheetNumber } = await this.routeSheetsService.generatePdf(id);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('PDF-Datei nicht gefunden');
    }

    const fileName = `Laufzettel_${sheetNumber}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-cache');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}

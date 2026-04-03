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
  WorkOrdersService,
  PaginatedWorkOrders,
  WorkOrderWithRelations,
  PreviousOrderInfo,
} from './work-orders.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';
import { CompleteWorkOrderDto } from './dto/complete-work-order.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

// ─── Controller ──────────────────────────────────────────────────────────────

@ApiTags('work-orders')
@ApiBearerAuth('keycloak-jwt')
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  // GET /api/v1/work-orders
  @Get()
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-mitarbeiter', 'irm-readonly')
  @ApiOperation({
    summary: 'Auftragsliste abrufen',
    description: 'Gibt alle Aufträge zurück, paginiert und optional gefiltert.',
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filter nach Status' })
  @ApiQuery({ name: 'propertyId', required: false, description: 'Filter nach Immobilie' })
  @ApiQuery({ name: 'assignedStaffId', required: false, description: 'Filter nach Mitarbeiter' })
  @ApiQuery({ name: 'activityTypeId', required: false, description: 'Filter nach Tätigkeitstyp' })
  @ApiQuery({ name: 'priority', required: false, description: 'Filter nach Priorität' })
  @ApiQuery({ name: 'from', required: false, description: 'Geplantes Datum ab (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'Geplantes Datum bis (ISO 8601)' })
  @ApiQuery({ name: 'search', required: false, description: 'Freitextsuche' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Seitennummer (ab 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Einträge pro Seite' })
  @ApiResponse({ status: 200, description: 'Auftragsliste erfolgreich abgerufen' })
  @ApiResponse({ status: 401, description: 'Nicht authentifiziert' })
  findAll(@Query() query: QueryWorkOrdersDto): Promise<PaginatedWorkOrders> {
    return this.workOrdersService.findAll(query);
  }

  // GET /api/v1/work-orders/:id
  @Get(':id')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-mitarbeiter', 'irm-readonly')
  @ApiOperation({ summary: 'Einzelnen Auftrag abrufen (inkl. Immobilie, Tätigkeit, Geräte)' })
  @ApiParam({ name: 'id', description: 'Auftrags-UUID' })
  @ApiResponse({ status: 200, description: 'Auftrag erfolgreich abgerufen' })
  @ApiResponse({ status: 404, description: 'Auftrag nicht gefunden' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<WorkOrderWithRelations> {
    return this.workOrdersService.findOne(id);
  }

  // GET /api/v1/work-orders/:id/previous
  @Get(':id/previous')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({
    summary: 'Vorherigen Auftrag für Zeitübernahme abrufen',
    description:
      'Gibt den letzten abgeschlossenen Auftrag mit gleicher Tätigkeit und Immobilie zurück.',
  })
  @ApiParam({ name: 'id', description: 'Auftrags-UUID' })
  @ApiResponse({ status: 200, description: 'Vorheriger Auftrag (null wenn keiner vorhanden)' })
  @ApiResponse({ status: 404, description: 'Auftrag nicht gefunden' })
  findPrevious(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreviousOrderInfo | null> {
    return this.workOrdersService.findPrevious(id);
  }

  // POST /api/v1/work-orders
  @Post()
  @Roles('irm-admin', 'irm-disponent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Neuen Auftrag anlegen',
    description:
      'Erstellt einen Auftrag. Zeitberechnung erfolgt automatisch per Formel oder Vorgängerzeit.',
  })
  @ApiResponse({ status: 201, description: 'Auftrag erfolgreich angelegt' })
  @ApiResponse({ status: 400, description: 'Validierungsfehler oder fehlende Fähigkeiten' })
  @ApiResponse({ status: 404, description: 'Immobilie oder Tätigkeit nicht gefunden' })
  create(
    @Body() dto: CreateWorkOrderDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<WorkOrderWithRelations> {
    return this.workOrdersService.create(dto, user.sub);
  }

  // PATCH /api/v1/work-orders/:id
  @Patch(':id')
  @Roles('irm-admin', 'irm-disponent')
  @ApiOperation({
    summary: 'Auftrag aktualisieren',
    description: 'Aktualisiert Status, Zeiten, Mitarbeiter- und Gerätezuordnung.',
  })
  @ApiParam({ name: 'id', description: 'Auftrags-UUID' })
  @ApiResponse({ status: 200, description: 'Auftrag erfolgreich aktualisiert' })
  @ApiResponse({ status: 400, description: 'Validierungsfehler oder fehlende Fähigkeiten' })
  @ApiResponse({ status: 404, description: 'Auftrag nicht gefunden' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkOrderDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<WorkOrderWithRelations> {
    return this.workOrdersService.update(id, dto, user.sub);
  }

  // DELETE /api/v1/work-orders/:id
  @Delete(':id')
  @Roles('irm-admin', 'irm-disponent')
  @ApiOperation({
    summary: 'Auftrag löschen',
    description: 'Löscht den Auftrag. Nur im Status DRAFT möglich.',
  })
  @ApiParam({ name: 'id', description: 'Auftrags-UUID' })
  @ApiResponse({ status: 200, description: 'Auftrag erfolgreich gelöscht' })
  @ApiResponse({ status: 400, description: 'Auftrag ist nicht im DRAFT-Status' })
  @ApiResponse({ status: 404, description: 'Auftrag nicht gefunden' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<WorkOrderWithRelations> {
    return this.workOrdersService.remove(id);
  }

  // POST /api/v1/work-orders/:id/complete
  @Post(':id/complete')
  @Roles('irm-admin', 'irm-disponent', 'irm-mitarbeiter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Auftrag abschließen',
    description: 'Setzt Status auf COMPLETED und berechnet die tatsächliche Dauer.',
  })
  @ApiParam({ name: 'id', description: 'Auftrags-UUID' })
  @ApiResponse({ status: 200, description: 'Auftrag erfolgreich abgeschlossen' })
  @ApiResponse({ status: 400, description: 'Auftrag kann nicht abgeschlossen werden' })
  @ApiResponse({ status: 404, description: 'Auftrag nicht gefunden' })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteWorkOrderDto,
  ): Promise<WorkOrderWithRelations> {
    return this.workOrdersService.complete(id, dto);
  }
}

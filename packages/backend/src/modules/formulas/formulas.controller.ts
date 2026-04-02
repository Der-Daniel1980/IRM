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
  FormulasService,
  FormulaWithRelations,
  PaginatedFormulas,
} from './formulas.service';
import { CreateFormulaDto } from './dto/create-formula.dto';
import { UpdateFormulaDto } from './dto/update-formula.dto';
import { QueryFormulasDto } from './dto/query-formulas.dto';
import { CalculateFormulaDto, CalculateFormulaResult } from './dto/calculate-formula.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('formulas')
@ApiBearerAuth('keycloak-jwt')
@Controller('formulas')
export class FormulasController {
  constructor(private readonly formulasService: FormulasService) {}

  // ─── GET /formulas ─────────────────────────────────────────────────────────

  @Get()
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({
    summary: 'Formelliste abrufen',
    description: 'Gibt eine paginierte Liste aller Zeitformeln zurück. Unterstützt Filterung nach Tätigkeit und Status.',
  })
  @ApiQuery({ name: 'activityTypeId', required: false, description: 'Filter nach Tätigkeits-UUID' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter: aktive/inaktive Formeln' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Seitennummer (Standard: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Einträge pro Seite (Standard: 20, Max: 100)' })
  @ApiResponse({ status: 200, description: 'Formelliste erfolgreich abgerufen' })
  @ApiResponse({ status: 401, description: 'Nicht authentifiziert' })
  @ApiResponse({ status: 403, description: 'Fehlende Berechtigung' })
  findAll(@Query() query: QueryFormulasDto): Promise<PaginatedFormulas> {
    return this.formulasService.findAll(query);
  }

  // ─── GET /formulas/:id ─────────────────────────────────────────────────────

  @Get(':id')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({ summary: 'Einzelne Formel abrufen' })
  @ApiParam({ name: 'id', description: 'Formel-UUID' })
  @ApiResponse({ status: 200, description: 'Formel erfolgreich abgerufen' })
  @ApiResponse({ status: 404, description: 'Formel nicht gefunden' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<FormulaWithRelations> {
    return this.formulasService.findOne(id);
  }

  // ─── POST /formulas ────────────────────────────────────────────────────────

  @Post()
  @Roles('irm-admin', 'irm-disponent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Neue Formel anlegen',
    description: 'Legt eine neue Zeitformel mit Variablen und Standard-Werten an.',
  })
  @ApiResponse({ status: 201, description: 'Formel erfolgreich erstellt' })
  @ApiResponse({ status: 400, description: 'Validierungsfehler' })
  @ApiResponse({ status: 404, description: 'Tätigkeit nicht gefunden' })
  create(@Body() dto: CreateFormulaDto): Promise<FormulaWithRelations> {
    return this.formulasService.create(dto);
  }

  // ─── PATCH /formulas/:id ───────────────────────────────────────────────────

  @Patch(':id')
  @Roles('irm-admin', 'irm-disponent')
  @ApiOperation({
    summary: 'Formel aktualisieren',
    description: 'Aktualisiert eine Zeitformel. Bei Änderung von Formel-Ausdruck oder Variablen wird die Version automatisch erhöht.',
  })
  @ApiParam({ name: 'id', description: 'Formel-UUID' })
  @ApiResponse({ status: 200, description: 'Formel erfolgreich aktualisiert (version++ bei Formel/Variablen-Änderung)' })
  @ApiResponse({ status: 404, description: 'Formel oder Tätigkeit nicht gefunden' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFormulaDto,
  ): Promise<FormulaWithRelations> {
    return this.formulasService.update(id, dto);
  }

  // ─── DELETE /formulas/:id ──────────────────────────────────────────────────

  @Delete(':id')
  @Roles('irm-admin')
  @ApiOperation({ summary: 'Formel löschen' })
  @ApiParam({ name: 'id', description: 'Formel-UUID' })
  @ApiResponse({ status: 200, description: 'Formel erfolgreich gelöscht' })
  @ApiResponse({ status: 404, description: 'Formel nicht gefunden' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<FormulaWithRelations> {
    return this.formulasService.remove(id);
  }

  // ─── POST /formulas/:id/calculate ─────────────────────────────────────────

  @Post(':id/calculate')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Formel berechnen',
    description:
      'Berechnet die Dauer anhand einer Formel. Variablen werden automatisch aus Immobiliendaten befüllt (wenn propertyId angegeben). Overrides überschreiben alle anderen Werte. Kein eval() — sicherer Recursive-Descent-Parser.',
  })
  @ApiParam({ name: 'id', description: 'Formel-UUID' })
  @ApiResponse({
    status: 200,
    description: 'Berechnung erfolgreich',
    schema: {
      example: {
        result: 75,
        unit: 'minutes',
        usedValues: { green_area_sqm: 1500, mow_rate_sqm_per_hour: 500, setup_time_min: 15 },
        expression: '(1500 / 500 * 60) + 15',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Fehlende Variable oder ungültiger Ausdruck' })
  @ApiResponse({ status: 404, description: 'Formel oder Immobilie nicht gefunden' })
  calculate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CalculateFormulaDto,
  ): Promise<CalculateFormulaResult> {
    return this.formulasService.calculate(id, dto);
  }
}

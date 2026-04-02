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
import { AbsencesService, AbsenceWithStaff, PaginatedAbsences } from './absences.service';
import { CreateAbsenceDto } from './dto/create-absence.dto';
import { UpdateAbsenceDto } from './dto/update-absence.dto';
import { ApproveAbsenceDto } from './dto/approve-absence.dto';
import { RejectAbsenceDto } from './dto/reject-absence.dto';
import { QueryAbsenceDto } from './dto/query-absence.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('absences')
@ApiBearerAuth('keycloak-jwt')
@Controller('absences')
export class AbsencesController {
  constructor(private readonly absencesService: AbsencesService) {}

  // ─── Liste ────────────────────────────────────────────────────────────────

  @Get()
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-mitarbeiter', 'irm-readonly')
  @ApiOperation({
    summary: 'Abwesenheiten abrufen',
    description: 'Gibt eine paginierte Liste von Abwesenheiten zurück. Unterstützt Filterung nach Mitarbeiter, Typ, Status und Datumsbereich.',
  })
  @ApiQuery({ name: 'staffId', required: false, description: 'Filter nach Mitarbeiter-UUID' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter nach Abwesenheitstyp (VACATION|SICK|TRAINING|PERSONAL|COMP_TIME)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter nach Status (REQUESTED|APPROVED|REJECTED|CANCELLED)' })
  @ApiQuery({ name: 'from', required: false, description: 'Datumsbereich: von (ISO 8601)', example: '2026-01-01' })
  @ApiQuery({ name: 'to', required: false, description: 'Datumsbereich: bis (ISO 8601)', example: '2026-12-31' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Abwesenheitsliste erfolgreich abgerufen' })
  findAll(@Query() query: QueryAbsenceDto): Promise<PaginatedAbsences> {
    return this.absencesService.findAll(query);
  }

  // ─── Einzelne Abwesenheit ─────────────────────────────────────────────────

  @Get(':id')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-mitarbeiter', 'irm-readonly')
  @ApiOperation({ summary: 'Einzelne Abwesenheit abrufen' })
  @ApiParam({ name: 'id', description: 'Abwesenheits-UUID' })
  @ApiResponse({ status: 200, description: 'Abwesenheit erfolgreich abgerufen' })
  @ApiResponse({ status: 404, description: 'Abwesenheit nicht gefunden' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AbsenceWithStaff> {
    return this.absencesService.findOne(id);
  }

  // ─── Erstellen ────────────────────────────────────────────────────────────

  @Post()
  @Roles('irm-admin', 'irm-disponent', 'irm-mitarbeiter')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Abwesenheit erstellen',
    description: 'Erstellt eine neue Abwesenheit. SICK-Abwesenheiten werden automatisch genehmigt, alle anderen erhalten den Status REQUESTED.',
  })
  @ApiResponse({ status: 201, description: 'Abwesenheit erfolgreich erstellt' })
  @ApiResponse({ status: 400, description: 'Ungültige Eingabe' })
  @ApiResponse({ status: 404, description: 'Mitarbeiter nicht gefunden' })
  @ApiResponse({ status: 409, description: 'Überschneidung mit bestehender Abwesenheit' })
  create(@Body() dto: CreateAbsenceDto): Promise<AbsenceWithStaff> {
    return this.absencesService.create(dto);
  }

  // ─── Aktualisieren ────────────────────────────────────────────────────────

  @Patch(':id')
  @Roles('irm-admin', 'irm-disponent', 'irm-mitarbeiter')
  @ApiOperation({
    summary: 'Abwesenheit aktualisieren',
    description: 'Ändert Datum oder Typ einer Abwesenheit. Nur möglich wenn Status REQUESTED ist.',
  })
  @ApiParam({ name: 'id', description: 'Abwesenheits-UUID' })
  @ApiResponse({ status: 200, description: 'Abwesenheit erfolgreich aktualisiert' })
  @ApiResponse({ status: 400, description: 'Abwesenheit kann nicht geändert werden (falscher Status)' })
  @ApiResponse({ status: 404, description: 'Abwesenheit nicht gefunden' })
  @ApiResponse({ status: 409, description: 'Überschneidung mit bestehender Abwesenheit' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAbsenceDto,
  ): Promise<AbsenceWithStaff> {
    return this.absencesService.update(id, dto);
  }

  // ─── Stornieren ───────────────────────────────────────────────────────────

  @Delete(':id')
  @Roles('irm-admin', 'irm-disponent', 'irm-mitarbeiter')
  @ApiOperation({
    summary: 'Abwesenheit stornieren',
    description: 'Setzt den Status auf CANCELLED (Soft-Delete). Abwesenheiten werden nicht physisch gelöscht.',
  })
  @ApiParam({ name: 'id', description: 'Abwesenheits-UUID' })
  @ApiResponse({ status: 200, description: 'Abwesenheit erfolgreich storniert' })
  @ApiResponse({ status: 400, description: 'Abwesenheit kann nicht storniert werden' })
  @ApiResponse({ status: 404, description: 'Abwesenheit nicht gefunden' })
  cancel(@Param('id', ParseUUIDPipe) id: string): Promise<AbsenceWithStaff> {
    return this.absencesService.cancel(id);
  }

  // ─── Genehmigen ───────────────────────────────────────────────────────────

  @Post(':id/approve')
  @Roles('irm-admin', 'irm-disponent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Abwesenheit genehmigen',
    description: 'Genehmigt eine Abwesenheit mit Status REQUESTED. Nur für Disponenten und Admins.',
  })
  @ApiParam({ name: 'id', description: 'Abwesenheits-UUID' })
  @ApiResponse({ status: 200, description: 'Abwesenheit erfolgreich genehmigt' })
  @ApiResponse({ status: 400, description: 'Abwesenheit kann nicht genehmigt werden (falscher Status)' })
  @ApiResponse({ status: 404, description: 'Abwesenheit nicht gefunden' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveAbsenceDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<AbsenceWithStaff> {
    return this.absencesService.approve(id, currentUser.sub, dto);
  }

  // ─── Ablehnen ─────────────────────────────────────────────────────────────

  @Post(':id/reject')
  @Roles('irm-admin', 'irm-disponent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Abwesenheit ablehnen',
    description: 'Lehnt eine Abwesenheit mit Status REQUESTED ab. Nur für Disponenten und Admins.',
  })
  @ApiParam({ name: 'id', description: 'Abwesenheits-UUID' })
  @ApiResponse({ status: 200, description: 'Abwesenheit erfolgreich abgelehnt' })
  @ApiResponse({ status: 400, description: 'Abwesenheit kann nicht abgelehnt werden (falscher Status)' })
  @ApiResponse({ status: 404, description: 'Abwesenheit nicht gefunden' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectAbsenceDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<AbsenceWithStaff> {
    return this.absencesService.reject(id, currentUser.sub, dto);
  }
}

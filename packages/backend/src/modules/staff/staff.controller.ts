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
import { StaffService, PaginatedStaff, StaffWithSkills, StaffCalendar } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { QueryStaffDto } from './dto/query-staff.dto';
import { AssignSkillDto } from './dto/assign-skill.dto';
import { QueryCalendarDto } from './dto/query-calendar.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Staff } from '@prisma/client';

@ApiTags('staff')
@ApiBearerAuth('keycloak-jwt')
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({ summary: 'Personalliste abrufen', description: 'Gibt eine paginierte Liste aller Mitarbeiter zurück. Unterstützt Suche und Filterung nach Fähigkeit.' })
  @ApiQuery({ name: 'search', required: false, description: 'Suche nach Name, Personalnummer, E-Mail' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter: aktive/inaktive Mitarbeiter' })
  @ApiQuery({ name: 'employmentType', required: false, description: 'Filter: Beschäftigungstyp' })
  @ApiQuery({ name: 'skillId', required: false, description: 'Filter: nur Mitarbeiter mit dieser Fähigkeit' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Personalliste erfolgreich abgerufen' })
  findAll(@Query() query: QueryStaffDto): Promise<PaginatedStaff> {
    return this.staffService.findAll(query);
  }

  @Get(':id')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({ summary: 'Einzelnen Mitarbeiter abrufen', description: 'Gibt den Mitarbeiter mit Fähigkeiten und heutigen Abwesenheiten zurück.' })
  @ApiParam({ name: 'id', description: 'Mitarbeiter-UUID' })
  @ApiResponse({ status: 200, description: 'Mitarbeiter erfolgreich abgerufen' })
  @ApiResponse({ status: 404, description: 'Mitarbeiter nicht gefunden' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<StaffWithSkills> {
    return this.staffService.findOne(id);
  }

  @Post()
  @Roles('irm-admin', 'irm-disponent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Neuen Mitarbeiter anlegen', description: 'Erstellt einen neuen Mitarbeiter mit automatischer Personalnummernvergabe (MA-NNNN).' })
  @ApiResponse({ status: 201, description: 'Mitarbeiter erfolgreich angelegt' })
  @ApiResponse({ status: 400, description: 'Validierungsfehler' })
  @ApiResponse({ status: 409, description: 'E-Mail-Adresse bereits vergeben' })
  create(@Body() dto: CreateStaffDto): Promise<Staff> {
    return this.staffService.create(dto);
  }

  @Patch(':id')
  @Roles('irm-admin', 'irm-disponent')
  @ApiOperation({ summary: 'Mitarbeiter aktualisieren' })
  @ApiParam({ name: 'id', description: 'Mitarbeiter-UUID' })
  @ApiResponse({ status: 200, description: 'Mitarbeiter erfolgreich aktualisiert' })
  @ApiResponse({ status: 400, description: 'Validierungsfehler' })
  @ApiResponse({ status: 404, description: 'Mitarbeiter nicht gefunden' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
  ): Promise<Staff> {
    return this.staffService.update(id, dto);
  }

  @Delete(':id')
  @Roles('irm-admin', 'irm-disponent')
  @ApiOperation({ summary: 'Mitarbeiter deaktivieren (Soft Delete)', description: 'Setzt isActive=false. Mitarbeiter werden nicht physisch gelöscht.' })
  @ApiParam({ name: 'id', description: 'Mitarbeiter-UUID' })
  @ApiResponse({ status: 200, description: 'Mitarbeiter erfolgreich deaktiviert' })
  @ApiResponse({ status: 404, description: 'Mitarbeiter nicht gefunden' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<Staff> {
    return this.staffService.remove(id);
  }

  @Post(':id/skills')
  @Roles('irm-admin', 'irm-disponent')
  @ApiOperation({ summary: 'Fähigkeit zuordnen', description: 'Ordnet dem Mitarbeiter eine Fähigkeit zu. Wenn die Fähigkeit bereits zugeordnet ist, wird sie aktualisiert (upsert).' })
  @ApiParam({ name: 'id', description: 'Mitarbeiter-UUID' })
  @ApiResponse({ status: 201, description: 'Fähigkeit erfolgreich zugeordnet' })
  @ApiResponse({ status: 404, description: 'Mitarbeiter oder Fähigkeit nicht gefunden' })
  @HttpCode(HttpStatus.CREATED)
  assignSkill(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSkillDto,
  ): Promise<StaffWithSkills> {
    return this.staffService.assignSkill(id, dto);
  }

  @Delete(':id/skills/:skillId')
  @Roles('irm-admin', 'irm-disponent')
  @ApiOperation({ summary: 'Fähigkeit entfernen', description: 'Entfernt eine Fähigkeit vom Mitarbeiter.' })
  @ApiParam({ name: 'id', description: 'Mitarbeiter-UUID' })
  @ApiParam({ name: 'skillId', description: 'Fähigkeits-UUID' })
  @ApiResponse({ status: 200, description: 'Fähigkeit erfolgreich entfernt' })
  @ApiResponse({ status: 404, description: 'Mitarbeiter oder Fähigkeitszuordnung nicht gefunden' })
  removeSkill(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
  ): Promise<StaffWithSkills> {
    return this.staffService.removeSkill(id, skillId);
  }

  @Get(':id/calendar')
  @Roles('irm-admin', 'irm-disponent', 'irm-objektverwalter', 'irm-readonly')
  @ApiOperation({ summary: 'Mitarbeiter-Kalender abrufen', description: 'Gibt Abwesenheiten und Aufträge für einen Datumsbereich zurück.' })
  @ApiParam({ name: 'id', description: 'Mitarbeiter-UUID' })
  @ApiQuery({ name: 'from', required: true, description: 'Startdatum (ISO-Datum, z.B. 2026-04-01)' })
  @ApiQuery({ name: 'to', required: true, description: 'Enddatum (ISO-Datum, z.B. 2026-04-30)' })
  @ApiResponse({ status: 200, description: 'Kalender erfolgreich abgerufen' })
  @ApiResponse({ status: 404, description: 'Mitarbeiter nicht gefunden' })
  getCalendar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryCalendarDto,
  ): Promise<StaffCalendar> {
    return this.staffService.getCalendar(id, query);
  }
}

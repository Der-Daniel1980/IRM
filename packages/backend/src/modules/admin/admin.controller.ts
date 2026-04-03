import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AdminService, KeycloakUser, KeycloakRole, SystemSettings } from './admin.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, AssignRolesDto } from './dto/update-user.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('admin')
@ApiBearerAuth('keycloak-jwt')
@Roles('irm-admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── Benutzer ────────────────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({
    summary: 'Alle Benutzer abrufen',
    description: 'Gibt alle Keycloak-Benutzer des IRM-Realms inkl. Rollen zurück.',
  })
  @ApiResponse({ status: 200, description: 'Benutzerliste erfolgreich abgerufen' })
  @ApiResponse({ status: 401, description: 'Nicht authentifiziert' })
  @ApiResponse({ status: 403, description: 'Fehlende Berechtigung (irm-admin erforderlich)' })
  @ApiResponse({ status: 503, description: 'Keycloak nicht erreichbar' })
  findAllUsers(): Promise<KeycloakUser[]> {
    return this.adminService.findAllUsers();
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Einzelnen Benutzer abrufen' })
  @ApiParam({ name: 'id', description: 'Keycloak-User-UUID' })
  @ApiResponse({ status: 200, description: 'Benutzer erfolgreich abgerufen' })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  findUserById(@Param('id') id: string): Promise<KeycloakUser> {
    return this.adminService.findUserById(id);
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Neuen Benutzer erstellen',
    description: 'Legt einen neuen Benutzer in Keycloak an und weist optional Rollen zu.',
  })
  @ApiResponse({ status: 201, description: 'Benutzer erfolgreich erstellt' })
  @ApiResponse({ status: 409, description: 'Benutzername bereits vergeben' })
  createUser(@Body() dto: CreateUserDto): Promise<KeycloakUser> {
    return this.adminService.createUser(dto);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Benutzer bearbeiten' })
  @ApiParam({ name: 'id', description: 'Keycloak-User-UUID' })
  @ApiResponse({ status: 200, description: 'Benutzer erfolgreich aktualisiert' })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<KeycloakUser> {
    return this.adminService.updateUser(id, dto);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Benutzer deaktivieren',
    description: 'Deaktiviert einen Benutzer in Keycloak (kein Löschen).',
  })
  @ApiParam({ name: 'id', description: 'Keycloak-User-UUID' })
  @ApiResponse({ status: 200, description: 'Benutzer erfolgreich deaktiviert' })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  deactivateUser(@Param('id') id: string): Promise<KeycloakUser> {
    return this.adminService.deactivateUser(id);
  }

  @Post('users/:id/roles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rollen zuweisen',
    description:
      'Ersetzt alle IRM-Rollen des Benutzers durch die angegebenen Rollen. Nicht-IRM-Rollen werden nicht verändert.',
  })
  @ApiParam({ name: 'id', description: 'Keycloak-User-UUID' })
  @ApiResponse({ status: 200, description: 'Rollen erfolgreich zugewiesen' })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  assignRoles(
    @Param('id') id: string,
    @Body() dto: AssignRolesDto,
  ): Promise<KeycloakUser> {
    return this.adminService.assignRolesToUser(id, dto);
  }

  // ─── Rollen ──────────────────────────────────────────────────────────────────

  @Get('roles')
  @ApiOperation({
    summary: 'Alle Realm-Rollen abrufen',
    description: 'Gibt alle im IRM-Realm konfigurierten Keycloak-Rollen zurück.',
  })
  @ApiResponse({ status: 200, description: 'Rollenliste erfolgreich abgerufen' })
  findAllRoles(): Promise<KeycloakRole[]> {
    return this.adminService.findAllRoles();
  }

  // ─── Systemeinstellungen ─────────────────────────────────────────────────────

  @Get('settings')
  @ApiOperation({
    summary: 'Systemeinstellungen lesen',
    description: 'Gibt die aktuellen globalen Systemeinstellungen zurück.',
  })
  @ApiResponse({ status: 200, description: 'Einstellungen erfolgreich abgerufen' })
  getSettings(): Promise<SystemSettings> {
    return this.adminService.getSettings();
  }

  @Patch('settings')
  @ApiOperation({
    summary: 'Systemeinstellungen speichern',
    description: 'Aktualisiert die globalen Systemeinstellungen (partielle Updates möglich).',
  })
  @ApiResponse({ status: 200, description: 'Einstellungen erfolgreich gespeichert' })
  updateSettings(@Body() dto: UpdateSettingsDto): Promise<SystemSettings> {
    return this.adminService.updateSettings(dto);
  }

  // ─── Datenbank-Backup ─────────────────────────────────────────────────────

  @Post('backup')
  @Roles('irm-admin')
  @ApiOperation({ summary: 'Datenbank-Backup herunterladen' })
  @ApiResponse({ status: 200, description: 'SQL-Dump als Datei-Download' })
  @ApiResponse({ status: 500, description: 'pg_dump nicht verfügbar oder Backup fehlgeschlagen' })
  async downloadBackup(@Res() res: Response): Promise<void> {
    const sql = await this.adminService.createDatabaseBackup();
    const filename = `irm-backup-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.sql`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(sql);
  }

  // ─── Demo-Daten ────────────────────────────────────────────────────────────

  @Roles('irm-admin')
  @Post('seed-demo')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Demo-Daten anlegen',
    description:
      'Legt idempotent Demo-Kunden, -Immobilien und -Mitarbeiter an. Nur in APP_ENV=development verfügbar.',
  })
  @ApiResponse({
    status: 201,
    description: 'Demo-Daten erfolgreich angelegt',
    schema: {
      example: {
        message: 'Demo-Daten angelegt',
        created: { customers: 3, properties: 3, staff: 3 },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Nur in Development-Umgebung erlaubt' })
  seedDemo(): Promise<{ message: string; created: { customers: number; properties: number; staff: number } }> {
    return this.adminService.seedDemo();
  }

  @Roles('irm-admin')
  @Delete('seed-demo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Demo-Daten löschen',
    description:
      'Löscht alle Demo-Datensätze (Präfix K-DEM, OBJ-DEM, MA-DEM) inkl. abhängiger Datensätze. Nur in APP_ENV=development verfügbar.',
  })
  @ApiResponse({
    status: 200,
    description: 'Demo-Daten erfolgreich gelöscht',
    schema: {
      example: {
        message: 'Demo-Daten gelöscht',
        deleted: { customers: 3, properties: 3, staff: 3 },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Nur in Development-Umgebung erlaubt' })
  deleteSeedDemo(): Promise<{ message: string; deleted: { customers: number; properties: number; staff: number } }> {
    return this.adminService.deleteSeedDemo();
  }
}

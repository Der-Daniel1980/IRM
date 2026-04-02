import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, AssignRolesDto } from './dto/update-user.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface KeycloakUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  emailVerified: boolean;
  createdTimestamp: number;
  realmRoles?: string[];
}

export interface KeycloakRole {
  id: string;
  name: string;
  description?: string;
  composite: boolean;
  clientRole: boolean;
  containerId: string;
}

export interface SystemSettings {
  workDayStart: string;
  workDayEnd: string;
  bufferBetweenOrdersMin: number;
  companyName: string;
  companyAddress: string;
  defaultMowRateSqmPerHour: number;
  defaultClearRateSqmPerHour: number;
}

const DEFAULT_SETTINGS: SystemSettings = {
  workDayStart: '07:00',
  workDayEnd: '17:00',
  bufferBetweenOrdersMin: 15,
  companyName: 'IRM GmbH',
  companyAddress: 'Musterstraße 1, 37073 Göttingen',
  defaultMowRateSqmPerHour: 500,
  defaultClearRateSqmPerHour: 200,
};

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─── Keycloak Admin-Token ──────────────────────────────────────────────────

  private async getAdminToken(): Promise<string> {
    const keycloakUrl = this.config.get<string>('keycloak.url') ?? 'http://localhost:8080';
    const adminUser = process.env['KEYCLOAK_ADMIN_USER'] ?? 'admin';
    const adminPassword = process.env['KEYCLOAK_ADMIN_PASSWORD'] ?? 'admin';

    try {
      const response = await axios.post<{ access_token: string }>(
        `${keycloakUrl}/realms/master/protocol/openid-connect/token`,
        new URLSearchParams({
          grant_type: 'password',
          client_id: 'admin-cli',
          username: adminUser,
          password: adminPassword,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      return response.data.access_token;
    } catch (err) {
      this.logger.error('Keycloak Admin-Token konnte nicht abgerufen werden', err);
      throw new ServiceUnavailableException(
        'Keycloak nicht erreichbar. Bitte später erneut versuchen.',
      );
    }
  }

  private get keycloakUrl(): string {
    return this.config.get<string>('keycloak.url') ?? 'http://localhost:8080';
  }

  private get realm(): string {
    return this.config.get<string>('keycloak.realm') ?? 'irm';
  }

  private authHeader(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  // ─── User-Management ────────────────────────────────────────────────────────

  async findAllUsers(): Promise<KeycloakUser[]> {
    const token = await this.getAdminToken();
    try {
      const usersResponse = await axios.get<KeycloakUser[]>(
        `${this.keycloakUrl}/admin/realms/${this.realm}/users?max=500`,
        { headers: this.authHeader(token) },
      );

      // Rollen für jeden User abrufen und anhängen
      const usersWithRoles = await Promise.all(
        usersResponse.data.map(async (user) => {
          try {
            const rolesResponse = await axios.get<KeycloakRole[]>(
              `${this.keycloakUrl}/admin/realms/${this.realm}/users/${user.id}/role-mappings/realm`,
              { headers: this.authHeader(token) },
            );
            return {
              ...user,
              realmRoles: rolesResponse.data.map((r) => r.name),
            };
          } catch {
            return { ...user, realmRoles: [] };
          }
        }),
      );

      return usersWithRoles;
    } catch (err) {
      this.handleKeycloakError(err, 'Benutzer konnten nicht abgerufen werden');
    }
  }

  async findUserById(id: string): Promise<KeycloakUser> {
    const token = await this.getAdminToken();
    try {
      const [userResponse, rolesResponse] = await Promise.all([
        axios.get<KeycloakUser>(
          `${this.keycloakUrl}/admin/realms/${this.realm}/users/${id}`,
          { headers: this.authHeader(token) },
        ),
        axios.get<KeycloakRole[]>(
          `${this.keycloakUrl}/admin/realms/${this.realm}/users/${id}/role-mappings/realm`,
          { headers: this.authHeader(token) },
        ),
      ]);

      return {
        ...userResponse.data,
        realmRoles: rolesResponse.data.map((r) => r.name),
      };
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 404) {
        throw new NotFoundException(`Benutzer mit ID ${id} nicht gefunden`);
      }
      this.handleKeycloakError(err, 'Benutzer konnte nicht abgerufen werden');
    }
  }

  async createUser(dto: CreateUserDto): Promise<KeycloakUser> {
    const token = await this.getAdminToken();

    const keycloakPayload: Record<string, unknown> = {
      username: dto.username,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      enabled: dto.enabled ?? true,
      emailVerified: false,
    };

    if (dto.initialPassword) {
      keycloakPayload['credentials'] = [
        {
          type: 'password',
          value: dto.initialPassword,
          temporary: true,
        },
      ];
    }

    try {
      const createResponse = await axios.post(
        `${this.keycloakUrl}/admin/realms/${this.realm}/users`,
        keycloakPayload,
        { headers: this.authHeader(token) },
      );

      // Keycloak liefert die neue User-ID im Location-Header zurück
      const locationHeader = createResponse.headers['location'] as string | undefined;
      const newUserId = locationHeader?.split('/').pop();

      if (!newUserId) {
        throw new InternalServerErrorException(
          'Benutzer erstellt, aber ID konnte nicht ermittelt werden',
        );
      }

      // Rollen zuweisen, falls angegeben
      if (dto.roles && dto.roles.length > 0) {
        await this.assignRolesToUser(newUserId, { roles: dto.roles }, token);
      }

      return this.findUserById(newUserId);
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 409) {
        throw new InternalServerErrorException(
          `Benutzername "${dto.username}" ist bereits vergeben`,
        );
      }
      this.handleKeycloakError(err, 'Benutzer konnte nicht erstellt werden');
    }
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<KeycloakUser> {
    const token = await this.getAdminToken();

    const keycloakPayload: Record<string, unknown> = {};
    if (dto.email !== undefined) keycloakPayload['email'] = dto.email;
    if (dto.firstName !== undefined) keycloakPayload['firstName'] = dto.firstName;
    if (dto.lastName !== undefined) keycloakPayload['lastName'] = dto.lastName;
    if (dto.enabled !== undefined) keycloakPayload['enabled'] = dto.enabled;

    try {
      await axios.put(
        `${this.keycloakUrl}/admin/realms/${this.realm}/users/${id}`,
        keycloakPayload,
        { headers: this.authHeader(token) },
      );
      return this.findUserById(id);
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 404) {
        throw new NotFoundException(`Benutzer mit ID ${id} nicht gefunden`);
      }
      this.handleKeycloakError(err, 'Benutzer konnte nicht aktualisiert werden');
    }
  }

  async deactivateUser(id: string): Promise<KeycloakUser> {
    return this.updateUser(id, { enabled: false });
  }

  async assignRolesToUser(
    id: string,
    dto: AssignRolesDto,
    existingToken?: string,
  ): Promise<KeycloakUser> {
    const token = existingToken ?? (await this.getAdminToken());

    // Alle Realm-Rollen laden um IDs zu ermitteln
    const allRolesResponse = await axios.get<KeycloakRole[]>(
      `${this.keycloakUrl}/admin/realms/${this.realm}/roles`,
      { headers: this.authHeader(token) },
    );

    const rolesToAssign = allRolesResponse.data.filter((r) =>
      dto.roles.includes(r.name),
    );

    if (rolesToAssign.length === 0) {
      return this.findUserById(id);
    }

    // Aktuelle Rollen entfernen (nur IRM-Rollen)
    const currentRolesResponse = await axios.get<KeycloakRole[]>(
      `${this.keycloakUrl}/admin/realms/${this.realm}/users/${id}/role-mappings/realm`,
      { headers: this.authHeader(token) },
    );

    const irmRolesToRemove = currentRolesResponse.data.filter((r) =>
      r.name.startsWith('irm-'),
    );

    if (irmRolesToRemove.length > 0) {
      await axios.delete(
        `${this.keycloakUrl}/admin/realms/${this.realm}/users/${id}/role-mappings/realm`,
        {
          headers: this.authHeader(token),
          data: irmRolesToRemove,
        },
      );
    }

    // Neue Rollen zuweisen
    await axios.post(
      `${this.keycloakUrl}/admin/realms/${this.realm}/users/${id}/role-mappings/realm`,
      rolesToAssign,
      { headers: this.authHeader(token) },
    );

    return this.findUserById(id);
  }

  // ─── Rollen ─────────────────────────────────────────────────────────────────

  async findAllRoles(): Promise<KeycloakRole[]> {
    const token = await this.getAdminToken();
    try {
      const response = await axios.get<KeycloakRole[]>(
        `${this.keycloakUrl}/admin/realms/${this.realm}/roles`,
        { headers: this.authHeader(token) },
      );
      return response.data;
    } catch (err) {
      this.handleKeycloakError(err, 'Rollen konnten nicht abgerufen werden');
    }
  }

  // ─── Systemeinstellungen ────────────────────────────────────────────────────

  async ensureSettingsTable(): Promise<void> {
    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        settings JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await this.prisma.$executeRaw`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'one_row' AND table_name = 'system_settings'
        ) THEN
          ALTER TABLE system_settings ADD CONSTRAINT one_row CHECK (id = 1);
        END IF;
      END$$
    `;
    // Sicherstellen, dass die Standardzeile existiert
    await this.prisma.$executeRaw`
      INSERT INTO system_settings (id, settings)
      VALUES (1, ${JSON.stringify(DEFAULT_SETTINGS)}::jsonb)
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async getSettings(): Promise<SystemSettings> {
    await this.ensureSettingsTable();
    const rows = await this.prisma.$queryRaw<{ settings: SystemSettings }[]>`
      SELECT settings FROM system_settings WHERE id = 1
    `;
    if (!rows || rows.length === 0) {
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...rows[0].settings };
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<SystemSettings> {
    await this.ensureSettingsTable();

    const current = await this.getSettings();
    const merged: SystemSettings = { ...current, ...dto };

    await this.prisma.$executeRaw`
      UPDATE system_settings
      SET settings = ${JSON.stringify(merged)}::jsonb,
          updated_at = NOW()
      WHERE id = 1
    `;

    return merged;
  }

  // ─── Fehlerbehandlung ───────────────────────────────────────────────────────

  private handleKeycloakError(err: unknown, message: string): never {
    const axiosErr = err as AxiosError;
    if (axiosErr.response) {
      this.logger.error(
        `${message}: HTTP ${axiosErr.response.status}`,
        JSON.stringify(axiosErr.response.data),
      );
      throw new InternalServerErrorException(
        `${message}: Keycloak antwortete mit Status ${axiosErr.response.status}`,
      );
    }
    if (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ENOTFOUND') {
      throw new ServiceUnavailableException(
        'Keycloak nicht erreichbar. Bitte später erneut versuchen.',
      );
    }
    throw err instanceof Error
      ? new InternalServerErrorException(err.message)
      : new InternalServerErrorException(message);
  }
}

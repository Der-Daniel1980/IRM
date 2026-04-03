import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { execSync } from 'child_process';
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

  // ─── Demo-Daten ─────────────────────────────────────────────────────────────

  private assertDevelopment(): void {
    if (process.env['APP_ENV'] !== 'development') {
      throw new ForbiddenException(
        'Demo-Daten sind nur in der Development-Umgebung verfügbar.',
      );
    }
  }

  async seedDemo(): Promise<{
    message: string;
    created: { customers: number; properties: number; staff: number; equipment: number; workOrders: number };
  }> {
    this.assertDevelopment();
    const DEMO_USER_ID = '00000000-0000-0000-0000-000000000099';

    // ── 1. Kunden ────────────────────────────────────────────────────────────
    const customerData = [
      { customerNumber: 'K-DEM0001', companyName: 'Muster Hausverwaltung GmbH', isCompany: true, addressStreet: 'Musterstraße 1', addressZip: '80331', addressCity: 'München', phone: '+49 89 123456', email: 'info@muster-hv.de', contactPerson: 'Hans Muster', notes: '[DEMO] Beispielkunde' },
      { customerNumber: 'K-DEM0002', companyName: 'Demo Wohnbau AG', isCompany: true, addressStreet: 'Testweg 5', addressZip: '10115', addressCity: 'Berlin', phone: '+49 30 654321', email: 'kontakt@demo-wohnbau.de', notes: '[DEMO] Beispielkunde' },
      { customerNumber: 'K-DEM0003', companyName: 'Beispiel Immobilien KG', isCompany: true, addressStreet: 'Probestraße 10', addressZip: '20095', addressCity: 'Hamburg', phone: '+49 40 111222', email: 'info@beispiel-immo.de', notes: '[DEMO] Beispielkunde' },
      { customerNumber: 'K-DEM0004', companyName: 'Schmidt & Partner GbR', isCompany: false, addressStreet: 'Gartenweg 3', addressZip: '70173', addressCity: 'Stuttgart', notes: '[DEMO] Beispielkunde' },
    ];
    await Promise.all(customerData.map((c) =>
      this.prisma.customer.upsert({ where: { customerNumber: c.customerNumber }, update: c, create: c }),
    ));

    const [c1, c2, c3, c4] = await Promise.all([
      this.prisma.customer.findUniqueOrThrow({ where: { customerNumber: 'K-DEM0001' } }),
      this.prisma.customer.findUniqueOrThrow({ where: { customerNumber: 'K-DEM0002' } }),
      this.prisma.customer.findUniqueOrThrow({ where: { customerNumber: 'K-DEM0003' } }),
      this.prisma.customer.findUniqueOrThrow({ where: { customerNumber: 'K-DEM0004' } }),
    ]);

    // ── 2. Immobilien ────────────────────────────────────────────────────────
    const propertyData = [
      { propertyNumber: 'OBJ-DEM001', name: 'Wohnanlage Musterstraße', addressStreet: 'Musterstraße 1–5', addressZip: '80331', addressCity: 'München', propertyType: 'RESIDENTIAL' as const, totalAreaSqm: 1200, greenAreaSqm: 400, floors: 4, unitsCount: 24, latitude: 48.1374, longitude: 11.5755, customerId: c1.id, notes: '[DEMO]' },
      { propertyNumber: 'OBJ-DEM002', name: 'Bürogebäude Testweg', addressStreet: 'Testweg 5', addressZip: '10115', addressCity: 'Berlin', propertyType: 'COMMERCIAL' as const, totalAreaSqm: 800, greenAreaSqm: 80, floors: 6, unitsCount: 12, latitude: 52.5200, longitude: 13.4050, customerId: c2.id, notes: '[DEMO]' },
      { propertyNumber: 'OBJ-DEM003', name: 'Parkanlage Probestraße', addressStreet: 'Probestraße 10', addressZip: '20095', addressCity: 'Hamburg', propertyType: 'MIXED' as const, totalAreaSqm: 2000, greenAreaSqm: 1200, floors: 3, unitsCount: 18, latitude: 53.5753, longitude: 10.0153, customerId: c3.id, notes: '[DEMO]' },
      { propertyNumber: 'OBJ-DEM004', name: 'Stadthaus Gartenweg', addressStreet: 'Gartenweg 3', addressZip: '70173', addressCity: 'Stuttgart', propertyType: 'RESIDENTIAL' as const, totalAreaSqm: 500, greenAreaSqm: 150, floors: 3, unitsCount: 6, latitude: 48.7758, longitude: 9.1829, customerId: c4.id, notes: '[DEMO]' },
      { propertyNumber: 'OBJ-DEM005', name: 'Gewerbepark Nord', addressStreet: 'Industriestraße 20', addressZip: '80999', addressCity: 'München', propertyType: 'COMMERCIAL' as const, totalAreaSqm: 3000, greenAreaSqm: 200, floors: 2, unitsCount: 8, latitude: 48.2100, longitude: 11.5500, customerId: c1.id, notes: '[DEMO]' },
    ];
    for (const { customerId, ...rest } of propertyData) {
      await this.prisma.property.upsert({
        where: { propertyNumber: rest.propertyNumber },
        update: { ...rest, customerId },
        create: { ...rest, customerId },
      });
    }

    // Einheiten für OBJ-DEM001
    const prop1 = await this.prisma.property.findUniqueOrThrow({ where: { propertyNumber: 'OBJ-DEM001' } });
    const unitData = [
      { unitNumber: 'W001', floor: 'EG', tenantName: 'Familie Müller', usageType: 'RESIDENTIAL' as const, areaSqm: 75 },
      { unitNumber: 'W002', floor: 'EG', tenantName: 'Herr Schmidt', usageType: 'RESIDENTIAL' as const, areaSqm: 65 },
      { unitNumber: 'W101', floor: '1.OG', tenantName: 'Frau Weber', usageType: 'RESIDENTIAL' as const, areaSqm: 80 },
      { unitNumber: 'W102', floor: '1.OG', tenantName: 'Ehepaar Fischer', usageType: 'RESIDENTIAL' as const, areaSqm: 90 },
      { unitNumber: 'K001', floor: 'UG', tenantName: null, usageType: 'COMMON_AREA' as const, areaSqm: 40 },
    ];
    for (const u of unitData) {
      const exists = await this.prisma.propertyUnit.findFirst({ where: { propertyId: prop1.id, unitNumber: u.unitNumber } });
      if (!exists) {
        await this.prisma.propertyUnit.create({ data: { propertyId: prop1.id, ...u } });
      }
    }

    // ── 3. Personal ──────────────────────────────────────────────────────────
    const allSkills = await this.prisma.skill.findMany({ select: { id: true, name: true } });
    const skillByName = Object.fromEntries(allSkills.map((s) => [s.name, s.id]));

    const staffData = [
      { staffNumber: 'MA-DEM01', firstName: 'Max', lastName: 'Mustermann', email: 'max.mustermann@demo.de', phone: '+49 171 1111111', employmentType: 'FULL_TIME' as const, weeklyHours: 40, color: '#22C55E', skills: ['Gartenpflege', 'Allgemein', 'Winterdienst'] },
      { staffNumber: 'MA-DEM02', firstName: 'Anna', lastName: 'Beispiel', email: 'anna.beispiel@demo.de', phone: '+49 172 2222222', employmentType: 'FULL_TIME' as const, weeklyHours: 40, color: '#3B82F6', skills: ['Reinigung', 'Allgemein'] },
      { staffNumber: 'MA-DEM03', firstName: 'Klaus', lastName: 'Demo', email: 'klaus.demo@demo.de', phone: '+49 173 3333333', employmentType: 'FULL_TIME' as const, weeklyHours: 40, color: '#EF4444', skills: ['Sanitär', 'Elektroinstallation', 'Heizungstechnik'] },
      { staffNumber: 'MA-DEM04', firstName: 'Julia', lastName: 'Probe', email: 'julia.probe@demo.de', phone: '+49 174 4444444', employmentType: 'PART_TIME' as const, weeklyHours: 20, color: '#A855F7', skills: ['Gartenpflege', 'Reinigung'] },
      { staffNumber: 'MA-DEM05', firstName: 'Thomas', lastName: 'Test', email: 'thomas.test@demo.de', phone: '+49 175 5555555', employmentType: 'FULL_TIME' as const, weeklyHours: 40, color: '#F59E0B', skills: ['Allgemein', 'Winterdienst', 'Führerschein C1'] },
    ];
    for (const { skills, ...s } of staffData) {
      const upserted = await this.prisma.staff.upsert({
        where: { staffNumber: s.staffNumber },
        update: s,
        create: s,
      });
      for (const skillName of skills) {
        const skillId = skillByName[skillName];
        if (skillId) {
          await this.prisma.staffSkill.upsert({
            where: { staffId_skillId: { staffId: upserted.id, skillId } },
            update: {},
            create: { staffId: upserted.id, skillId },
          });
        }
      }
    }

    // ── 4. Maschinen & KFZ ────────────────────────────────────────────────────
    const equipmentData = [
      { equipmentNumber: 'GER-DEM001', name: 'Aufsitzmäher Husqvarna', category: 'MACHINE' as const, equipmentType: 'Rasenmäher', status: 'AVAILABLE' as const, location: 'Depot München', nextMaintenance: new Date('2026-06-01'), notes: '[DEMO]' },
      { equipmentNumber: 'GER-DEM002', name: 'Transporter VW Crafter', category: 'VEHICLE' as const, equipmentType: 'Transporter', licensePlate: 'M-DEM-001', requiresLicense: true, requiredLicenseType: 'B', status: 'AVAILABLE' as const, location: 'Depot München', notes: '[DEMO]' },
      { equipmentNumber: 'GER-DEM003', name: 'LKW MAN TGL', category: 'VEHICLE' as const, equipmentType: 'LKW', licensePlate: 'M-DEM-002', requiresLicense: true, requiredLicenseType: 'C1', status: 'AVAILABLE' as const, location: 'Depot München', nextMaintenance: new Date('2026-05-15'), notes: '[DEMO]' },
      { equipmentNumber: 'GER-DEM004', name: 'Hochdruckreiniger Kärcher', category: 'MACHINE' as const, equipmentType: 'Reinigungsgerät', status: 'AVAILABLE' as const, location: 'Depot München', notes: '[DEMO]' },
      { equipmentNumber: 'GER-DEM005', name: 'Schneefräse Honda', category: 'MACHINE' as const, equipmentType: 'Winterdienstgerät', status: 'AVAILABLE' as const, location: 'Depot München', notes: '[DEMO]' },
      { equipmentNumber: 'GER-DEM006', name: 'PKW Ford Transit Connect', category: 'VEHICLE' as const, equipmentType: 'PKW', licensePlate: 'B-DEM-001', requiresLicense: true, requiredLicenseType: 'B', status: 'AVAILABLE' as const, location: 'Depot Berlin', notes: '[DEMO]' },
      { equipmentNumber: 'GER-DEM007', name: 'Heckenschere Stihl', category: 'TOOL' as const, equipmentType: 'Gartenwerkzeug', status: 'AVAILABLE' as const, location: 'Depot München', notes: '[DEMO]' },
    ];
    await Promise.all(equipmentData.map((e) =>
      this.prisma.equipment.upsert({ where: { equipmentNumber: e.equipmentNumber }, update: e, create: e }),
    ));

    // ── 5. Aufträge ──────────────────────────────────────────────────────────
    const [prop2, prop3, prop4] = await Promise.all([
      this.prisma.property.findUniqueOrThrow({ where: { propertyNumber: 'OBJ-DEM002' } }),
      this.prisma.property.findUniqueOrThrow({ where: { propertyNumber: 'OBJ-DEM003' } }),
      this.prisma.property.findUniqueOrThrow({ where: { propertyNumber: 'OBJ-DEM004' } }),
    ]);
    const [staff1, staff2, staff3] = await Promise.all([
      this.prisma.staff.findUniqueOrThrow({ where: { staffNumber: 'MA-DEM01' } }),
      this.prisma.staff.findUniqueOrThrow({ where: { staffNumber: 'MA-DEM02' } }),
      this.prisma.staff.findUniqueOrThrow({ where: { staffNumber: 'MA-DEM03' } }),
    ]);
    const actRasen = await this.prisma.activityType.findUnique({ where: { code: 'RASEN' } });
    const actReinigung = await this.prisma.activityType.findUnique({ where: { code: 'REINIGUNG' } });
    const actHeizung = await this.prisma.activityType.findUnique({ where: { code: 'WARTUNG_HEIZ' } });
    const actWinter = await this.prisma.activityType.findUnique({ where: { code: 'WINTER_RAEUM' } });
    const actGarten = await this.prisma.activityType.findUnique({ where: { code: 'GARTEN_ALLG' } });

    const today = new Date();
    const workOrderData = [
      { orderNumber: '2026-11000001', propertyId: prop1.id, customerId: c1.id, activityTypeId: actRasen?.id, title: 'Rasenmähen April', status: 'PLANNED' as const, priority: 'NORMAL' as const, plannedDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1), plannedStartTime: new Date(0, 0, 0, 7, 30), plannedDurationMin: 90, assignedStaff: [staff1.id], createdBy: DEMO_USER_ID },
      { orderNumber: '2026-11000002', propertyId: prop1.id, customerId: c1.id, activityTypeId: actReinigung?.id, title: 'Treppenhausreinigung KW14', status: 'ASSIGNED' as const, priority: 'NORMAL' as const, plannedDate: new Date(today.getFullYear(), today.getMonth(), today.getDate()), plannedStartTime: new Date(0, 0, 0, 8, 0), plannedDurationMin: 60, assignedStaff: [staff2.id], createdBy: DEMO_USER_ID },
      { orderNumber: '2026-11000003', propertyId: prop2.id, customerId: c2.id, activityTypeId: actHeizung?.id, title: 'Heizungswartung Jahresinspektion', status: 'DRAFT' as const, priority: 'HIGH' as const, plannedDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5), plannedDurationMin: 120, assignedStaff: [staff3.id], createdBy: DEMO_USER_ID },
      { orderNumber: '2026-11000004', propertyId: prop3.id, customerId: c3.id, activityTypeId: actGarten?.id, title: 'Allgemeine Gartenpflege', status: 'PLANNED' as const, priority: 'LOW' as const, plannedDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2), plannedStartTime: new Date(0, 0, 0, 9, 0), plannedDurationMin: 120, assignedStaff: [staff1.id], createdBy: DEMO_USER_ID },
      { orderNumber: '2026-11000005', propertyId: prop4.id, customerId: c4.id, activityTypeId: actReinigung?.id, title: 'Treppenhausreinigung', status: 'COMPLETED' as const, priority: 'NORMAL' as const, plannedDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2), plannedDurationMin: 45, assignedStaff: [staff2.id], actualDurationMin: 50, createdBy: DEMO_USER_ID },
      { orderNumber: '2026-11000006', propertyId: prop1.id, customerId: c1.id, activityTypeId: actWinter?.id, title: 'Winterdienst Räumen', status: 'CANCELLED' as const, priority: 'URGENT' as const, plannedDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5), plannedDurationMin: 60, assignedStaff: [staff1.id], notes: 'Kein Schneefall — storniert', createdBy: DEMO_USER_ID },
    ].filter((w) => w.activityTypeId != null);

    let createdWo = 0;
    for (const wo of workOrderData) {
      const exists = await this.prisma.workOrder.findUnique({ where: { orderNumber: wo.orderNumber } });
      if (!exists) {
        await this.prisma.workOrder.create({ data: wo as Parameters<typeof this.prisma.workOrder.create>[0]['data'] });
        createdWo++;
      }
    }

    return {
      message: 'Demo-Daten angelegt',
      created: {
        customers: customerData.length,
        properties: propertyData.length,
        staff: staffData.length,
        equipment: equipmentData.length,
        workOrders: createdWo,
      },
    };
  }

  async deleteSeedDemo(): Promise<{ message: string; deleted: { customers: number; properties: number; staff: number; equipment: number } }> {
    this.assertDevelopment();

    // ── Demo-Properties ermitteln ────────────────────────────────────────────
    const demoProperties = await this.prisma.property.findMany({
      where: { propertyNumber: { startsWith: 'OBJ-DEM' } },
      select: { id: true },
    });
    const demoPropIds = demoProperties.map((p) => p.id);

    // ── Demo-Staff ermitteln ─────────────────────────────────────────────────
    const demoStaff = await this.prisma.staff.findMany({
      where: { staffNumber: { startsWith: 'MA-DEM' } },
      select: { id: true },
    });
    const demoStaffIds = demoStaff.map((s) => s.id);

    // ── Demo-Customers ermitteln ─────────────────────────────────────────────
    const demoCustomers = await this.prisma.customer.findMany({
      where: { customerNumber: { startsWith: 'K-DEM' } },
      select: { id: true },
    });
    const demoCustIds = demoCustomers.map((c) => c.id);

    // ── 1. RouteSheetItems für Demo-WorkOrders ───────────────────────────────
    const demoWorkOrders = demoPropIds.length > 0
      ? await this.prisma.workOrder.findMany({
          where: { propertyId: { in: demoPropIds } },
          select: { id: true },
        })
      : [];
    const demoWoIds = demoWorkOrders.map((w) => w.id);

    if (demoWoIds.length > 0) {
      await this.prisma.routeSheetItem.deleteMany({
        where: { workOrderId: { in: demoWoIds } },
      });
      await this.prisma.workOrderEquipment.deleteMany({
        where: { workOrderId: { in: demoWoIds } },
      });
    }

    // ── 2. WorkOrders für Demo-Properties ────────────────────────────────────
    if (demoPropIds.length > 0) {
      await this.prisma.workOrder.deleteMany({
        where: { propertyId: { in: demoPropIds } },
      });
    }

    // ── 3. Abwesenheiten für Demo-Staff ─────────────────────────────────────
    if (demoStaffIds.length > 0) {
      await this.prisma.absence.deleteMany({
        where: { staffId: { in: demoStaffIds } },
      });
      await this.prisma.staffSkill.deleteMany({
        where: { staffId: { in: demoStaffIds } },
      });
    }

    // ── 4. PropertyUnits für Demo-Properties ─────────────────────────────────
    if (demoPropIds.length > 0) {
      await this.prisma.propertyUnit.deleteMany({
        where: { propertyId: { in: demoPropIds } },
      });
    }

    // ── 5. Demo-Properties löschen ───────────────────────────────────────────
    const { count: propCount } = await this.prisma.property.deleteMany({
      where: { propertyNumber: { startsWith: 'OBJ-DEM' } },
    });

    // ── 6. Demo-Staff löschen ────────────────────────────────────────────────
    const { count: staffCount } = await this.prisma.staff.deleteMany({
      where: { staffNumber: { startsWith: 'MA-DEM' } },
    });

    // ── 7. Demo-Customers löschen ────────────────────────────────────────────
    // WorkOrders direkt am Kunden (ohne Property-Bezug) zuerst entfernen
    if (demoCustIds.length > 0) {
      const remainingWos = await this.prisma.workOrder.findMany({
        where: { customerId: { in: demoCustIds } },
        select: { id: true },
      });
      if (remainingWos.length > 0) {
        const remainingWoIds = remainingWos.map((w) => w.id);
        await this.prisma.routeSheetItem.deleteMany({
          where: { workOrderId: { in: remainingWoIds } },
        });
        await this.prisma.workOrderEquipment.deleteMany({
          where: { workOrderId: { in: remainingWoIds } },
        });
        await this.prisma.workOrder.deleteMany({
          where: { customerId: { in: demoCustIds } },
        });
      }
    }

    const { count: custCount } = await this.prisma.customer.deleteMany({
      where: { customerNumber: { startsWith: 'K-DEM' } },
    });

    // ── 8. Demo-Equipment löschen ─────────────────────────────────────────────
    const { count: equipCount } = await this.prisma.equipment.deleteMany({
      where: { equipmentNumber: { startsWith: 'GER-DEM' } },
    });

    return {
      message: 'Demo-Daten gelöscht',
      deleted: {
        customers: custCount,
        properties: propCount,
        staff: staffCount,
        equipment: equipCount,
      },
    };
  }

  // ─── Datenbank-Backup ───────────────────────────────────────────────────────

  async createDatabaseBackup(): Promise<Buffer> {
    const host = process.env['POSTGRES_HOST'] ?? 'localhost';
    const port = process.env['POSTGRES_PORT'] ?? '5432';
    const user = process.env['POSTGRES_USER'] ?? 'postgres';
    const password = process.env['POSTGRES_PASSWORD'] ?? '';
    const db = process.env['POSTGRES_DB'] ?? 'irm';

    const cmd = `pg_dump -h ${host} -p ${port} -U ${user} -d ${db} --no-owner --no-acl -F p`;

    try {
      const output = execSync(cmd, {
        env: { ...process.env, PGPASSWORD: password },
        maxBuffer: 256 * 1024 * 1024, // 256 MB
      });
      this.logger.log(`Datenbank-Backup erstellt (${output.length} Bytes)`);
      return output;
    } catch (err) {
      const error = err as Error & { code?: string };
      if (error.code === 'ENOENT' || (error.message && error.message.includes('not found'))) {
        throw new InternalServerErrorException(
          'pg_dump ist nicht verfügbar. Bitte sicherstellen, dass postgresql-client im Container installiert ist.',
        );
      }
      this.logger.error('Datenbank-Backup fehlgeschlagen', error.message);
      throw new InternalServerErrorException(
        `Datenbank-Backup fehlgeschlagen: ${error.message ?? 'Unbekannter Fehler'}`,
      );
    }
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

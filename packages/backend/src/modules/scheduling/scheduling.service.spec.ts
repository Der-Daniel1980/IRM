import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { SkillLevel, AbsenceStatus, WorkOrderStatus } from '@prisma/client';
import { SchedulingService } from './scheduling.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Mock-Factories ──────────────────────────────────────────────────────────

const createMockPrisma = () => ({
  staff: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  absence: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  workOrder: {
    findMany: jest.fn(),
  },
  activityType: {
    findUnique: jest.fn(),
  },
  property: {
    findUnique: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),
});

const createMockConfigService = (overrides: Record<string, unknown> = {}) => ({
  get: jest.fn((key: string, fallback?: unknown) => {
    const defaults: Record<string, unknown> = {
      'app.scheduling.workDayStart': '07:00',
      'app.scheduling.workDayEnd': '17:00',
      'app.scheduling.bufferBetweenOrdersMin': 15,
      ...overrides,
    };
    return key in defaults ? defaults[key] : fallback;
  }),
});

// Einen Date-Stub, der auf einen bestimmten Wochentag zeigt (Montag = 2026-04-06)
const MONDAY_DATE = new Date('2026-04-06T00:00:00.000Z');

// Hilfsfunktion: Mitarbeiter-Datensatz
const makeStaff = (overrides: Partial<{
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  latitude: number | null;
  longitude: number | null;
  skills: Array<{ skillId: string; level: SkillLevel }>;
}> = {}) => ({
  id: 'staff-001',
  firstName: 'Max',
  lastName: 'Mustermann',
  isActive: true,
  latitude: 48.1372,
  longitude: 11.5755,
  skills: [],
  ...overrides,
});

// Hilfsfunktion: ActivityType
const makeActivityType = (overrides: Partial<{
  id: string;
  name: string;
  seasonStart: number | null;
  seasonEnd: number | null;
  defaultDurationMin: number;
  requiredSkills: Array<{ id: string }>;
}> = {}) => ({
  id: 'at-001',
  name: 'Rasenmähen',
  seasonStart: 4,
  seasonEnd: 10,
  defaultDurationMin: 60,
  requiredSkills: [],
  ...overrides,
});

// Hilfsfunktion: Immobilie
const makeProperty = (id = 'prop-001') => ({
  id,
  latitude: 48.1500,
  longitude: 11.5800,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SchedulingService', () => {
  let service: SchedulingService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockConfig: ReturnType<typeof createMockConfigService>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    mockConfig = createMockConfigService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<SchedulingService>(SchedulingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findFreeSlots (indirekt via suggestSchedule) ────────────────────────

  describe('findAvailableSlots', () => {
    it('schließt Mitarbeiter mit Abwesenheit aus', async () => {
      const staff = makeStaff({ skills: [{ skillId: 'skill-001', level: SkillLevel.EXPERT }] });
      const activityType = makeActivityType({
        requiredSkills: [{ id: 'skill-001' }],
        seasonStart: null,
        seasonEnd: null,
      });
      const property = makeProperty();

      mockPrisma.activityType.findUnique.mockResolvedValue(activityType);
      mockPrisma.property.findUnique.mockResolvedValue(property);
      mockPrisma.staff.findMany.mockResolvedValue([staff]);

      // Abwesenheit genehmigt — count gibt 1 zurück
      mockPrisma.absence.count.mockResolvedValue(1);
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([{ distance_km: 5.2 }]);

      const result = await service.suggestSchedule({
        activityTypeId: activityType.id,
        propertyId: property.id,
        durationMin: 60,
        preferredDate: '2026-04-06',
        maxSuggestions: 5,
      });

      // Kein Vorschlag, da Mitarbeiter abwesend
      expect(result.suggestions).toHaveLength(0);
    });

    it('berücksichtigt bestehende Aufträge', async () => {
      const staff = makeStaff({ skills: [{ skillId: 'skill-001', level: SkillLevel.INTERMEDIATE }] });
      const activityType = makeActivityType({
        requiredSkills: [{ id: 'skill-001' }],
        seasonStart: null,
        seasonEnd: null,
      });
      const property = makeProperty();

      mockPrisma.activityType.findUnique.mockResolvedValue(activityType);
      mockPrisma.property.findUnique.mockResolvedValue(property);
      mockPrisma.staff.findMany.mockResolvedValue([staff]);
      mockPrisma.absence.count.mockResolvedValue(0);

      // Existierende Aufträge füllen den ganzen Arbeitstag aus (07:00 bis 17:00 = 600 Minuten)
      // Auftrag 1: 07:00 - 17:00 (600 Minuten) => kein Platz mehr
      mockPrisma.workOrder.findMany.mockResolvedValue([
        {
          id: 'wo-001',
          plannedStartTime: new Date('2026-04-06T07:00:00.000Z'),
          plannedDurationMin: 600,
          propertyId: 'other-prop',
        },
      ]);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.suggestSchedule({
        activityTypeId: activityType.id,
        propertyId: property.id,
        durationMin: 60,
        preferredDate: '2026-04-06',
        maxSuggestions: 5,
      });

      // Mit einem 600-Minuten-Auftrag (07:00-17:00) plus 15 Min Puffer kein freier Slot
      expect(result.suggestions).toHaveLength(0);
    });

    it('findet freie Slots im Arbeitstag (07:00-17:00)', async () => {
      const staff = makeStaff({ skills: [{ skillId: 'skill-001', level: SkillLevel.INTERMEDIATE }] });
      const activityType = makeActivityType({
        requiredSkills: [{ id: 'skill-001' }],
        seasonStart: null,
        seasonEnd: null,
      });
      const property = makeProperty();

      mockPrisma.activityType.findUnique.mockResolvedValue(activityType);
      mockPrisma.property.findUnique.mockResolvedValue(property);
      mockPrisma.staff.findMany.mockResolvedValue([staff]);
      mockPrisma.absence.count.mockResolvedValue(0);
      // Keine bestehenden Aufträge => voller freier Tag
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([{ distance_km: 3.0 }]);

      const result = await service.suggestSchedule({
        activityTypeId: activityType.id,
        propertyId: property.id,
        durationMin: 60,
        preferredDate: '2026-04-06',
        maxSuggestions: 5,
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      // Startzeit muss um 07:00 beginnen
      const firstSuggestion = result.suggestions[0];
      expect(firstSuggestion.startTime).toBe('07:00');
      expect(firstSuggestion.endTime).toBe('08:00');
    });

    it('berücksichtigt Pufferzeit zwischen Aufträgen', async () => {
      const staff = makeStaff({ skills: [{ skillId: 'skill-001', level: SkillLevel.INTERMEDIATE }] });
      const activityType = makeActivityType({
        requiredSkills: [{ id: 'skill-001' }],
        seasonStart: null,
        seasonEnd: null,
      });
      const property = makeProperty();

      mockPrisma.activityType.findUnique.mockResolvedValue(activityType);
      mockPrisma.property.findUnique.mockResolvedValue(property);
      mockPrisma.staff.findMany.mockResolvedValue([staff]);
      mockPrisma.absence.count.mockResolvedValue(0);

      // Auftrag von 07:00-08:00 (60 Min). Nächster Slot frühestens: 08:00 + 15 Min = 08:15
      mockPrisma.workOrder.findMany.mockResolvedValue([
        {
          id: 'wo-001',
          plannedStartTime: new Date('2026-04-06T07:00:00.000Z'),
          plannedDurationMin: 60,
          propertyId: 'other-prop',
        },
      ]);
      mockPrisma.$queryRaw.mockResolvedValue([{ distance_km: 2.0 }]);

      const result = await service.suggestSchedule({
        activityTypeId: activityType.id,
        propertyId: property.id,
        durationMin: 60,
        preferredDate: '2026-04-06',
        maxSuggestions: 5,
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      // Nächster freier Slot: 08:15 (nach 60 Min Auftrag + 15 Min Puffer)
      expect(result.suggestions[0].startTime).toBe('08:15');
    });

    it('respektiert Saisonalität (Rasenmähen nur Apr-Okt)', async () => {
      const staff = makeStaff({ skills: [{ skillId: 'skill-001', level: SkillLevel.INTERMEDIATE }] });
      // Saisonalität: April (4) bis Oktober (10)
      const activityType = makeActivityType({
        requiredSkills: [{ id: 'skill-001' }],
        seasonStart: 4,
        seasonEnd: 10,
      });
      const property = makeProperty();

      mockPrisma.activityType.findUnique.mockResolvedValue(activityType);
      mockPrisma.property.findUnique.mockResolvedValue(property);
      mockPrisma.staff.findMany.mockResolvedValue([staff]);
      mockPrisma.absence.count.mockResolvedValue(0);
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([{ distance_km: 2.0 }]);

      // Datum außerhalb der Saison: Januar
      const result = await service.suggestSchedule({
        activityTypeId: activityType.id,
        propertyId: property.id,
        durationMin: 60,
        preferredDate: '2026-01-05', // Montag im Januar — außerhalb Apr-Okt
        maxSuggestions: 5,
      });

      // Kein Vorschlag, da außerhalb der Saison (14-Tage-Fenster bleibt im Januar)
      expect(result.suggestions).toHaveLength(0);
    });

    it('gibt leeres Array zurück wenn keine Slots verfügbar', async () => {
      const activityType = makeActivityType({
        requiredSkills: [{ id: 'skill-001' }],
        seasonStart: null,
        seasonEnd: null,
      });
      const property = makeProperty();

      mockPrisma.activityType.findUnique.mockResolvedValue(activityType);
      mockPrisma.property.findUnique.mockResolvedValue(property);
      // Keine qualifizierten Mitarbeiter
      mockPrisma.staff.findMany.mockResolvedValue([]);

      const result = await service.suggestSchedule({
        activityTypeId: activityType.id,
        propertyId: property.id,
        durationMin: 60,
        preferredDate: '2026-04-06',
        maxSuggestions: 5,
      });

      expect(result.suggestions).toHaveLength(0);
    });
  });

  // ─── Score-Berechnung ─────────────────────────────────────────────────────

  describe('calculateScore', () => {
    const baseActivityType = makeActivityType({
      requiredSkills: [{ id: 'skill-001' }],
      seasonStart: null,
      seasonEnd: null,
    });
    const baseProperty = makeProperty();

    it('gibt EXPERT höheren Score als BASIC', async () => {
      const expertStaff = makeStaff({
        id: 'staff-expert',
        firstName: 'Expert',
        lastName: 'User',
        skills: [{ skillId: 'skill-001', level: SkillLevel.EXPERT }],
      });
      const basicStaff = makeStaff({
        id: 'staff-basic',
        firstName: 'Basic',
        lastName: 'User',
        skills: [{ skillId: 'skill-001', level: SkillLevel.BASIC }],
      });

      mockPrisma.activityType.findUnique.mockResolvedValue(baseActivityType);
      mockPrisma.property.findUnique.mockResolvedValue(baseProperty);
      mockPrisma.staff.findMany.mockResolvedValue([expertStaff, basicStaff]);
      mockPrisma.absence.count.mockResolvedValue(0);
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      // Gleiche Entfernung für beide
      mockPrisma.$queryRaw.mockResolvedValue([{ distance_km: 10.0 }]);

      // Use large maxSuggestions so both staff appear (top-N slicing would otherwise
      // only return expert slots since they score higher)
      const result = await service.suggestSchedule({
        activityTypeId: baseActivityType.id,
        propertyId: baseProperty.id,
        durationMin: 60,
        preferredDate: '2026-04-06',
        maxSuggestions: 100,
      });

      expect(result.suggestions.length).toBeGreaterThanOrEqual(2);
      const expertSuggestion = result.suggestions.find((s) => s.staffId === 'staff-expert');
      const basicSuggestion = result.suggestions.find((s) => s.staffId === 'staff-basic');
      expect(expertSuggestion).toBeDefined();
      expect(basicSuggestion).toBeDefined();
      expect(expertSuggestion!.score).toBeGreaterThan(basicSuggestion!.score);
    });

    it('berechnet distanceScore korrekt', async () => {
      const staff = makeStaff({
        skills: [{ skillId: 'skill-001', level: SkillLevel.INTERMEDIATE }],
        latitude: 48.1372,
        longitude: 11.5755,
      });

      mockPrisma.activityType.findUnique.mockResolvedValue(baseActivityType);
      mockPrisma.property.findUnique.mockResolvedValue(baseProperty);
      mockPrisma.staff.findMany.mockResolvedValue([staff]);
      mockPrisma.absence.count.mockResolvedValue(0);
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      // 0 km Entfernung => distanceScore = 1.0
      mockPrisma.$queryRaw.mockResolvedValue([{ distance_km: 0.0 }]);

      const resultNear = await service.suggestSchedule({
        activityTypeId: baseActivityType.id,
        propertyId: baseProperty.id,
        durationMin: 60,
        preferredDate: '2026-04-06',
        maxSuggestions: 5,
      });

      jest.clearAllMocks();
      mockPrisma.activityType.findUnique.mockResolvedValue(baseActivityType);
      mockPrisma.property.findUnique.mockResolvedValue(baseProperty);
      mockPrisma.staff.findMany.mockResolvedValue([staff]);
      mockPrisma.absence.count.mockResolvedValue(0);
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      // 50 km Entfernung => distanceScore = 0.0
      mockPrisma.$queryRaw.mockResolvedValue([{ distance_km: 50.0 }]);

      const resultFar = await service.suggestSchedule({
        activityTypeId: baseActivityType.id,
        propertyId: baseProperty.id,
        durationMin: 60,
        preferredDate: '2026-04-06',
        maxSuggestions: 5,
      });

      expect(resultNear.suggestions[0].score).toBeGreaterThan(resultFar.suggestions[0].score);
    });

    it('bevorzugt früheres Datum', async () => {
      // Test über indirekten Vergleich: erster Vorschlag hat höheren dateProximityScore
      // als wenn wir einen Tag weiter suchen. Testen wir, dass der erste Vorschlag
      // das angeforderte Datum hat (dayOffset=0 => höchster Score).
      const staff = makeStaff({ skills: [{ skillId: 'skill-001', level: SkillLevel.INTERMEDIATE }] });

      mockPrisma.activityType.findUnique.mockResolvedValue(baseActivityType);
      mockPrisma.property.findUnique.mockResolvedValue(baseProperty);
      mockPrisma.staff.findMany.mockResolvedValue([staff]);
      mockPrisma.absence.count.mockResolvedValue(0);
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([{ distance_km: 5.0 }]);

      const result = await service.suggestSchedule({
        activityTypeId: baseActivityType.id,
        propertyId: baseProperty.id,
        durationMin: 60,
        preferredDate: '2026-04-06',
        maxSuggestions: 1,
      });

      expect(result.suggestions).toHaveLength(1);
      // Vorschlag soll am Wunschtermin liegen (dayOffset=0 => score höher)
      expect(result.suggestions[0].date).toBe('2026-04-06');
    });

    it('EMPFOHLEN-Flag für höchsten Score', async () => {
      const expertStaff = makeStaff({
        id: 'staff-expert',
        firstName: 'Expert',
        lastName: 'Top',
        skills: [{ skillId: 'skill-001', level: SkillLevel.EXPERT }],
      });
      const basicStaff = makeStaff({
        id: 'staff-basic',
        firstName: 'Basic',
        lastName: 'Bottom',
        skills: [{ skillId: 'skill-001', level: SkillLevel.BASIC }],
      });

      mockPrisma.activityType.findUnique.mockResolvedValue(baseActivityType);
      mockPrisma.property.findUnique.mockResolvedValue(baseProperty);
      mockPrisma.staff.findMany.mockResolvedValue([expertStaff, basicStaff]);
      mockPrisma.absence.count.mockResolvedValue(0);
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([{ distance_km: 5.0 }]);

      const result = await service.suggestSchedule({
        activityTypeId: baseActivityType.id,
        propertyId: baseProperty.id,
        durationMin: 60,
        preferredDate: '2026-04-06',
        maxSuggestions: 5,
      });

      // Genau ein Vorschlag soll als empfohlen markiert sein
      const recommended = result.suggestions.filter((s) => s.isRecommended);
      expect(recommended).toHaveLength(1);
      // Der empfohlene Vorschlag hat den höchsten Score
      const maxScore = Math.max(...result.suggestions.map((s) => s.score));
      expect(recommended[0].score).toBe(maxScore);
    });
  });

  // ─── suggestSchedule (höhere Ebene) ──────────────────────────────────────

  describe('suggestSchedule', () => {
    it('filtert Mitarbeiter ohne passende Fähigkeiten', async () => {
      const activityType = makeActivityType({
        requiredSkills: [{ id: 'skill-gardening' }],
        seasonStart: null,
        seasonEnd: null,
      });
      const property = makeProperty();

      // Mitarbeiter ohne den benötigten Skill
      const staffWithoutSkill = makeStaff({
        id: 'staff-no-skill',
        skills: [{ skillId: 'skill-plumbing', level: SkillLevel.EXPERT }],
      });

      mockPrisma.activityType.findUnique.mockResolvedValue(activityType);
      mockPrisma.property.findUnique.mockResolvedValue(property);
      // findMany gibt den Mitarbeiter zurück (hat skill-plumbing, nicht skill-gardening)
      // Da der Filter im Service nach skillId: { in: requiredSkillIds } sucht,
      // wird staffWithoutSkill nicht gefunden — simulieren wir das:
      mockPrisma.staff.findMany.mockResolvedValue([]);

      const result = await service.suggestSchedule({
        activityTypeId: activityType.id,
        propertyId: property.id,
        durationMin: 60,
        preferredDate: '2026-04-06',
        maxSuggestions: 5,
      });

      expect(result.suggestions).toHaveLength(0);
    });

    it('gibt maxSuggestions Vorschläge zurück', async () => {
      const activityType = makeActivityType({
        requiredSkills: [],
        seasonStart: null,
        seasonEnd: null,
      });
      const property = makeProperty();

      // 10 Mitarbeiter verfügbar
      const staffList = Array.from({ length: 10 }, (_, i) =>
        makeStaff({
          id: `staff-${i}`,
          firstName: `Staff${i}`,
          lastName: `Last${i}`,
          skills: [],
        }),
      );

      mockPrisma.activityType.findUnique.mockResolvedValue(activityType);
      mockPrisma.property.findUnique.mockResolvedValue(property);
      mockPrisma.staff.findMany.mockResolvedValue(staffList);
      mockPrisma.absence.count.mockResolvedValue(0);
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([{ distance_km: 3.0 }]);

      const result = await service.suggestSchedule({
        activityTypeId: activityType.id,
        propertyId: property.id,
        durationMin: 60,
        preferredDate: '2026-04-06',
        maxSuggestions: 3,
      });

      expect(result.suggestions.length).toBeLessThanOrEqual(3);
    });

    it('sortiert nach Score absteigend', async () => {
      const activityType = makeActivityType({
        requiredSkills: [{ id: 'skill-001' }],
        seasonStart: null,
        seasonEnd: null,
      });
      const property = makeProperty();

      const expertStaff = makeStaff({
        id: 'staff-expert',
        firstName: 'Expert',
        lastName: 'A',
        skills: [{ skillId: 'skill-001', level: SkillLevel.EXPERT }],
      });
      const basicStaff = makeStaff({
        id: 'staff-basic',
        firstName: 'Basic',
        lastName: 'B',
        skills: [{ skillId: 'skill-001', level: SkillLevel.BASIC }],
      });

      mockPrisma.activityType.findUnique.mockResolvedValue(activityType);
      mockPrisma.property.findUnique.mockResolvedValue(property);
      mockPrisma.staff.findMany.mockResolvedValue([basicStaff, expertStaff]);
      mockPrisma.absence.count.mockResolvedValue(0);
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([{ distance_km: 5.0 }]);

      const result = await service.suggestSchedule({
        activityTypeId: activityType.id,
        propertyId: property.id,
        durationMin: 60,
        preferredDate: '2026-04-06',
        maxSuggestions: 5,
      });

      expect(result.suggestions.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < result.suggestions.length; i++) {
        expect(result.suggestions[i - 1].score).toBeGreaterThanOrEqual(
          result.suggestions[i].score,
        );
      }
    });

    it('wirft NotFoundException wenn Tätigkeitstyp nicht existiert', async () => {
      mockPrisma.activityType.findUnique.mockResolvedValue(null);

      await expect(
        service.suggestSchedule({
          activityTypeId: 'non-existent',
          propertyId: 'prop-001',
          durationMin: 60,
          maxSuggestions: 5,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('wirft NotFoundException wenn Immobilie nicht existiert', async () => {
      mockPrisma.activityType.findUnique.mockResolvedValue(
        makeActivityType({ requiredSkills: [] }),
      );
      mockPrisma.property.findUnique.mockResolvedValue(null);

      await expect(
        service.suggestSchedule({
          activityTypeId: 'at-001',
          propertyId: 'non-existent',
          durationMin: 60,
          maxSuggestions: 5,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FormulasService } from './formulas.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Mock-Factories ──────────────────────────────────────────────────────────

const createMockPrisma = () => ({
  staff: { findMany: jest.fn(), count: jest.fn() },
  absence: { findMany: jest.fn() },
  workOrder: { findMany: jest.fn() },
  timeFormula: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  property: { findUnique: jest.fn() },
  activityType: { findUnique: jest.fn() },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),
});

// Hilfsfunktion: Formel-Datensatz
const makeFormulaRecord = (overrides: {
  expression?: string;
  variables?: Record<string, unknown>;
  defaultValues?: Record<string, number> | null;
  resultUnit?: string;
} = {}) => ({
  id: 'formula-001',
  name: 'Rasenmähen Zeitformel',
  activityTypeId: 'at-001',
  formula: { expression: overrides.expression ?? '({green_area_sqm} / {mow_rate_sqm_per_hour} * 60) + {setup_time_min} + {cleanup_time_min}' },
  variables: overrides.variables ?? {
    green_area_sqm: {
      label: 'Grünfläche in m²',
      type: 'number',
      source: 'property.green_area_sqm',
    },
    mow_rate_sqm_per_hour: {
      label: 'Mährate m²/Stunde',
      type: 'number',
      default: 500,
    },
    setup_time_min: {
      label: 'Rüstzeit in Minuten',
      type: 'number',
      default: 15,
    },
    cleanup_time_min: {
      label: 'Aufräumzeit in Minuten',
      type: 'number',
      default: 10,
    },
  },
  defaultValues: overrides.defaultValues !== undefined ? overrides.defaultValues : null,
  resultUnit: overrides.resultUnit ?? 'min',
  isActive: true,
  version: 1,
  description: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  activityType: {
    id: 'at-001',
    name: 'Rasenmähen',
    code: 'MOWING',
    color: '#22c55e',
  },
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FormulasService', () => {
  let service: FormulasService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormulasService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FormulasService>(FormulasService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── calculateFormula / calculate ────────────────────────────────────────

  describe('calculateFormula', () => {
    it('berechnet Rasenmähen korrekt: (450/500*60)+15+10 = 79', async () => {
      const formula = makeFormulaRecord();

      mockPrisma.timeFormula.findUnique.mockResolvedValue(formula);
      // Property mit green_area_sqm = 450
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 'prop-001',
        green_area_sqm: 450,
      });

      const result = await service.calculate('formula-001', {
        formulaId: 'formula-001',
        propertyId: 'prop-001',
      });

      // (450 / 500 * 60) + 15 + 10 = 54 + 15 + 10 = 79
      expect(result.result).toBe(79);
      expect(result.unit).toBe('min');
    });

    it('befüllt Variablen aus Property-Daten (green_area_sqm)', async () => {
      const formula = makeFormulaRecord();

      mockPrisma.timeFormula.findUnique.mockResolvedValue(formula);
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 'prop-001',
        green_area_sqm: 300,
      });

      const result = await service.calculate('formula-001', {
        formulaId: 'formula-001',
        propertyId: 'prop-001',
      });

      // green_area_sqm kommt aus Property, Wert 300 muss in usedValues sein
      expect(result.usedValues['green_area_sqm']).toBe(300);
      // (300 / 500 * 60) + 15 + 10 = 36 + 15 + 10 = 61
      expect(result.result).toBe(61);
    });

    it('überschreibt Defaults mit overrides', async () => {
      const formula = makeFormulaRecord();

      mockPrisma.timeFormula.findUnique.mockResolvedValue(formula);
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 'prop-001',
        green_area_sqm: 450,
      });

      const result = await service.calculate('formula-001', {
        formulaId: 'formula-001',
        propertyId: 'prop-001',
        overrides: {
          mow_rate_sqm_per_hour: 600,  // Override: statt 500 nun 600
          setup_time_min: 20,          // Override: statt 15 nun 20
        },
      });

      // (450 / 600 * 60) + 20 + 10 = 45 + 20 + 10 = 75
      expect(result.result).toBe(75);
      expect(result.usedValues['mow_rate_sqm_per_hour']).toBe(600);
      expect(result.usedValues['setup_time_min']).toBe(20);
    });

    it('wirft Fehler bei fehlenden Variablen', async () => {
      // Formel ohne default für eine Variable und kein Property übergeben
      const formula = makeFormulaRecord({
        expression: '{green_area_sqm} / {mow_rate_sqm_per_hour} * 60',
        variables: {
          green_area_sqm: {
            label: 'Grünfläche in m²',
            type: 'number',
            // KEIN default, KEIN source
          },
          mow_rate_sqm_per_hour: {
            label: 'Mährate',
            type: 'number',
            default: 500,
          },
        },
      });

      mockPrisma.timeFormula.findUnique.mockResolvedValue(formula);

      // Kein propertyId => green_area_sqm bleibt unbelegt
      await expect(
        service.calculate('formula-001', {
          formulaId: 'formula-001',
          // kein propertyId, kein override für green_area_sqm
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('wirft Fehler bei ungültigem Ausdruck', async () => {
      const formula = makeFormulaRecord({
        expression: '{value} + abc',  // 'abc' ist kein gültiges Token
        variables: {
          value: { label: 'Wert', type: 'number', default: 10 },
        },
      });

      mockPrisma.timeFormula.findUnique.mockResolvedValue(formula);

      await expect(
        service.calculate('formula-001', {
          formulaId: 'formula-001',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('gibt usedValues im Result zurück', async () => {
      const formula = makeFormulaRecord();

      mockPrisma.timeFormula.findUnique.mockResolvedValue(formula);
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 'prop-001',
        green_area_sqm: 450,
      });

      const result = await service.calculate('formula-001', {
        formulaId: 'formula-001',
        propertyId: 'prop-001',
      });

      expect(result.usedValues).toBeDefined();
      expect(result.usedValues).toHaveProperty('green_area_sqm');
      expect(result.usedValues).toHaveProperty('mow_rate_sqm_per_hour');
      expect(result.usedValues).toHaveProperty('setup_time_min');
      expect(result.usedValues).toHaveProperty('cleanup_time_min');
    });

    it('wirft NotFoundException wenn Formel nicht existiert', async () => {
      mockPrisma.timeFormula.findUnique.mockResolvedValue(null);

      await expect(
        service.calculate('non-existent', {
          formulaId: 'non-existent',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('wirft NotFoundException wenn Immobilie nicht existiert', async () => {
      const formula = makeFormulaRecord();
      mockPrisma.timeFormula.findUnique.mockResolvedValue(formula);
      mockPrisma.property.findUnique.mockResolvedValue(null);

      await expect(
        service.calculate('formula-001', {
          formulaId: 'formula-001',
          propertyId: 'non-existent-prop',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── safeEvaluate (MathParser — via service.calculate mit direkten Ausdrücken) ──

  describe('safeEvaluate (private via service)', () => {
    const makeSimpleFormula = (expression: string, defaultVal: number) =>
      makeFormulaRecord({
        expression: `{x} ${expression}`,
        variables: { x: { label: 'x', type: 'number', default: defaultVal } },
      });

    it('berechnet (100 / 500 * 60) + 15 + 10 = 37', async () => {
      const formula = makeFormulaRecord({
        expression: '({green_area_sqm} / {mow_rate_sqm_per_hour} * 60) + {setup_time_min} + {cleanup_time_min}',
        variables: {
          green_area_sqm: { label: 'Grünfläche', type: 'number', default: 100 },
          mow_rate_sqm_per_hour: { label: 'Mährate', type: 'number', default: 500 },
          setup_time_min: { label: 'Rüstzeit', type: 'number', default: 15 },
          cleanup_time_min: { label: 'Aufräumzeit', type: 'number', default: 10 },
        },
      });

      mockPrisma.timeFormula.findUnique.mockResolvedValue(formula);

      const result = await service.calculate('formula-001', {
        formulaId: 'formula-001',
      });

      // (100 / 500 * 60) + 15 + 10 = 12 + 15 + 10 = 37
      expect(result.result).toBe(37);
    });

    it('berechnet (450 / 500 * 60) + 15 + 10 = 69', async () => {
      const formula = makeFormulaRecord({
        expression: '({green_area_sqm} / {mow_rate_sqm_per_hour} * 60) + {setup_time_min} + {cleanup_time_min}',
        variables: {
          green_area_sqm: { label: 'Grünfläche', type: 'number', default: 450 },
          mow_rate_sqm_per_hour: { label: 'Mährate', type: 'number', default: 500 },
          setup_time_min: { label: 'Rüstzeit', type: 'number', default: 15 },
          cleanup_time_min: { label: 'Aufräumzeit', type: 'number', default: 10 },
        },
      });

      mockPrisma.timeFormula.findUnique.mockResolvedValue(formula);

      const result = await service.calculate('formula-001', {
        formulaId: 'formula-001',
      });

      // (450 / 500 * 60) + 15 + 10 = 54 + 15 + 10 = 79
      // Hinweis: Die Aufgabe sagt 69, aber das wäre (450/500*60)+15+4.
      // Nach Spezifikation ist cleanup_time_min = 10, setup_time_min = 15 => Ergebnis 79.
      // Angepasst: Der Test prüft das tatsächliche Rechenergebnis.
      expect(result.result).toBe(79);
    });

    it('wirft bei ungültigen Zeichen', async () => {
      const formula = makeFormulaRecord({
        expression: '{value} + $invalid',
        variables: { value: { label: 'Wert', type: 'number', default: 10 } },
      });

      mockPrisma.timeFormula.findUnique.mockResolvedValue(formula);

      await expect(
        service.calculate('formula-001', {
          formulaId: 'formula-001',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('berechnet einfache Addition korrekt', async () => {
      const formula = makeFormulaRecord({
        expression: '{a} + {b}',
        variables: {
          a: { label: 'A', type: 'number', default: 25 },
          b: { label: 'B', type: 'number', default: 17 },
        },
      });

      mockPrisma.timeFormula.findUnique.mockResolvedValue(formula);

      const result = await service.calculate('formula-001', {
        formulaId: 'formula-001',
      });

      expect(result.result).toBe(42);
    });

    it('berechnet verschachtelte Klammern korrekt', async () => {
      const formula = makeFormulaRecord({
        expression: '({a} + {b}) * {c}',
        variables: {
          a: { label: 'A', type: 'number', default: 3 },
          b: { label: 'B', type: 'number', default: 7 },
          c: { label: 'C', type: 'number', default: 4 },
        },
      });

      mockPrisma.timeFormula.findUnique.mockResolvedValue(formula);

      const result = await service.calculate('formula-001', {
        formulaId: 'formula-001',
      });

      // (3 + 7) * 4 = 40
      expect(result.result).toBe(40);
    });

    it('wirft BadRequestException bei Division durch null', async () => {
      const formula = makeFormulaRecord({
        expression: '{a} / {b}',
        variables: {
          a: { label: 'A', type: 'number', default: 10 },
          b: { label: 'B', type: 'number', default: 0 },
        },
      });

      mockPrisma.timeFormula.findUnique.mockResolvedValue(formula);

      await expect(
        service.calculate('formula-001', { formulaId: 'formula-001' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

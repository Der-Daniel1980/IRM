import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, TimeFormula } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFormulaDto } from './dto/create-formula.dto';
import { UpdateFormulaDto } from './dto/update-formula.dto';
import { QueryFormulasDto } from './dto/query-formulas.dto';
import { CalculateFormulaDto, CalculateFormulaResult } from './dto/calculate-formula.dto';

// ─── Interne Typen ────────────────────────────────────────────────────────────

export interface FormulaVariable {
  label: string;
  type: string;
  source?: string;
  default?: number;
}

export interface FormulaJson {
  expression: string;
}

export interface FormulaWithRelations extends TimeFormula {
  activityType: {
    id: string;
    name: string;
    code: string;
    color: string;
  };
}

export interface PaginatedFormulas {
  data: FormulaWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Sicherer mathematischer Parser ──────────────────────────────────────────
//
// Implementierung: Recursive-Descent-Parser für Ausdrücke mit
// +, -, *, /, (, ), Dezimalzahlen und unärem Minus.
// Kein eval(), kein Function-Konstruktor.

class MathParser {
  private pos = 0;

  constructor(private readonly input: string) {}

  parse(): number {
    const result = this.parseExpression();
    this.skipWhitespace();
    if (this.pos < this.input.length) {
      throw new BadRequestException(
        `Ungültiges Zeichen an Position ${this.pos}: '${this.input[this.pos]}'`,
      );
    }
    return result;
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && this.input[this.pos] === ' ') {
      this.pos++;
    }
  }

  // expression = term (('+' | '-') term)*
  private parseExpression(): number {
    let left = this.parseTerm();
    this.skipWhitespace();

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch !== '+' && ch !== '-') break;
      this.pos++;
      const right = this.parseTerm();
      if (ch === '+') {
        left = left + right;
      } else {
        left = left - right;
      }
      this.skipWhitespace();
    }

    return left;
  }

  // term = factor (('*' | '/') factor)*
  private parseTerm(): number {
    let left = this.parseFactor();
    this.skipWhitespace();

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch !== '*' && ch !== '/') break;
      this.pos++;
      const right = this.parseFactor();
      if (ch === '*') {
        left = left * right;
      } else {
        if (right === 0) throw new BadRequestException('Division durch null');
        left = left / right;
      }
      this.skipWhitespace();
    }

    return left;
  }

  // factor = number | '(' expression ')' | '-' factor
  private parseFactor(): number {
    this.skipWhitespace();

    if (this.pos >= this.input.length) {
      throw new BadRequestException('Unerwartetes Ende des Ausdrucks');
    }

    const ch = this.input[this.pos];

    // Unäres Minus
    if (ch === '-') {
      this.pos++;
      return -this.parseFactor();
    }

    // Geklammert
    if (ch === '(') {
      this.pos++;
      const result = this.parseExpression();
      this.skipWhitespace();
      if (this.pos >= this.input.length || this.input[this.pos] !== ')') {
        throw new BadRequestException('Fehlende schließende Klammer');
      }
      this.pos++;
      return result;
    }

    // Zahl
    if (ch >= '0' && ch <= '9' || ch === '.') {
      return this.parseNumber();
    }

    throw new BadRequestException(
      `Ungültiges Zeichen an Position ${this.pos}: '${ch}'`,
    );
  }

  private parseNumber(): number {
    const start = this.pos;
    let hasDot = false;

    while (this.pos < this.input.length) {
      const c = this.input[this.pos];
      if (c >= '0' && c <= '9') {
        this.pos++;
      } else if (c === '.' && !hasDot) {
        hasDot = true;
        this.pos++;
      } else {
        break;
      }
    }

    const numStr = this.input.slice(start, this.pos);
    const value = parseFloat(numStr);

    if (isNaN(value)) {
      throw new BadRequestException(`Ungültige Zahl: '${numStr}'`);
    }

    return value;
  }
}

function evaluateMath(expression: string): number {
  const parser = new MathParser(expression);
  return parser.parse();
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FormulasService {
  private readonly logger = new Logger(FormulasService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async findAll(query: QueryFormulasDto): Promise<PaginatedFormulas> {
    const { activityTypeId, isActive, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TimeFormulaWhereInput = {};

    if (activityTypeId) {
      where.activityTypeId = activityTypeId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.timeFormula.findMany({
        where,
        include: {
          activityType: {
            select: { id: true, name: true, code: true, color: true },
          },
        },
        orderBy: [{ activityTypeId: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.timeFormula.count({ where }),
    ]);

    return {
      data: data as FormulaWithRelations[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<FormulaWithRelations> {
    const formula = await this.prisma.timeFormula.findUnique({
      where: { id },
      include: {
        activityType: {
          select: { id: true, name: true, code: true, color: true },
        },
      },
    });

    if (!formula) {
      throw new NotFoundException(`Formel mit ID "${id}" wurde nicht gefunden`);
    }

    return formula as FormulaWithRelations;
  }

  async create(dto: CreateFormulaDto): Promise<FormulaWithRelations> {
    // Tätigkeit prüfen
    await this.ensureActivityTypeExists(dto.activityTypeId);

    this.logger.log(`Erstelle neue Formel: ${dto.name}`);

    const formulaJson: FormulaJson = { expression: dto.formulaExpression };

    const created = await this.prisma.timeFormula.create({
      data: {
        name: dto.name,
        activityTypeId: dto.activityTypeId,
        formula: formulaJson as unknown as Prisma.InputJsonValue,
        variables: dto.variables as unknown as Prisma.InputJsonValue,
        defaultValues: dto.defaultValues
          ? (dto.defaultValues as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        description: dto.description ?? null,
        isActive: dto.isActive ?? true,
        version: 1,
      },
      include: {
        activityType: {
          select: { id: true, name: true, code: true, color: true },
        },
      },
    });

    return created as FormulaWithRelations;
  }

  async update(id: string, dto: UpdateFormulaDto): Promise<FormulaWithRelations> {
    const existing = await this.findOne(id);

    if (dto.activityTypeId) {
      await this.ensureActivityTypeExists(dto.activityTypeId);
    }

    // Versionierung: version++ wenn formula oder variables geändert werden
    const existingFormula = existing.formula as unknown as FormulaJson;
    const existingVariables = existing.variables as unknown as Record<string, FormulaVariable>;

    const expressionChanged =
      dto.formulaExpression !== undefined &&
      dto.formulaExpression !== existingFormula.expression;

    const variablesChanged =
      dto.variables !== undefined &&
      JSON.stringify(dto.variables) !== JSON.stringify(existingVariables);

    const shouldIncrementVersion = expressionChanged || variablesChanged;

    this.logger.log(
      `Aktualisiere Formel: ${id}${shouldIncrementVersion ? ' (Version++, da Formel/Variablen geändert)' : ''}`,
    );

    const newFormulaJson: FormulaJson = {
      expression: dto.formulaExpression ?? existingFormula.expression,
    };

    const updated = await this.prisma.timeFormula.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.activityTypeId !== undefined && { activityTypeId: dto.activityTypeId }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.formulaExpression !== undefined && {
          formula: newFormulaJson as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.variables !== undefined && {
          variables: dto.variables as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.defaultValues !== undefined && {
          defaultValues: dto.defaultValues as unknown as Prisma.InputJsonValue,
        }),
        ...(shouldIncrementVersion && { version: { increment: 1 } }),
      },
      include: {
        activityType: {
          select: { id: true, name: true, code: true, color: true },
        },
      },
    });

    return updated as FormulaWithRelations;
  }

  async remove(id: string): Promise<FormulaWithRelations> {
    await this.findOne(id);

    this.logger.log(`Lösche Formel: ${id}`);

    const deleted = await this.prisma.timeFormula.delete({
      where: { id },
      include: {
        activityType: {
          select: { id: true, name: true, code: true, color: true },
        },
      },
    });

    return deleted as FormulaWithRelations;
  }

  // ─── Berechnung ───────────────────────────────────────────────────────────

  async calculate(id: string, dto: CalculateFormulaDto): Promise<CalculateFormulaResult> {
    const formulaRecord = await this.findOne(id);

    const formulaJson = formulaRecord.formula as unknown as FormulaJson;
    const variables = formulaRecord.variables as unknown as Record<string, FormulaVariable>;
    const defaultValues = (formulaRecord.defaultValues ?? {}) as unknown as Record<string, number>;

    // Schritt 1: Standard-Werte aus defaultValues
    const usedValues: Record<string, number> = { ...defaultValues };

    // Schritt 2: Default-Werte aus den Variablen-Definitionen (falls nicht in defaultValues)
    for (const [varName, varDef] of Object.entries(variables)) {
      if (!(varName in usedValues) && varDef.default !== undefined) {
        usedValues[varName] = varDef.default;
      }
    }

    // Schritt 3: Werte aus Property-Daten befüllen (source: "property.xxx")
    if (dto.propertyId) {
      const property = await this.prisma.property.findUnique({
        where: { id: dto.propertyId },
      });

      if (!property) {
        throw new NotFoundException(`Immobilie mit ID "${dto.propertyId}" nicht gefunden`);
      }

      for (const [varName, varDef] of Object.entries(variables)) {
        if (varDef.source?.startsWith('property.')) {
          const propField = varDef.source.slice('property.'.length);
          const rawValue = (property as unknown as Record<string, unknown>)[propField];

          if (rawValue !== null && rawValue !== undefined) {
            const numValue = Number(rawValue);
            if (!isNaN(numValue)) {
              usedValues[varName] = numValue;
            }
          }
        }
      }
    }

    // Schritt 4: Overrides anwenden (überschreiben alles andere)
    if (dto.overrides) {
      for (const [key, value] of Object.entries(dto.overrides)) {
        usedValues[key] = value;
      }
    }

    // Schritt 5: Variablen in den Ausdruck einsetzen
    let expression = formulaJson.expression;

    // Alle {varName} durch Zahlen ersetzen
    const varPattern = /\{([^}]+)\}/g;
    const allVarNames = Array.from(expression.matchAll(varPattern)).map((m) => m[1]);

    for (const varName of allVarNames) {
      if (!(varName in usedValues)) {
        throw new BadRequestException(
          `Variable "${varName}" hat keinen Wert. Bitte über overrides einen Wert übergeben.`,
        );
      }
    }

    const resolvedExpression = expression.replace(varPattern, (_match, varName: string) => {
      return String(usedValues[varName]);
    });

    // Schritt 6: Auswertung mit sicherem Parser
    this.logger.debug(`Berechne Ausdruck: ${resolvedExpression}`);

    let result: number;
    try {
      result = evaluateMath(resolvedExpression);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Fehler bei der Formelauswertung: ${message}`);
    }

    if (!isFinite(result)) {
      throw new BadRequestException('Formel ergibt einen ungültigen Wert (unendlich oder NaN)');
    }

    return {
      result: Math.round(result * 100) / 100,
      unit: formulaRecord.resultUnit,
      usedValues,
      expression: resolvedExpression,
    };
  }

  // ─── Hilfsmethoden ────────────────────────────────────────────────────────

  private async ensureActivityTypeExists(activityTypeId: string): Promise<void> {
    const exists = await this.prisma.activityType.findUnique({
      where: { id: activityTypeId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException(
        `Tätigkeit mit ID "${activityTypeId}" wurde nicht gefunden`,
      );
    }
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, WorkOrderStatus, WorkOrderPriority } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';
import { CompleteWorkOrderDto } from './dto/complete-work-order.dto';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type StaffSummary = {
  id: string;
  staffNumber: string;
  firstName: string;
  lastName: string;
  color: string;
};

export type WorkOrderWithRelations = Prisma.WorkOrderGetPayload<{
  include: {
    property: true;
    customer: true;
    activityType: {
      include: {
        requiredSkills: true;
        defaultEquipment: true;
        timeFormulas: true;
      };
    };
    equipment: {
      include: { equipment: true };
    };
  };
}> & { assignedStaffDetails?: StaffSummary[] };

export type PreviousOrderInfo = {
  id: string;
  orderNumber: string;
  plannedDate: Date | null;
  actualDurationMin: number | null;
  plannedDurationMin: number | null;
  completionNotes: string | null;
};

export interface PaginatedWorkOrders {
  data: WorkOrderWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CalculationParams {
  formulaId?: string;
  usedValues?: Record<string, number | null>;
  expression?: string;
  source: 'formula' | 'previous' | 'manual' | 'default';
  calculatedAt?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class WorkOrdersService {
  private readonly logger = new Logger(WorkOrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Alle Aufträge abrufen ────────────────────────────────────────────────

  async findAll(query: QueryWorkOrdersDto): Promise<PaginatedWorkOrders> {
    const { status, propertyId, assignedStaffId, activityTypeId, priority, from, to, search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkOrderWhereInput = {};

    if (status) {
      where.status = status as WorkOrderStatus;
    }

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (activityTypeId) {
      where.activityTypeId = activityTypeId;
    }

    if (priority) {
      where.priority = priority as WorkOrderPriority;
    }

    if (assignedStaffId) {
      // assignedStaff is a UUID[] column — filter via has
      where.assignedStaff = { has: assignedStaffId };
    }

    if (from || to) {
      where.plannedDate = {};
      if (from) {
        (where.plannedDate as Prisma.DateTimeNullableFilter).gte = new Date(from);
      }
      if (to) {
        (where.plannedDate as Prisma.DateTimeNullableFilter).lte = new Date(to);
      }
    }

    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { title: { contains: term, mode: Prisma.QueryMode.insensitive } },
        { orderNumber: { contains: term, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    const include = this.buildInclude();

    const [raw, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        include,
        orderBy: [{ plannedDate: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.workOrder.count({ where }),
    ]);

    const data = await this.enrichWithStaff(raw);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Einzelnen Auftrag abrufen ────────────────────────────────────────────

  async findOne(id: string): Promise<WorkOrderWithRelations> {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id },
      include: this.buildInclude(),
    });

    if (!workOrder) {
      throw new NotFoundException(`Auftrag mit ID "${id}" wurde nicht gefunden`);
    }

    const [enriched] = await this.enrichWithStaff([workOrder]);
    return enriched;
  }

  // ─── Vorherigen Auftrag (Zeitübernahme) ──────────────────────────────────

  async findPrevious(id: string): Promise<PreviousOrderInfo | null> {
    const current = await this.prisma.workOrder.findUnique({
      where: { id },
      select: { propertyId: true, activityTypeId: true },
    });

    if (!current) {
      throw new NotFoundException(`Auftrag mit ID "${id}" wurde nicht gefunden`);
    }

    return this.findPreviousOrder(current.propertyId, current.activityTypeId, id);
  }

  // ─── Dauer-Vorschau für Wizard ───────────────────────────────────────────

  async calculateDurationPreview(
    propertyId: string,
    activityTypeId: string,
  ): Promise<{
    previousOrder: PreviousOrderInfo | null;
    calculatedDurationMin: number | null;
    calculationSource: 'previous' | 'formula' | 'default';
  }> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        totalAreaSqm: true,
        greenAreaSqm: true,
        floors: true,
        metadata: true,
      },
    });
    if (!property) {
      throw new NotFoundException(`Immobilie mit ID "${propertyId}" wurde nicht gefunden`);
    }

    const activityType = await this.prisma.activityType.findUnique({
      where: { id: activityTypeId },
      include: {
        timeFormulas: { where: { isActive: true } },
      },
    });
    if (!activityType) {
      throw new NotFoundException(`Tätigkeit mit ID "${activityTypeId}" wurde nicht gefunden`);
    }

    const previousOrder = await this.findPreviousOrder(propertyId, activityTypeId);
    const previousDurationMin =
      previousOrder?.actualDurationMin ?? previousOrder?.plannedDurationMin ?? null;

    const { durationMin, params } = this.computeDuration(
      activityType,
      property,
      previousDurationMin,
    );

    return {
      previousOrder,
      calculatedDurationMin: durationMin,
      calculationSource: params.source as 'previous' | 'formula' | 'default',
    };
  }

  // ─── Auftrag erstellen ────────────────────────────────────────────────────

  async create(dto: CreateWorkOrderDto, createdBy: string): Promise<WorkOrderWithRelations> {
    this.logger.log(`Erstelle neuen Auftrag für Immobilie ${dto.propertyId}`);

    // 1. Immobilie laden → customerId bestimmen
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
      select: {
        id: true,
        customerId: true,
        totalAreaSqm: true,
        greenAreaSqm: true,
        floors: true,
        metadata: true,
      },
    });

    if (!property) {
      throw new NotFoundException(`Immobilie mit ID "${dto.propertyId}" wurde nicht gefunden`);
    }

    // 2. Tätigkeit laden (inkl. Fähigkeiten + Formeln)
    const activityType = await this.prisma.activityType.findUnique({
      where: { id: dto.activityTypeId },
      include: {
        requiredSkills: true,
        defaultEquipment: true,
        timeFormulas: { where: { isActive: true } },
      },
    });

    if (!activityType) {
      throw new NotFoundException(`Tätigkeit mit ID "${dto.activityTypeId}" wurde nicht gefunden`);
    }

    // 3. Mitarbeiter-Fähigkeiten validieren
    if (dto.assignedStaff && dto.assignedStaff.length > 0) {
      await this.validateStaffSkills(dto.assignedStaff, activityType.requiredSkills);
    }

    // 4. Vorherigen Auftrag suchen
    const previousOrder = await this.findPreviousOrder(dto.propertyId, dto.activityTypeId);
    const previousOrderId = previousOrder?.id ?? null;
    const previousDurationMin = previousOrder?.actualDurationMin ?? previousOrder?.plannedDurationMin ?? null;

    // 5. Automatische Zeitberechnung
    let plannedDurationMin = dto.plannedDurationMin ?? null;
    let calculationParams: CalculationParams | null = null;

    if (plannedDurationMin == null) {
      const computed = this.computeDuration(
        activityType,
        property,
        previousDurationMin,
      );
      plannedDurationMin = computed.durationMin;
      calculationParams = computed.params;
    } else {
      calculationParams = { source: 'manual', calculatedAt: new Date().toISOString() };
    }

    // 6. Nummernvergabe via NumberSequenceService (prisma.nextSequenceNumber)
    const orderNumber = await this.prisma.nextSequenceNumber(1);

    // 7. Gerätezuordnung: Standard-Ausstattung verwenden wenn keine angegeben
    const equipmentIds: string[] =
      dto.assignedEquipment && dto.assignedEquipment.length > 0
        ? dto.assignedEquipment
        : activityType.defaultEquipment.map((e) => e.id);

    // 8. Auftrag anlegen
    const workOrder = await this.prisma.workOrder.create({
      data: {
        orderNumber,
        propertyId: dto.propertyId,
        customerId: property.customerId,
        activityTypeId: dto.activityTypeId,
        title: dto.title,
        description: dto.description ?? null,
        status: WorkOrderStatus.DRAFT,
        priority: (dto.priority ?? 'NORMAL') as WorkOrderPriority,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : null,
        plannedStartTime: dto.plannedStartTime
          ? this.parseTimeString(dto.plannedStartTime)
          : null,
        plannedDurationMin,
        assignedStaff: dto.assignedStaff ?? [],
        assignedEquipment: equipmentIds,
        calculationParams: (calculationParams as unknown) as Prisma.InputJsonValue,
        previousOrderId,
        previousDurationMin,
        notes: dto.notes ?? null,
        createdBy,
        // WorkOrderEquipment junction records
        equipment: {
          create: equipmentIds.map((equipmentId) => ({
            equipmentId,
            quantity: 1,
          })),
        },
      },
      include: this.buildInclude(),
    });

    this.logger.log(`Auftrag ${orderNumber} erfolgreich angelegt`);
    return workOrder;
  }

  // ─── Auftrag aktualisieren ────────────────────────────────────────────────

  async update(id: string, dto: UpdateWorkOrderDto, updatedBy: string): Promise<WorkOrderWithRelations> {
    const existing = await this.findOne(id);

    // Mitarbeiter-Fähigkeiten validieren wenn neue Staff-Zuweisung
    if (dto.assignedStaff && dto.assignedStaff.length > 0) {
      await this.validateStaffSkills(dto.assignedStaff, existing.activityType.requiredSkills);
    }

    // Neuberechnung wenn activityTypeId oder propertyId geändert wird
    let recalcParams: CalculationParams | null = null;
    if (dto.activityTypeId || dto.propertyId) {
      const newActivityTypeId = dto.activityTypeId ?? existing.activityTypeId;
      const newPropertyId = dto.propertyId ?? existing.propertyId;

      if (dto.plannedDurationMin == null) {
        const [newActivityType, newProperty] = await Promise.all([
          this.prisma.activityType.findUnique({
            where: { id: newActivityTypeId },
            include: { timeFormulas: { where: { isActive: true } } },
          }),
          this.prisma.property.findUnique({
            where: { id: newPropertyId },
            select: { id: true, totalAreaSqm: true, greenAreaSqm: true, floors: true, metadata: true },
          }),
        ]);

        if (newActivityType && newProperty) {
          const computed = this.computeDuration(newActivityType, newProperty, null);
          recalcParams = computed.params;
          dto = { ...dto, plannedDurationMin: computed.durationMin };
        }
      }
    }

    // Gerätezuordnung aktualisieren
    if (dto.assignedEquipment !== undefined) {
      await this.prisma.workOrderEquipment.deleteMany({ where: { workOrderId: id } });
      if (dto.assignedEquipment.length > 0) {
        await this.prisma.workOrderEquipment.createMany({
          data: dto.assignedEquipment.map((equipmentId) => ({
            workOrderId: id,
            equipmentId,
            quantity: 1,
          })),
        });
      }
    }

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        ...(dto.propertyId !== undefined && { propertyId: dto.propertyId }),
        ...(dto.activityTypeId !== undefined && { activityTypeId: dto.activityTypeId }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status as WorkOrderStatus }),
        ...(dto.priority !== undefined && { priority: dto.priority as WorkOrderPriority }),
        ...(dto.plannedDate !== undefined && {
          plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : null,
        }),
        ...(dto.plannedStartTime !== undefined && {
          plannedStartTime: dto.plannedStartTime
            ? this.parseTimeString(dto.plannedStartTime)
            : null,
        }),
        ...(dto.plannedDurationMin !== undefined && { plannedDurationMin: dto.plannedDurationMin }),
        ...(dto.assignedStaff !== undefined && { assignedStaff: dto.assignedStaff }),
        ...(dto.assignedEquipment !== undefined && { assignedEquipment: dto.assignedEquipment }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.completionNotes !== undefined && { completionNotes: dto.completionNotes }),
        ...(recalcParams !== null && { calculationParams: (recalcParams as unknown) as Prisma.InputJsonValue }),
      },
      include: this.buildInclude(),
    });

    void updatedBy; // used for audit logging in production
    return updated;
  }

  // ─── Auftrag löschen (nur DRAFT) ─────────────────────────────────────────

  async remove(id: string): Promise<WorkOrderWithRelations> {
    const workOrder = await this.findOne(id);

    if (workOrder.status !== WorkOrderStatus.DRAFT) {
      throw new BadRequestException(
        `Auftrag kann nur im Status DRAFT gelöscht werden (aktuell: ${workOrder.status})`,
      );
    }

    return this.prisma.workOrder.delete({
      where: { id },
      include: this.buildInclude(),
    });
  }

  // ─── Auftrag abschließen ──────────────────────────────────────────────────

  async complete(id: string, dto: CompleteWorkOrderDto): Promise<WorkOrderWithRelations> {
    const workOrder = await this.findOne(id);

    if (workOrder.status === WorkOrderStatus.COMPLETED) {
      throw new BadRequestException('Auftrag ist bereits abgeschlossen');
    }

    if (workOrder.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException('Ein stornierter Auftrag kann nicht abgeschlossen werden');
    }

    const actualEnd = new Date();
    let actualDurationMin = dto.actualDurationMin ?? null;

    // Automatische Berechnung wenn actualStart bekannt
    if (actualDurationMin == null && workOrder.actualStart) {
      const diffMs = actualEnd.getTime() - workOrder.actualStart.getTime();
      actualDurationMin = Math.round(diffMs / 60000);
    }

    // Fallback: geplante Dauer übernehmen
    if (actualDurationMin == null) {
      actualDurationMin = workOrder.plannedDurationMin ?? null;
    }

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.COMPLETED,
        actualEnd,
        actualDurationMin,
        completionNotes: dto.completionNotes ?? workOrder.completionNotes,
      },
      include: this.buildInclude(),
    });
  }

  // ─── Private Hilfsmethoden ────────────────────────────────────────────────

  private async enrichWithStaff<T extends { assignedStaff: string[] }>(
    orders: T[],
  ): Promise<(T & { assignedStaffDetails: StaffSummary[] })[]> {
    const allIds = [...new Set(orders.flatMap((o) => o.assignedStaff))];
    if (allIds.length === 0) {
      return orders.map((o) => ({ ...o, assignedStaffDetails: [] }));
    }
    const staffList = await this.prisma.staff.findMany({
      where: { id: { in: allIds } },
      select: { id: true, staffNumber: true, firstName: true, lastName: true, color: true },
    });
    const staffMap = new Map(staffList.map((s) => [s.id, s]));
    return orders.map((o) => ({
      ...o,
      assignedStaffDetails: o.assignedStaff
        .map((id) => staffMap.get(id))
        .filter((s): s is StaffSummary => s != null),
    }));
  }

  private buildInclude() {
    return {
      property: true,
      customer: true,
      activityType: {
        include: {
          requiredSkills: true,
          defaultEquipment: true,
          timeFormulas: true,
        },
      },
      equipment: {
        include: { equipment: true },
      },
    } as const;
  }

  private async findPreviousOrder(
    propertyId: string,
    activityTypeId: string,
    excludeId?: string,
  ): Promise<PreviousOrderInfo | null> {
    const where: Prisma.WorkOrderWhereInput = {
      propertyId,
      activityTypeId,
      status: WorkOrderStatus.COMPLETED,
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const order = await this.prisma.workOrder.findFirst({
      where,
      orderBy: { plannedDate: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        plannedDate: true,
        actualDurationMin: true,
        plannedDurationMin: true,
        completionNotes: true,
      },
    });

    return order;
  }

  private computeDuration(
    activityType: {
      defaultDurationMin: number;
      timeFormulas: Array<{
        id: string;
        formula: Prisma.JsonValue;
        variables: Prisma.JsonValue;
        defaultValues: Prisma.JsonValue | null;
        isActive: boolean;
      }>;
    },
    property: {
      totalAreaSqm: Prisma.Decimal | null;
      greenAreaSqm: Prisma.Decimal | null;
      floors: number;
      metadata: Prisma.JsonValue | null;
    },
    previousDurationMin: number | null,
  ): { durationMin: number; params: CalculationParams } {
    // Priorität 1: Vorherige Auftragsdauer
    if (previousDurationMin != null && previousDurationMin > 0) {
      return {
        durationMin: previousDurationMin,
        params: {
          source: 'previous',
          calculatedAt: new Date().toISOString(),
        },
      };
    }

    // Priorität 2: Aktive Zeitformel berechnen
    const activeFormula = activityType.timeFormulas.find((f) => f.isActive);
    if (activeFormula) {
      const computed = this.evaluateFormula(activeFormula, property);
      if (computed !== null && computed > 0) {
        return {
          durationMin: Math.round(computed),
          params: {
            source: 'formula',
            formulaId: activeFormula.id,
            expression: this.getExpression(activeFormula.formula),
            usedValues: this.extractUsedValues(activeFormula, property),
            calculatedAt: new Date().toISOString(),
          },
        };
      }
    }

    // Fallback: Standard-Dauer der Tätigkeit
    return {
      durationMin: activityType.defaultDurationMin,
      params: {
        source: 'default',
        calculatedAt: new Date().toISOString(),
      },
    };
  }

  private evaluateFormula(
    formula: {
      formula: Prisma.JsonValue;
      variables: Prisma.JsonValue;
      defaultValues: Prisma.JsonValue | null;
    },
    property: {
      totalAreaSqm: Prisma.Decimal | null;
      greenAreaSqm: Prisma.Decimal | null;
      floors: number;
      metadata: Prisma.JsonValue | null;
    },
  ): number | null {
    try {
      const formulaObj = formula.formula as Record<string, unknown>;
      const expression = formulaObj['expression'];
      if (typeof expression !== 'string') return null;

      const variables = (formula.variables ?? []) as Array<{ name: string; propertyField?: string }>;
      const defaultValues = (formula.defaultValues ?? {}) as Record<string, number>;
      const metadata = (property.metadata ?? {}) as Record<string, unknown>;

      // Variablenwerte aus Immobilien-Daten befüllen
      const varValues: Record<string, number> = {};

      for (const variable of variables) {
        const name = variable.name;
        const field = variable.propertyField;

        let value: number | null = null;

        if (field === 'total_area_sqm' && property.totalAreaSqm != null) {
          value = Number(property.totalAreaSqm);
        } else if (field === 'green_area_sqm' && property.greenAreaSqm != null) {
          value = Number(property.greenAreaSqm);
        } else if (field === 'floors') {
          value = property.floors;
        } else if (field && metadata[field] != null) {
          const metaVal = metadata[field];
          if (typeof metaVal === 'number') value = metaVal;
        }

        // Default-Wert wenn kein Immobilienwert
        if (value === null && defaultValues[name] != null) {
          value = defaultValues[name];
        }

        if (value !== null) {
          varValues[name] = value;
        }
      }

      // Sichere Auswertung: Expression mit Variablen ersetzen und eval-frei berechnen
      const result = this.safeEvaluateExpression(expression, varValues);
      return result;
    } catch (err) {
      this.logger.warn(`Formelberechnung fehlgeschlagen: ${String(err)}`);
      return null;
    }
  }

  /**
   * Sichere Auswertung einfacher arithmetischer Ausdrücke.
   * Unterstützt: +, -, *, /, (, ), Variablen, Zahlen.
   * Kein eval() — stattdessen String-Ersetzung + Function-Constructor mit strikter Whitelist.
   */
  private safeEvaluateExpression(expression: string, variables: Record<string, number>): number | null {
    let expr = expression;

    // Variablen mit Werten ersetzen
    for (const [name, value] of Object.entries(variables)) {
      // Escaped Variablenname für Regex
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expr = expr.replace(new RegExp(`\\b${escaped}\\b`, 'g'), String(value));
    }

    // Prüfen ob nur erlaubte Zeichen vorhanden sind: Zahlen, Leerzeichen, Operatoren, Klammern, Punkt
    if (!/^[0-9\s+\-*/().]+$/.test(expr)) {
      this.logger.warn(`Unsichere Formel-Expression nach Variablenersetzung: ${expr}`);
      return null;
    }

    // Auswertung via Function-Constructor (sicher da nach Whitelist-Prüfung)
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const result = new Function(`return (${expr})`)() as unknown;
    if (typeof result === 'number' && isFinite(result)) {
      return result;
    }
    return null;
  }

  private getExpression(formulaJson: Prisma.JsonValue): string | undefined {
    const obj = formulaJson as Record<string, unknown>;
    return typeof obj['expression'] === 'string' ? obj['expression'] : undefined;
  }

  private extractUsedValues(
    formula: { variables: Prisma.JsonValue },
    property: { totalAreaSqm: Prisma.Decimal | null; greenAreaSqm: Prisma.Decimal | null; floors: number },
  ): Record<string, number | null> {
    const variables = (formula.variables ?? []) as Array<{ name: string; propertyField?: string }>;
    const result: Record<string, number | null> = {};

    for (const variable of variables) {
      const field = variable.propertyField;
      if (field === 'total_area_sqm') {
        result[variable.name] = property.totalAreaSqm != null ? Number(property.totalAreaSqm) : null;
      } else if (field === 'green_area_sqm') {
        result[variable.name] = property.greenAreaSqm != null ? Number(property.greenAreaSqm) : null;
      } else if (field === 'floors') {
        result[variable.name] = property.floors;
      } else {
        result[variable.name] = null;
      }
    }

    return result;
  }

  private async validateStaffSkills(
    staffIds: string[],
    requiredSkills: Array<{ id: string; name: string }>,
  ): Promise<void> {
    if (requiredSkills.length === 0) return;

    const requiredSkillIds = requiredSkills.map((s) => s.id);

    const staffWithSkills = await this.prisma.staff.findMany({
      where: { id: { in: staffIds } },
      include: { skills: { select: { skillId: true } } },
    });

    for (const staff of staffWithSkills) {
      const staffSkillIds = staff.skills.map((s) => s.skillId);
      const missingSkills = requiredSkills.filter(
        (s) => !staffSkillIds.includes(s.id),
      );

      if (missingSkills.length > 0) {
        const missingNames = missingSkills.map((s) => s.name).join(', ');
        throw new BadRequestException(
          `Mitarbeiter ${staff.firstName} ${staff.lastName} hat nicht die erforderlichen Fähigkeiten: ${missingNames}`,
        );
      }
    }

    // Prüfen ob alle angegebenen Staff-IDs existieren
    const foundIds = staffWithSkills.map((s) => s.id);
    const notFound = staffIds.filter((id) => !foundIds.includes(id));
    if (notFound.length > 0) {
      throw new BadRequestException(
        `Folgende Mitarbeiter-IDs wurden nicht gefunden: ${notFound.join(', ')}`,
      );
    }

    void requiredSkillIds; // used in loop above
  }

  /**
   * Zeitstring "HH:MM" in Date-Objekt für Prisma @db.Time() konvertieren.
   * Prisma speichert Time als DateTime mit Datum 1970-01-01.
   */
  private parseTimeString(time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const d = new Date(1970, 0, 1, hours ?? 0, minutes ?? 0, 0, 0);
    return d;
  }
}

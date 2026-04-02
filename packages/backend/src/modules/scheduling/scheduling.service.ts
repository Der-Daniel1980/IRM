import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SuggestScheduleDto } from './dto/suggest-schedule.dto';
import { ReplanDto } from './dto/replan.dto';
import { AvailabilityQueryDto } from './dto/availability.dto';
import { AbsenceStatus, SkillLevel, WorkOrderStatus } from '@prisma/client';

// ─── Response-Typen ──────────────────────────────────────────────────────────

export interface ScheduleSuggestion {
  staffId: string;
  staffName: string;
  date: string;
  startTime: string;
  endTime: string;
  distanceKm: number | null;
  score: number;
  isRecommended: boolean;
  reason: string;
}

export interface SuggestScheduleResponse {
  suggestions: ScheduleSuggestion[];
}

export interface ReplanAffectedOrder {
  orderId: string;
  orderNumber: string;
  title: string;
  plannedDate: string | null;
  suggestion: ScheduleSuggestion | null;
}

export interface ReplanResponse {
  affectedOrders: ReplanAffectedOrder[];
}

export interface DayAvailability {
  date: string;
  isAvailable: boolean;
  reason: string | null;
  ordersCount: number;
}

export interface AvailabilityResponse {
  staffId: string;
  days: DayAvailability[];
}

// ─── Interne Hilfstypen ──────────────────────────────────────────────────────

interface QualifiedStaff {
  id: string;
  firstName: string;
  lastName: string;
  latitude: number | null;
  longitude: number | null;
  avgSkillLevel: number;
}

interface TimeSlot {
  start: number; // Minuten ab 00:00
  end: number;   // Minuten ab 00:00
}

interface ExistingOrder {
  id: string;
  plannedStartTime: Date | null;
  plannedDurationMin: number | null;
  propertyId: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  private readonly workDayStartMin: number;
  private readonly workDayEndMin: number;
  private readonly bufferMin: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const startStr = this.config.get<string>('app.scheduling.workDayStart', '07:00');
    const endStr = this.config.get<string>('app.scheduling.workDayEnd', '17:00');
    this.bufferMin = this.config.get<number>('app.scheduling.bufferBetweenOrdersMin', 15);
    this.workDayStartMin = this.parseTimeToMinutes(startStr);
    this.workDayEndMin = this.parseTimeToMinutes(endStr);
  }

  // ─── Terminvorschläge ────────────────────────────────────────────────────

  async suggestSchedule(dto: SuggestScheduleDto): Promise<SuggestScheduleResponse> {
    const maxSuggestions = dto.maxSuggestions ?? 5;
    const preferredDate = dto.preferredDate ? new Date(dto.preferredDate) : new Date();
    const durationMin = dto.durationMin;

    // 1. Tätigkeitstyp laden (mit required Skills + Saisonalität)
    const activityType = await this.prisma.activityType.findUnique({
      where: { id: dto.activityTypeId },
      include: { requiredSkills: { select: { id: true } } },
    });

    if (!activityType) {
      throw new NotFoundException(
        `Tätigkeitstyp mit ID "${dto.activityTypeId}" wurde nicht gefunden`,
      );
    }

    // 2. Immobilie laden
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
      select: { id: true, latitude: true, longitude: true },
    });

    if (!property) {
      throw new NotFoundException(
        `Immobilie mit ID "${dto.propertyId}" wurde nicht gefunden`,
      );
    }

    // 3. Qualifizierte Mitarbeiter finden
    const requiredSkillIds = activityType.requiredSkills.map((s) => s.id);
    const qualifiedStaff = await this.findQualifiedStaff(requiredSkillIds);

    if (qualifiedStaff.length === 0) {
      this.logger.warn('Keine qualifizierten Mitarbeiter gefunden');
      return { suggestions: [] };
    }

    // 4. Vorschläge generieren
    const suggestions: ScheduleSuggestion[] = [];
    const maxDays = 14;

    for (let dayOffset = 0; dayOffset < maxDays && suggestions.length < maxSuggestions * 3; dayOffset++) {
      const candidateDate = new Date(preferredDate);
      candidateDate.setDate(candidateDate.getDate() + dayOffset);

      // Wochenende überspringen (0 = Sonntag, 6 = Samstag)
      const dayOfWeek = candidateDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        continue;
      }

      // Saisonalitäts-Check
      if (!this.isInSeason(candidateDate, activityType.seasonStart, activityType.seasonEnd)) {
        continue;
      }

      const dateStr = this.formatDate(candidateDate);

      for (const staff of qualifiedStaff) {
        if (suggestions.length >= maxSuggestions * 3) break;

        // a) Abwesenheits-Check
        const isAbsent = await this.isStaffAbsent(staff.id, candidateDate);
        if (isAbsent) continue;

        // b) Bestehende Aufträge laden
        const existingOrders = await this.getExistingOrders(staff.id, candidateDate);

        // c) Freie Zeitslots finden
        const freeSlots = this.findFreeSlots(existingOrders, durationMin);

        if (freeSlots.length === 0) continue;

        // Besten freien Slot nehmen (frühester)
        const bestSlot = freeSlots[0];

        // d) Entfernung berechnen
        let distanceKm: number | null = null;
        const lastOrder = this.getLastOrderBefore(existingOrders, bestSlot.start);

        if (lastOrder) {
          // Entfernung vom letzten Einsatzort
          distanceKm = await this.calculateDistanceBetweenProperties(
            lastOrder.propertyId,
            dto.propertyId,
          );
        } else if (staff.latitude !== null && staff.longitude !== null) {
          // Entfernung vom Wohnort
          distanceKm = await this.calculateDistanceFromStaff(
            staff.longitude,
            staff.latitude,
            dto.propertyId,
          );
        }

        // Score berechnen
        const skillLevelBonus = staff.avgSkillLevel;
        const distanceScore = distanceKm !== null
          ? Math.max(0, 1 - distanceKm / 50)
          : 0.5; // Fallback wenn keine Entfernung berechenbar
        const dateProximityScore = 1 - dayOffset / 14;

        const score = Math.round(
          (skillLevelBonus * 30 + distanceScore * 40 + dateProximityScore * 30) * 10,
        ) / 10;

        const startTimeStr = this.minutesToTimeString(bestSlot.start);
        const endTimeStr = this.minutesToTimeString(bestSlot.start + durationMin);

        // Grund bestimmen
        const reasons: string[] = [];
        if (skillLevelBonus >= 0.9) reasons.push('Experte');
        if (distanceKm !== null && distanceKm < 5) reasons.push('Geringste Fahrzeit');
        if (dayOffset === 0) reasons.push('Wunschtermin verfügbar');
        if (lastOrder) reasons.push('Naher Folgeeinsatz');

        suggestions.push({
          staffId: staff.id,
          staffName: `${staff.lastName}, ${staff.firstName}`,
          date: dateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          distanceKm: distanceKm !== null ? Math.round(distanceKm * 10) / 10 : null,
          score,
          isRecommended: false,
          reason: reasons.length > 0 ? reasons.join(', ') : 'Verfügbar',
        });
      }
    }

    // Sortieren nach Score (absteigend)
    suggestions.sort((a, b) => b.score - a.score);

    // Auf maxSuggestions begrenzen
    const topSuggestions = suggestions.slice(0, maxSuggestions);

    // Besten Vorschlag markieren
    if (topSuggestions.length > 0) {
      topSuggestions[0].isRecommended = true;
    }

    return { suggestions: topSuggestions };
  }

  // ─── Umplanung ───────────────────────────────────────────────────────────

  async replan(dto: ReplanDto): Promise<ReplanResponse> {
    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);

    // Betroffene Aufträge laden
    const affectedOrders = await this.prisma.workOrder.findMany({
      where: {
        assignedStaff: { has: dto.staffId },
        plannedDate: { gte: fromDate, lte: toDate },
        status: { in: [WorkOrderStatus.PLANNED, WorkOrderStatus.ASSIGNED] },
      },
      include: {
        activityType: true,
        property: { select: { id: true, name: true } },
      },
      orderBy: { plannedDate: 'asc' },
    });

    this.logger.log(
      `Umplanung: ${affectedOrders.length} betroffene Aufträge für Mitarbeiter ${dto.staffId}`,
    );

    const result: ReplanAffectedOrder[] = [];

    for (const order of affectedOrders) {
      let suggestion: ScheduleSuggestion | null = null;

      try {
        const suggestResult = await this.suggestSchedule({
          workOrderId: order.id,
          activityTypeId: order.activityTypeId,
          propertyId: order.propertyId,
          durationMin: order.plannedDurationMin ?? order.activityType.defaultDurationMin,
          preferredDate: order.plannedDate
            ? this.formatDate(order.plannedDate)
            : undefined,
          maxSuggestions: 1,
        });

        // Vorschlag des ausgefallenen Mitarbeiters ausfiltern
        const filtered = suggestResult.suggestions.filter(
          (s) => s.staffId !== dto.staffId,
        );

        suggestion = filtered.length > 0 ? filtered[0] : null;
      } catch (err) {
        this.logger.warn(
          `Kein Ersatzvorschlag für Auftrag ${order.orderNumber}: ${String(err)}`,
        );
      }

      result.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        title: order.title,
        plannedDate: order.plannedDate ? this.formatDate(order.plannedDate) : null,
        suggestion,
      });
    }

    return { affectedOrders: result };
  }

  // ─── Verfügbarkeit ───────────────────────────────────────────────────────

  async getAvailability(dto: AvailabilityQueryDto): Promise<AvailabilityResponse> {
    const fromDate = new Date(dto.from);
    const toDate = new Date(dto.to);

    // Mitarbeiter prüfen
    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
      select: { id: true },
    });

    if (!staff) {
      throw new NotFoundException(
        `Mitarbeiter mit ID "${dto.staffId}" wurde nicht gefunden`,
      );
    }

    // Abwesenheiten im Zeitraum laden
    const absences = await this.prisma.absence.findMany({
      where: {
        staffId: dto.staffId,
        status: AbsenceStatus.APPROVED,
        startDate: { lte: toDate },
        endDate: { gte: fromDate },
      },
      select: { startDate: true, endDate: true, type: true },
    });

    // Aufträge im Zeitraum laden
    const orders = await this.prisma.workOrder.findMany({
      where: {
        assignedStaff: { has: dto.staffId },
        plannedDate: { gte: fromDate, lte: toDate },
        status: { notIn: [WorkOrderStatus.CANCELLED, WorkOrderStatus.COMPLETED] },
      },
      select: { plannedDate: true },
    });

    const days: DayAvailability[] = [];
    const current = new Date(fromDate);

    while (current <= toDate) {
      const dateStr = this.formatDate(current);

      // Abwesenheit für diesen Tag prüfen
      let absenceReason: string | null = null;
      for (const absence of absences) {
        if (current >= absence.startDate && current <= absence.endDate) {
          absenceReason = absence.type;
          break;
        }
      }

      // Aufträge an diesem Tag zählen
      const ordersCount = orders.filter((o) => {
        if (!o.plannedDate) return false;
        return this.formatDate(o.plannedDate) === dateStr;
      }).length;

      days.push({
        date: dateStr,
        isAvailable: absenceReason === null,
        reason: absenceReason,
        ordersCount,
      });

      current.setDate(current.getDate() + 1);
    }

    return { staffId: dto.staffId, days };
  }

  // ─── Private Hilfsmethoden ─────────────────────────────────────────────

  /**
   * Findet alle aktiven Mitarbeiter, die ALLE erforderlichen Skills besitzen.
   * Berechnet den durchschnittlichen Skill-Level (EXPERT=1.0, INTERMEDIATE=0.7, BASIC=0.4).
   */
  private async findQualifiedStaff(
    requiredSkillIds: string[],
  ): Promise<QualifiedStaff[]> {
    if (requiredSkillIds.length === 0) {
      // Keine Skills erforderlich: alle aktiven Mitarbeiter qualifiziert
      const allStaff = await this.prisma.staff.findMany({
        where: { isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          latitude: true,
          longitude: true,
        },
      });

      return allStaff.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        latitude: s.latitude !== null ? Number(s.latitude) : null,
        longitude: s.longitude !== null ? Number(s.longitude) : null,
        avgSkillLevel: 0.5,
      }));
    }

    // Mitarbeiter mit ALLEN erforderlichen Skills finden
    const staffWithSkills = await this.prisma.staff.findMany({
      where: {
        isActive: true,
        skills: {
          some: {
            skillId: { in: requiredSkillIds },
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        latitude: true,
        longitude: true,
        skills: {
          where: { skillId: { in: requiredSkillIds } },
          select: { skillId: true, level: true },
        },
      },
    });

    // Nur Mitarbeiter die ALLE Skills haben
    const requiredCount = requiredSkillIds.length;
    const qualified: QualifiedStaff[] = [];

    for (const staff of staffWithSkills) {
      const matchedSkillIds = new Set(staff.skills.map((s) => s.skillId));
      const hasAll = requiredSkillIds.every((id) => matchedSkillIds.has(id));

      if (!hasAll) continue;

      // Durchschnittlichen Skill-Level berechnen
      const totalLevel = staff.skills.reduce((sum, s) => {
        return sum + this.skillLevelToNumber(s.level);
      }, 0);
      const avgSkillLevel = totalLevel / requiredCount;

      qualified.push({
        id: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        latitude: staff.latitude !== null ? Number(staff.latitude) : null,
        longitude: staff.longitude !== null ? Number(staff.longitude) : null,
        avgSkillLevel,
      });
    }

    return qualified;
  }

  /**
   * Prüft ob ein Mitarbeiter an einem bestimmten Tag abwesend ist (APPROVED Absence).
   */
  private async isStaffAbsent(staffId: string, date: Date): Promise<boolean> {
    const count = await this.prisma.absence.count({
      where: {
        staffId,
        status: AbsenceStatus.APPROVED,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
    return count > 0;
  }

  /**
   * Lädt alle bestehenden Aufträge eines Mitarbeiters an einem bestimmten Tag.
   */
  private async getExistingOrders(
    staffId: string,
    date: Date,
  ): Promise<ExistingOrder[]> {
    const dateStr = this.formatDate(date);
    const dayStart = new Date(dateStr);
    const dayEnd = new Date(dateStr);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const orders = await this.prisma.workOrder.findMany({
      where: {
        assignedStaff: { has: staffId },
        plannedDate: { gte: dayStart, lt: dayEnd },
        status: { notIn: [WorkOrderStatus.CANCELLED, WorkOrderStatus.COMPLETED] },
      },
      orderBy: { plannedStartTime: 'asc' },
      select: {
        id: true,
        plannedStartTime: true,
        plannedDurationMin: true,
        propertyId: true,
      },
    });

    return orders;
  }

  /**
   * Findet freie Zeitslots im Arbeitstag, in die ein Auftrag mit durationMin passt.
   */
  private findFreeSlots(
    existingOrders: ExistingOrder[],
    durationMin: number,
  ): TimeSlot[] {
    // Bestehende belegte Zeiträume sammeln
    const occupied: TimeSlot[] = [];

    for (const order of existingOrders) {
      if (order.plannedStartTime && order.plannedDurationMin) {
        const startMin = order.plannedStartTime.getUTCHours() * 60 +
          order.plannedStartTime.getUTCMinutes();
        const endMin = startMin + order.plannedDurationMin;
        occupied.push({ start: startMin, end: endMin });
      }
    }

    // Nach Startzeit sortieren
    occupied.sort((a, b) => a.start - b.start);

    // Freie Zeitslots finden
    const freeSlots: TimeSlot[] = [];
    let currentStart = this.workDayStartMin;

    for (const slot of occupied) {
      // Puffer vor dem belegten Slot
      const availableEnd = slot.start - this.bufferMin;
      if (availableEnd - currentStart >= durationMin) {
        freeSlots.push({
          start: currentStart,
          end: currentStart + durationMin,
        });
      }
      // Nach dem belegten Slot + Puffer weiter
      currentStart = Math.max(currentStart, slot.end + this.bufferMin);
    }

    // Slot nach dem letzten Auftrag
    if (this.workDayEndMin - currentStart >= durationMin) {
      freeSlots.push({
        start: currentStart,
        end: currentStart + durationMin,
      });
    }

    return freeSlots;
  }

  /**
   * Ermittelt den letzten Auftrag vor einem bestimmten Zeitpunkt.
   */
  private getLastOrderBefore(
    orders: ExistingOrder[],
    beforeMinutes: number,
  ): ExistingOrder | null {
    let lastOrder: ExistingOrder | null = null;

    for (const order of orders) {
      if (!order.plannedStartTime) continue;
      const startMin = order.plannedStartTime.getUTCHours() * 60 +
        order.plannedStartTime.getUTCMinutes();
      if (startMin < beforeMinutes) {
        lastOrder = order;
      }
    }

    return lastOrder;
  }

  /**
   * Berechnet die Entfernung zwischen zwei Immobilien via PostGIS.
   * Gibt null zurück wenn geo_point für eine der Immobilien nicht gesetzt ist.
   */
  private async calculateDistanceBetweenProperties(
    fromPropertyId: string,
    toPropertyId: string,
  ): Promise<number | null> {
    try {
      const result = await this.prisma.$queryRaw<Array<{ distance_km: number }>>`
        SELECT
          ST_Distance(
            a.geo_point::geography,
            b.geo_point::geography
          ) / 1000.0 AS distance_km
        FROM properties a, properties b
        WHERE a.id = ${fromPropertyId}::uuid
          AND b.id = ${toPropertyId}::uuid
          AND a.geo_point IS NOT NULL
          AND b.geo_point IS NOT NULL
      `;

      if (result.length > 0 && result[0].distance_km !== null) {
        return Number(result[0].distance_km);
      }
      return null;
    } catch (err) {
      this.logger.debug(`PostGIS Entfernungsberechnung fehlgeschlagen: ${String(err)}`);
      return this.calculateDistanceFallback(fromPropertyId, toPropertyId);
    }
  }

  /**
   * Berechnet die Entfernung vom Wohnort eines Mitarbeiters zur Immobilie via PostGIS.
   */
  private async calculateDistanceFromStaff(
    staffLng: number,
    staffLat: number,
    propertyId: string,
  ): Promise<number | null> {
    try {
      const result = await this.prisma.$queryRaw<Array<{ distance_km: number }>>`
        SELECT
          ST_Distance(
            ST_SetSRID(ST_MakePoint(${staffLng}, ${staffLat}), 4326)::geography,
            geo_point::geography
          ) / 1000.0 AS distance_km
        FROM properties
        WHERE id = ${propertyId}::uuid
          AND geo_point IS NOT NULL
      `;

      if (result.length > 0 && result[0].distance_km !== null) {
        return Number(result[0].distance_km);
      }
      return null;
    } catch (err) {
      this.logger.debug(`PostGIS Staff-Entfernungsberechnung fehlgeschlagen: ${String(err)}`);
      return this.calculateDistanceFromStaffFallback(staffLng, staffLat, propertyId);
    }
  }

  /**
   * Fallback-Entfernungsberechnung zwischen zwei Immobilien via Haversine (ohne PostGIS).
   */
  private async calculateDistanceFallback(
    fromPropertyId: string,
    toPropertyId: string,
  ): Promise<number | null> {
    const [fromProp, toProp] = await Promise.all([
      this.prisma.property.findUnique({
        where: { id: fromPropertyId },
        select: { latitude: true, longitude: true },
      }),
      this.prisma.property.findUnique({
        where: { id: toPropertyId },
        select: { latitude: true, longitude: true },
      }),
    ]);

    if (
      !fromProp?.latitude || !fromProp?.longitude ||
      !toProp?.latitude || !toProp?.longitude
    ) {
      return null;
    }

    return this.haversineDistance(
      Number(fromProp.latitude), Number(fromProp.longitude),
      Number(toProp.latitude), Number(toProp.longitude),
    );
  }

  /**
   * Fallback-Entfernungsberechnung vom Mitarbeiter-Wohnort (ohne PostGIS).
   */
  private async calculateDistanceFromStaffFallback(
    staffLng: number,
    staffLat: number,
    propertyId: string,
  ): Promise<number | null> {
    const prop = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { latitude: true, longitude: true },
    });

    if (!prop?.latitude || !prop?.longitude) {
      return null;
    }

    return this.haversineDistance(
      staffLat, staffLng,
      Number(prop.latitude), Number(prop.longitude),
    );
  }

  /**
   * Haversine-Formel zur Entfernungsberechnung in km.
   */
  private haversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
  ): number {
    const R = 6371; // Erdradius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  /**
   * Prüft ob ein Datum in der Saison einer Tätigkeit liegt.
   * Beachtet Wrap-around (z.B. November-März).
   */
  private isInSeason(
    date: Date,
    seasonStart: number | null,
    seasonEnd: number | null,
  ): boolean {
    if (seasonStart === null || seasonEnd === null) {
      return true; // Keine Saisonalität konfiguriert
    }

    const month = date.getMonth() + 1; // 1-12

    if (seasonStart <= seasonEnd) {
      // Normaler Bereich: z.B. März(3) - Oktober(10)
      return month >= seasonStart && month <= seasonEnd;
    } else {
      // Wrap-around: z.B. November(11) - März(3)
      return month >= seasonStart || month <= seasonEnd;
    }
  }

  /**
   * Konvertiert SkillLevel-Enum in numerischen Wert.
   */
  private skillLevelToNumber(level: SkillLevel): number {
    switch (level) {
      case SkillLevel.EXPERT:
        return 1.0;
      case SkillLevel.INTERMEDIATE:
        return 0.7;
      case SkillLevel.BASIC:
        return 0.4;
      default:
        return 0.4;
    }
  }

  /**
   * Parst "HH:MM" String zu Minuten ab Mitternacht.
   */
  private parseTimeToMinutes(timeStr: string): number {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1] ?? '0', 10);
    return hours * 60 + minutes;
  }

  /**
   * Konvertiert Minuten ab Mitternacht zu "HH:MM" String.
   */
  private minutesToTimeString(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /**
   * Formatiert ein Date-Objekt zu "YYYY-MM-DD".
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

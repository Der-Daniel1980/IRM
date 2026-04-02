import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Return-Typen ─────────────────────────────────────────────────────────────

export interface StatusCount {
  status: string;
  count: number;
}

export interface DashboardStats {
  todayOrdersTotal: number;
  todayByStatus: StatusCount[];
  availableStaffCount: number;
  activeStaffCount: number;
  openOrders: number;
  urgentOrders: number;
  absentToday: number;
  maintenanceDue: number;
}

export interface TodayOrderItem {
  id: string;
  orderNumber: string;
  title: string;
  status: string;
  priority: string;
  plannedStartTime: Date | null;
  plannedDurationMin: number | null;
  assignedStaff: string[];
  property: {
    id: string;
    propertyNumber: string;
    name: string;
    addressStreet: string;
    addressCity: string;
  };
  activityType: {
    id: string;
    code: string;
    name: string;
    icon: string;
    color: string;
  };
}

export interface StaffStatusItem {
  id: string;
  staffNumber: string;
  firstName: string;
  lastName: string;
  color: string;
  status: 'AVAILABLE' | 'IN_PROGRESS' | 'ABSENT';
  absenceType?: string;
}

export interface MaintenanceDueItem {
  id: string;
  equipmentNumber: string;
  name: string;
  category: string;
  status: string;
  nextMaintenance: Date | null;
  daysUntilDue: number;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

interface RawCountRow {
  count: bigint;
}

interface RawStatusRow {
  status: string;
  count: bigint;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const maintenanceCutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [
      todayOrdersTotal,
      todayByStatusRaw,
      availableStaffRaw,
      activeStaffCount,
      openOrders,
      urgentOrders,
      absentToday,
      maintenanceDue,
    ] = await Promise.all([
      // Heutige Aufträge gesamt
      this.prisma.workOrder.count({
        where: { plannedDate: today },
      }),

      // Status-Verteilung heute
      this.prisma.workOrder.groupBy({
        by: ['status'],
        where: { plannedDate: today },
        _count: true,
      }),

      // Verfügbare Mitarbeiter: aktiv, keine genehmigte Abwesenheit heute
      this.prisma.$queryRaw<RawCountRow[]>`
        SELECT COUNT(*)::bigint AS count
        FROM staff s
        WHERE s.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM absences a
            WHERE a.staff_id = s.id
              AND a.status = 'APPROVED'
              AND ${todayStr}::date BETWEEN a.start_date AND a.end_date
          )
      `,

      // Im Einsatz: Aufträge mit Status IN_PROGRESS heute
      this.prisma.workOrder.count({
        where: {
          plannedDate: today,
          status: 'IN_PROGRESS',
        },
      }),

      // Offene Aufträge: DRAFT oder PLANNED (unabhängig vom Datum)
      this.prisma.workOrder.count({
        where: {
          status: { in: ['DRAFT', 'PLANNED'] },
        },
      }),

      // Urgente Aufträge: noch nicht abgeschlossen/storniert
      this.prisma.workOrder.count({
        where: {
          priority: 'URGENT',
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      }),

      // Abwesende Mitarbeiter heute (genehmigte Abwesenheiten)
      this.prisma.absence.count({
        where: {
          status: 'APPROVED',
          startDate: { lte: today },
          endDate: { gte: today },
        },
      }),

      // Wartungen fällig innerhalb der nächsten 7 Tage
      this.prisma.equipment.count({
        where: {
          nextMaintenance: { lte: maintenanceCutoff },
          status: { not: 'BROKEN' },
        },
      }),
    ]);

    const availableStaffCount = Number((availableStaffRaw[0] as RawCountRow)?.count ?? 0);

    const todayByStatus: StatusCount[] = todayByStatusRaw.map((row) => ({
      status: row.status,
      count: row._count,
    }));

    return {
      todayOrdersTotal,
      todayByStatus,
      availableStaffCount,
      activeStaffCount,
      openOrders,
      urgentOrders,
      absentToday,
      maintenanceDue,
    };
  }

  async getTodayOrders(): Promise<TodayOrderItem[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await this.prisma.workOrder.findMany({
      where: { plannedDate: today },
      include: {
        property: {
          select: {
            id: true,
            propertyNumber: true,
            name: true,
            addressStreet: true,
            addressCity: true,
          },
        },
        activityType: {
          select: {
            id: true,
            code: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
      orderBy: [
        { plannedStartTime: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      title: o.title,
      status: o.status,
      priority: o.priority,
      plannedStartTime: o.plannedStartTime,
      plannedDurationMin: o.plannedDurationMin,
      assignedStaff: o.assignedStaff,
      property: o.property,
      activityType: o.activityType,
    }));
  }

  async getStaffStatus(): Promise<StaffStatusItem[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Alle aktiven Mitarbeiter laden
    const allStaff = await this.prisma.staff.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        staffNumber: true,
        firstName: true,
        lastName: true,
        color: true,
        absences: {
          where: {
            status: 'APPROVED',
            startDate: { lte: today },
            endDate: { gte: today },
          },
          select: { type: true },
          take: 1,
        },
      },
    });

    // Mitarbeiter-IDs die heute im Einsatz sind (IN_PROGRESS-Aufträge)
    const inProgressOrders = await this.prisma.workOrder.findMany({
      where: {
        plannedDate: today,
        status: 'IN_PROGRESS',
      },
      select: { assignedStaff: true },
    });

    const inProgressStaffIds = new Set<string>(
      inProgressOrders.flatMap((o) => o.assignedStaff),
    );

    return allStaff.map((s) => {
      const isAbsent = s.absences.length > 0;
      const isInProgress = inProgressStaffIds.has(s.id);

      let status: 'AVAILABLE' | 'IN_PROGRESS' | 'ABSENT';
      if (isAbsent) {
        status = 'ABSENT';
      } else if (isInProgress) {
        status = 'IN_PROGRESS';
      } else {
        status = 'AVAILABLE';
      }

      return {
        id: s.id,
        staffNumber: s.staffNumber,
        firstName: s.firstName,
        lastName: s.lastName,
        color: s.color,
        status,
        absenceType: isAbsent ? s.absences[0].type : undefined,
      };
    });
  }

  async getMaintenanceDue(): Promise<MaintenanceDueItem[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const equipment = await this.prisma.equipment.findMany({
      where: {
        nextMaintenance: { lte: cutoff },
        status: { not: 'BROKEN' },
      },
      orderBy: { nextMaintenance: 'asc' },
      select: {
        id: true,
        equipmentNumber: true,
        name: true,
        category: true,
        status: true,
        nextMaintenance: true,
      },
    });

    return equipment.map((e) => {
      const daysUntilDue = e.nextMaintenance
        ? Math.ceil(
            (e.nextMaintenance.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 0;

      return {
        id: e.id,
        equipmentNumber: e.equipmentNumber,
        name: e.name,
        category: e.category,
        status: e.status,
        nextMaintenance: e.nextMaintenance,
        daysUntilDue,
      };
    });
  }
}

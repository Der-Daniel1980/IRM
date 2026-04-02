import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAbsenceDto } from './dto/create-absence.dto';
import { UpdateAbsenceDto } from './dto/update-absence.dto';
import { ApproveAbsenceDto } from './dto/approve-absence.dto';
import { RejectAbsenceDto } from './dto/reject-absence.dto';
import { QueryAbsenceDto } from './dto/query-absence.dto';
import { Absence, AbsenceStatus, AbsenceType, Prisma, WorkOrderStatus } from '@prisma/client';

// ─── Response-Typen ───────────────────────────────────────────────────────────

export interface AbsenceWithStaff extends Absence {
  staff: {
    id: string;
    staffNumber: string;
    firstName: string;
    lastName: string;
    color: string;
  };
}

export interface PaginatedAbsences {
  data: AbsenceWithStaff[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AbsenceApprovedEvent {
  absenceId: string;
  affectedOrderIds: string[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class AbsencesService {
  private readonly logger = new Logger(AbsencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Liste ────────────────────────────────────────────────────────────────

  async findAll(query: QueryAbsenceDto): Promise<PaginatedAbsences> {
    const { staffId, type, status, from, to, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AbsenceWhereInput = {};

    if (staffId) {
      where.staffId = staffId;
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (from || to) {
      where.AND = [];
      if (from) {
        (where.AND as Prisma.AbsenceWhereInput[]).push({
          endDate: { gte: new Date(from) },
        });
      }
      if (to) {
        (where.AND as Prisma.AbsenceWhereInput[]).push({
          startDate: { lte: new Date(to) },
        });
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.absence.findMany({
        where,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          staff: {
            select: {
              id: true,
              staffNumber: true,
              firstName: true,
              lastName: true,
              color: true,
            },
          },
        },
      }),
      this.prisma.absence.count({ where }),
    ]);

    return {
      data: data as AbsenceWithStaff[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Einzelne Abwesenheit ─────────────────────────────────────────────────

  async findOne(id: string): Promise<AbsenceWithStaff> {
    const absence = await this.prisma.absence.findUnique({
      where: { id },
      include: {
        staff: {
          select: {
            id: true,
            staffNumber: true,
            firstName: true,
            lastName: true,
            color: true,
          },
        },
      },
    });

    if (!absence) {
      throw new NotFoundException(`Abwesenheit mit ID "${id}" wurde nicht gefunden`);
    }

    return absence as AbsenceWithStaff;
  }

  // ─── Erstellen ────────────────────────────────────────────────────────────

  async create(dto: CreateAbsenceDto): Promise<AbsenceWithStaff> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException('Enddatum darf nicht vor dem Startdatum liegen');
    }

    // Prüfe ob Mitarbeiter existiert
    const staff = await this.prisma.staff.findUnique({ where: { id: dto.staffId } });
    if (!staff) {
      throw new NotFoundException(`Mitarbeiter mit ID "${dto.staffId}" wurde nicht gefunden`);
    }

    // SICK wird sofort genehmigt, alle anderen müssen beantragt werden
    const initialStatus: AbsenceStatus =
      dto.type === AbsenceType.SICK ? AbsenceStatus.APPROVED : AbsenceStatus.REQUESTED;

    this.logger.log(
      `Erstelle Abwesenheit für Mitarbeiter ${dto.staffId}: ${dto.type} ${dto.startDate}–${dto.endDate} → Status: ${initialStatus}`,
    );

    try {
      const absence = await this.prisma.absence.create({
        data: {
          staffId: dto.staffId,
          type: dto.type,
          startDate,
          endDate,
          status: initialStatus,
          notes: dto.notes,
        },
        include: {
          staff: {
            select: {
              id: true,
              staffNumber: true,
              firstName: true,
              lastName: true,
              color: true,
            },
          },
        },
      });

      // Bei sofortiger SICK-Genehmigung: betroffene Aufträge ermitteln und Event emittieren
      if (initialStatus === AbsenceStatus.APPROVED) {
        await this.emitApprovedEvent(absence.id, dto.staffId, startDate, endDate);
      }

      return absence as AbsenceWithStaff;
    } catch (err: unknown) {
      this.handlePrismaConflict(err);
      throw err;
    }
  }

  // ─── Aktualisieren ────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateAbsenceDto): Promise<AbsenceWithStaff> {
    const existing = await this.findOne(id);

    if (existing.status !== AbsenceStatus.REQUESTED) {
      throw new BadRequestException(
        'Nur Abwesenheiten im Status REQUESTED können geändert werden',
      );
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;

    if (endDate < startDate) {
      throw new BadRequestException('Enddatum darf nicht vor dem Startdatum liegen');
    }

    try {
      const absence = await this.prisma.absence.update({
        where: { id },
        data: {
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.startDate !== undefined && { startDate }),
          ...(dto.endDate !== undefined && { endDate }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
        include: {
          staff: {
            select: {
              id: true,
              staffNumber: true,
              firstName: true,
              lastName: true,
              color: true,
            },
          },
        },
      });

      return absence as AbsenceWithStaff;
    } catch (err: unknown) {
      this.handlePrismaConflict(err);
      throw err;
    }
  }

  // ─── Stornieren (Soft-Delete) ─────────────────────────────────────────────

  async cancel(id: string): Promise<AbsenceWithStaff> {
    const existing = await this.findOne(id);

    if (
      existing.status === AbsenceStatus.CANCELLED ||
      existing.status === AbsenceStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Abwesenheit mit Status ${existing.status} kann nicht storniert werden`,
      );
    }

    const absence = await this.prisma.absence.update({
      where: { id },
      data: { status: AbsenceStatus.CANCELLED },
      include: {
        staff: {
          select: {
            id: true,
            staffNumber: true,
            firstName: true,
            lastName: true,
            color: true,
          },
        },
      },
    });

    this.logger.log(`Abwesenheit ${id} wurde storniert`);

    return absence as AbsenceWithStaff;
  }

  // ─── Genehmigen ───────────────────────────────────────────────────────────

  async approve(
    id: string,
    approverId: string,
    dto: ApproveAbsenceDto,
  ): Promise<AbsenceWithStaff> {
    const existing = await this.findOne(id);

    if (existing.status !== AbsenceStatus.REQUESTED) {
      throw new BadRequestException(
        `Nur Abwesenheiten im Status REQUESTED können genehmigt werden (aktuell: ${existing.status})`,
      );
    }

    const absence = await this.prisma.absence.update({
      where: { id },
      data: {
        status: AbsenceStatus.APPROVED,
        approvedBy: approverId,
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        staff: {
          select: {
            id: true,
            staffNumber: true,
            firstName: true,
            lastName: true,
            color: true,
          },
        },
      },
    });

    this.logger.log(`Abwesenheit ${id} wurde von ${approverId} genehmigt`);

    // Betroffene Aufträge ermitteln und Event emittieren
    await this.emitApprovedEvent(id, existing.staffId, existing.startDate, existing.endDate);

    return absence as AbsenceWithStaff;
  }

  // ─── Ablehnen ─────────────────────────────────────────────────────────────

  async reject(
    id: string,
    approverId: string,
    dto: RejectAbsenceDto,
  ): Promise<AbsenceWithStaff> {
    const existing = await this.findOne(id);

    if (existing.status !== AbsenceStatus.REQUESTED) {
      throw new BadRequestException(
        `Nur Abwesenheiten im Status REQUESTED können abgelehnt werden (aktuell: ${existing.status})`,
      );
    }

    const absence = await this.prisma.absence.update({
      where: { id },
      data: {
        status: AbsenceStatus.REJECTED,
        approvedBy: approverId,
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        staff: {
          select: {
            id: true,
            staffNumber: true,
            firstName: true,
            lastName: true,
            color: true,
          },
        },
      },
    });

    this.logger.log(`Abwesenheit ${id} wurde von ${approverId} abgelehnt`);

    return absence as AbsenceWithStaff;
  }

  // ─── Hilfsmethoden ────────────────────────────────────────────────────────

  private async emitApprovedEvent(
    absenceId: string,
    staffId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    try {
      const affectedOrders = await this.prisma.workOrder.findMany({
        where: {
          assignedStaff: { has: staffId },
          plannedDate: { gte: startDate, lte: endDate },
          status: { in: [WorkOrderStatus.PLANNED, WorkOrderStatus.ASSIGNED] },
        },
        select: { id: true },
      });

      const affectedOrderIds = affectedOrders.map((o) => o.id);

      if (affectedOrderIds.length > 0) {
        this.logger.warn(
          `Abwesenheit ${absenceId} genehmigt: ${affectedOrderIds.length} betroffene Aufträge`,
        );
      }

      const event: AbsenceApprovedEvent = { absenceId, affectedOrderIds };
      this.eventEmitter.emit('absence.approved', event);
    } catch (err) {
      this.logger.error(`Fehler beim Ermitteln betroffener Aufträge für Abwesenheit ${absenceId}`, err);
    }
  }

  private handlePrismaConflict(err: unknown): void {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === 'P2002' || err.code === 'P2010')
    ) {
      throw new ConflictException(
        'Abwesenheit überschneidet sich mit einer bestehenden',
      );
    }
    // PostgreSQL EXCLUDE CONSTRAINT wirft einen raw query error (P2010/P0001)
    if (err instanceof Error && err.message.includes('exclude')) {
      throw new ConflictException(
        'Abwesenheit überschneidet sich mit einer bestehenden',
      );
    }
  }
}

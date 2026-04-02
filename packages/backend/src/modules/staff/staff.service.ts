import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { QueryStaffDto } from './dto/query-staff.dto';
import { AssignSkillDto } from './dto/assign-skill.dto';
import { QueryCalendarDto } from './dto/query-calendar.dto';
import { Prisma, Staff, StaffSkill, Absence, WorkOrder } from '@prisma/client';

// ─── Response-Typen ───────────────────────────────────────────────────────────

export interface StaffSkillWithWarning extends StaffSkill {
  skill: {
    id: string;
    name: string;
    category: string;
    icon: string;
    requiresCertification: boolean;
  };
  warningExpiringSoon: boolean;
}

export interface StaffWithSkills extends Staff {
  skills: StaffSkillWithWarning[];
}

export interface PaginatedStaff {
  data: Staff[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StaffCalendar {
  absences: Absence[];
  workOrders: WorkOrder[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Liste ────────────────────────────────────────────────────────────────

  async findAll(query: QueryStaffDto): Promise<PaginatedStaff> {
    const { search, isActive, employmentType, skillId, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StaffWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    } else {
      where.isActive = true;
    }

    if (employmentType) {
      where.employmentType = employmentType;
    }

    if (skillId) {
      where.skills = { some: { skillId } };
    }

    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      where.OR = [
        { firstName: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
        { lastName: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
        { staffNumber: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
        { email: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.staff.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take: limit,
        include: {
          skills: {
            include: {
              skill: {
                select: { id: true, name: true, category: true, icon: true, requiresCertification: true },
              },
            },
          },
        },
      }),
      this.prisma.staff.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Einzelner Mitarbeiter ────────────────────────────────────────────────

  async findOne(id: string): Promise<StaffWithSkills> {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      include: {
        skills: {
          include: {
            skill: {
              select: { id: true, name: true, category: true, icon: true, requiresCertification: true },
            },
          },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException(`Mitarbeiter mit ID "${id}" wurde nicht gefunden`);
    }

    const today = new Date();
    const warningThreshold = new Date(today);
    warningThreshold.setDate(warningThreshold.getDate() + 30);

    const skillsWithWarning: StaffSkillWithWarning[] = staff.skills.map((s) => ({
      ...s,
      warningExpiringSoon:
        s.certifiedUntil !== null &&
        s.certifiedUntil <= warningThreshold,
    }));

    return { ...staff, skills: skillsWithWarning };
  }

  // ─── Erstellen ────────────────────────────────────────────────────────────

  async create(dto: CreateStaffDto): Promise<Staff> {
    const staffNumber = await this.prisma.nextMasterDataNumber('MA', 4);

    this.logger.log(`Erstelle neuen Mitarbeiter: ${dto.firstName} ${dto.lastName} (${staffNumber})`);

    try {
      return await this.prisma.staff.create({
        data: {
          staffNumber,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          mobile: dto.mobile,
          address: dto.address,
          latitude: dto.latitude !== undefined ? new Prisma.Decimal(dto.latitude) : null,
          longitude: dto.longitude !== undefined ? new Prisma.Decimal(dto.longitude) : null,
          employmentType: dto.employmentType,
          weeklyHours: dto.weeklyHours !== undefined ? new Prisma.Decimal(dto.weeklyHours) : null,
          color: dto.color ?? '#3B82F6',
          userId: dto.userId,
          isActive: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Ein Mitarbeiter mit dieser E-Mail-Adresse existiert bereits`,
        );
      }
      throw error;
    }
  }

  // ─── Aktualisieren ────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateStaffDto): Promise<Staff> {
    await this.findOne(id);

    this.logger.log(`Aktualisiere Mitarbeiter: ${id}`);

    try {
      return await this.prisma.staff.update({
        where: { id },
        data: {
          ...(dto.firstName !== undefined && { firstName: dto.firstName }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.mobile !== undefined && { mobile: dto.mobile }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.latitude !== undefined && { latitude: new Prisma.Decimal(dto.latitude) }),
          ...(dto.longitude !== undefined && { longitude: new Prisma.Decimal(dto.longitude) }),
          ...(dto.employmentType !== undefined && { employmentType: dto.employmentType }),
          ...(dto.weeklyHours !== undefined && { weeklyHours: new Prisma.Decimal(dto.weeklyHours) }),
          ...(dto.color !== undefined && { color: dto.color }),
          ...(dto.userId !== undefined && { userId: dto.userId }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Ein Mitarbeiter mit dieser E-Mail-Adresse existiert bereits`,
        );
      }
      throw error;
    }
  }

  // ─── Soft Delete ──────────────────────────────────────────────────────────

  async remove(id: string): Promise<Staff> {
    await this.findOne(id);

    this.logger.log(`Deaktiviere Mitarbeiter (Soft Delete): ${id}`);

    return this.prisma.staff.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── Fähigkeit zuordnen (upsert) ──────────────────────────────────────────

  async assignSkill(staffId: string, dto: AssignSkillDto): Promise<StaffWithSkills> {
    await this.findOne(staffId);

    // Prüfen ob Fähigkeit existiert
    const skill = await this.prisma.skill.findUnique({ where: { id: dto.skillId } });
    if (!skill) {
      throw new NotFoundException(`Fähigkeit mit ID "${dto.skillId}" wurde nicht gefunden`);
    }

    this.logger.log(`Weise Fähigkeit "${skill.name}" an Mitarbeiter ${staffId} zu`);

    await this.prisma.staffSkill.upsert({
      where: { staffId_skillId: { staffId, skillId: dto.skillId } },
      create: {
        staffId,
        skillId: dto.skillId,
        level: dto.level,
        certifiedUntil: dto.certifiedUntil ? new Date(dto.certifiedUntil) : null,
      },
      update: {
        level: dto.level,
        certifiedUntil: dto.certifiedUntil ? new Date(dto.certifiedUntil) : null,
      },
    });

    return this.findOne(staffId);
  }

  // ─── Fähigkeit entfernen ─────────────────────────────────────────────────

  async removeSkill(staffId: string, skillId: string): Promise<StaffWithSkills> {
    await this.findOne(staffId);

    const existing = await this.prisma.staffSkill.findUnique({
      where: { staffId_skillId: { staffId, skillId } },
    });

    if (!existing) {
      throw new NotFoundException(
        `Die Fähigkeit ist dem Mitarbeiter nicht zugeordnet`,
      );
    }

    this.logger.log(`Entferne Fähigkeit ${skillId} von Mitarbeiter ${staffId}`);

    await this.prisma.staffSkill.delete({
      where: { staffId_skillId: { staffId, skillId } },
    });

    return this.findOne(staffId);
  }

  // ─── Kalender / Verfügbarkeit ─────────────────────────────────────────────

  async getCalendar(staffId: string, query: QueryCalendarDto): Promise<StaffCalendar> {
    await this.findOne(staffId);

    const fromDate = new Date(query.from);
    const toDate = new Date(query.to);

    const [absences, workOrders] = await Promise.all([
      this.prisma.absence.findMany({
        where: {
          staffId,
          AND: [
            { startDate: { lte: toDate } },
            { endDate: { gte: fromDate } },
          ],
        },
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.workOrder.findMany({
        where: {
          assignedStaff: { has: staffId },
          plannedDate: { gte: fromDate, lte: toDate },
        },
        orderBy: { plannedDate: 'asc' },
        include: {
          property: { select: { id: true, name: true, addressStreet: true, addressCity: true } },
          activityType: { select: { id: true, name: true } },
        },
      }),
    ]);

    return { absences, workOrders };
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, WorkOrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateActivityTypeDto } from './dto/create-activity-type.dto';
import { UpdateActivityTypeDto } from './dto/update-activity-type.dto';
import { QueryActivityTypesDto } from './dto/query-activity-types.dto';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type ActivityTypeWithRelations = Prisma.ActivityTypeGetPayload<{
  include: { requiredSkills: true; defaultEquipment: true };
}>;

export interface PaginatedActivityTypes {
  data: ActivityTypeWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ActivityTypesService {
  private readonly logger = new Logger(ActivityTypesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryActivityTypesDto): Promise<PaginatedActivityTypes> {
    const { search, category, isActive, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityTypeWhereInput = {};

    if (category && category.trim().length > 0) {
      where.category = {
        contains: category.trim(),
        mode: Prisma.QueryMode.insensitive,
      };
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: Prisma.QueryMode.insensitive } },
        { code: { contains: term, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: term, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.activityType.findMany({
        where,
        include: { requiredSkills: true, defaultEquipment: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.activityType.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<ActivityTypeWithRelations> {
    const activityType = await this.prisma.activityType.findUnique({
      where: { id },
      include: { requiredSkills: true, defaultEquipment: true },
    });

    if (!activityType) {
      throw new NotFoundException(`Tätigkeit mit ID "${id}" wurde nicht gefunden`);
    }

    return activityType;
  }

  async create(dto: CreateActivityTypeDto): Promise<ActivityTypeWithRelations> {
    this.validateSeasonFields(dto);
    this.logger.log(`Erstelle neue Tätigkeit: ${dto.name} (${dto.code})`);

    try {
      return await this.prisma.activityType.create({
        data: {
          code: dto.code.toUpperCase(),
          name: dto.name,
          category: dto.category,
          description: dto.description ?? null,
          defaultDurationMin: dto.defaultDurationMin ?? 60,
          isRecurring: dto.isRecurring ?? false,
          recurrenceInterval: dto.recurrenceInterval ?? null,
          seasonStart: dto.seasonStart ?? null,
          seasonEnd: dto.seasonEnd ?? null,
          icon: dto.icon ?? 'ClipboardList',
          color: dto.color ?? '#6B7280',
          isActive: dto.isActive ?? true,
          requiredSkills: dto.requiredSkillIds?.length
            ? { connect: dto.requiredSkillIds.map((id) => ({ id })) }
            : undefined,
          defaultEquipment: dto.defaultEquipmentIds?.length
            ? { connect: dto.defaultEquipmentIds.map((id) => ({ id })) }
            : undefined,
        },
        include: { requiredSkills: true, defaultEquipment: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Eine Tätigkeit mit dem Code "${dto.code}" existiert bereits`,
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateActivityTypeDto): Promise<ActivityTypeWithRelations> {
    await this.findOne(id);
    this.validateSeasonFields(dto);
    this.logger.log(`Aktualisiere Tätigkeit: ${id}`);

    try {
      return await this.prisma.activityType.update({
        where: { id },
        data: {
          ...(dto.code !== undefined && { code: dto.code.toUpperCase() }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.defaultDurationMin !== undefined && { defaultDurationMin: dto.defaultDurationMin }),
          ...(dto.isRecurring !== undefined && { isRecurring: dto.isRecurring }),
          ...(dto.recurrenceInterval !== undefined && { recurrenceInterval: dto.recurrenceInterval }),
          ...(dto.seasonStart !== undefined && { seasonStart: dto.seasonStart }),
          ...(dto.seasonEnd !== undefined && { seasonEnd: dto.seasonEnd }),
          ...(dto.icon !== undefined && { icon: dto.icon }),
          ...(dto.color !== undefined && { color: dto.color }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          // Bei PATCH: Beziehungen vollständig ersetzen (set), nicht nur hinzufügen
          ...(dto.requiredSkillIds !== undefined && {
            requiredSkills: {
              set: dto.requiredSkillIds.map((skillId) => ({ id: skillId })),
            },
          }),
          ...(dto.defaultEquipmentIds !== undefined && {
            defaultEquipment: {
              set: dto.defaultEquipmentIds.map((equipId) => ({ id: equipId })),
            },
          }),
        },
        include: { requiredSkills: true, defaultEquipment: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Eine Tätigkeit mit diesem Code existiert bereits`,
        );
      }
      throw error;
    }
  }

  async remove(id: string): Promise<ActivityTypeWithRelations> {
    const activityType = await this.findOne(id);

    // Prüfen ob aktive Aufträge mit dieser Tätigkeit existieren
    const activeOrderCount = await this.prisma.workOrder.count({
      where: {
        activityTypeId: id,
        status: {
          in: [
            WorkOrderStatus.DRAFT,
            WorkOrderStatus.PLANNED,
            WorkOrderStatus.ASSIGNED,
            WorkOrderStatus.IN_PROGRESS,
          ],
        },
      },
    });

    if (activeOrderCount > 0) {
      throw new BadRequestException(
        `Die Tätigkeit kann nicht gelöscht werden, da ${activeOrderCount} aktiver Auftrag/aktive Aufträge damit verknüpft ist/sind`,
      );
    }

    this.logger.log(`Lösche Tätigkeit: ${id} (${activityType.code})`);

    return this.prisma.activityType.delete({
      where: { id },
      include: { requiredSkills: true, defaultEquipment: true },
    });
  }

  // ─── Hilfsmethoden ─────────────────────────────────────────────────────────

  private validateSeasonFields(dto: CreateActivityTypeDto | UpdateActivityTypeDto): void {
    if (dto.isRecurring && dto.recurrenceInterval === 'SEASONAL') {
      if (dto.seasonStart == null || dto.seasonEnd == null) {
        throw new BadRequestException(
          'Bei Wiederholungsintervall SEASONAL sind seasonStart und seasonEnd Pflichtfelder',
        );
      }
    }
  }
}

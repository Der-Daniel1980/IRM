import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { QueryEquipmentDto } from './dto/query-equipment.dto';
import { Prisma, Equipment, EquipmentStatus, WorkOrderStatus } from '@prisma/client';

export interface PaginatedEquipment {
  data: Equipment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class EquipmentService {
  private readonly logger = new Logger(EquipmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryEquipmentDto): Promise<PaginatedEquipment> {
    const { search, category, status, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.EquipmentWhereInput = {};

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
        { equipmentType: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
        { equipmentNumber: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
        { licensePlate: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.equipment.findMany({
        where,
        orderBy: { equipmentNumber: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.equipment.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Equipment> {
    const equipment = await this.prisma.equipment.findUnique({ where: { id } });

    if (!equipment) {
      throw new NotFoundException(`Gerät mit ID "${id}" wurde nicht gefunden`);
    }

    return equipment;
  }

  async findAvailable(): Promise<Equipment[]> {
    return this.prisma.equipment.findMany({
      where: { status: EquipmentStatus.AVAILABLE },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateEquipmentDto): Promise<Equipment> {
    const equipmentNumber = await this.prisma.nextMasterDataNumber('GER', 4);

    this.logger.log(`Erstelle neues Gerät: ${dto.name} (${equipmentNumber})`);

    try {
      return await this.prisma.equipment.create({
        data: {
          equipmentNumber,
          name: dto.name,
          category: dto.category,
          equipmentType: dto.equipmentType,
          licensePlate: dto.licensePlate ?? null,
          requiresLicense: dto.requiresLicense ?? false,
          requiredLicenseType: dto.requiredLicenseType ?? null,
          location: dto.location ?? null,
          status: EquipmentStatus.AVAILABLE,
          nextMaintenance: dto.nextMaintenance ? new Date(dto.nextMaintenance) : null,
          notes: dto.notes ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Ein Gerät mit der Nummer "${equipmentNumber}" existiert bereits`,
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateEquipmentDto): Promise<Equipment> {
    await this.findOne(id);

    this.logger.log(`Aktualisiere Gerät: ${id}`);

    return this.prisma.equipment.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.equipmentType !== undefined && { equipmentType: dto.equipmentType }),
        ...(dto.licensePlate !== undefined && { licensePlate: dto.licensePlate }),
        ...(dto.requiresLicense !== undefined && { requiresLicense: dto.requiresLicense }),
        ...(dto.requiredLicenseType !== undefined && {
          requiredLicenseType: dto.requiredLicenseType,
        }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.nextMaintenance !== undefined && {
          nextMaintenance: dto.nextMaintenance ? new Date(dto.nextMaintenance) : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(id: string): Promise<Equipment> {
    const equipment = await this.findOne(id);

    if (equipment.status !== EquipmentStatus.AVAILABLE) {
      throw new BadRequestException(
        `Gerät kann nur gelöscht werden wenn Status AVAILABLE ist (aktuell: ${equipment.status})`,
      );
    }

    // Prüfe auf aktive Auftrags-Zuordnungen
    const activeAssignments = await this.prisma.workOrderEquipment.count({
      where: {
        equipmentId: id,
        workOrder: {
          status: {
            in: [
              WorkOrderStatus.DRAFT,
              WorkOrderStatus.PLANNED,
              WorkOrderStatus.ASSIGNED,
              WorkOrderStatus.IN_PROGRESS,
            ],
          },
        },
      },
    });

    if (activeAssignments > 0) {
      throw new BadRequestException(
        `Gerät ist in ${activeAssignments} aktiven Auftrag/Aufträgen eingesetzt und kann nicht gelöscht werden`,
      );
    }

    this.logger.log(`Lösche Gerät: ${id} (${equipment.equipmentNumber})`);

    return this.prisma.equipment.delete({ where: { id } });
  }
}

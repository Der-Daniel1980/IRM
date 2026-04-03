import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, WorkOrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { QueryMyOrdersDto } from './dto/query-my-orders.dto';
import { StopWorkDto } from './dto/stop-work.dto';
import { SubmitTimeEntryDto } from './dto/submit-time-entry.dto';
import { UploadPhotoDto } from './dto/upload-photo.dto';

@Injectable()
export class MobileService {
  private readonly logger = new Logger(MobileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  // ─── Staff-Auflösung ───────────────────────────────────────────────────────

  async resolveStaff(userId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { userId, isActive: true },
      include: {
        skills: { include: { skill: true } },
      },
    });

    if (!staff) {
      throw new ForbiddenException(
        'Kein aktives Mitarbeiterprofil mit diesem Benutzerkonto verknüpft.',
      );
    }

    return staff;
  }

  // ─── /me Endpunkt ──────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const staff = await this.resolveStaff(userId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayOrderCount, inProgressCount] = await Promise.all([
      this.prisma.workOrder.count({
        where: {
          assignedStaff: { has: staff.id },
          plannedDate: { gte: today, lt: tomorrow },
          status: { notIn: ['CANCELLED', 'DRAFT'] },
        },
      }),
      this.prisma.workOrder.count({
        where: {
          assignedStaff: { has: staff.id },
          status: 'IN_PROGRESS',
        },
      }),
    ]);

    return { staff, todayOrderCount, inProgressCount };
  }

  // ─── Aufträge ──────────────────────────────────────────────────────────────

  async findMyOrders(userId: string, query: QueryMyOrdersDto) {
    const staff = await this.resolveStaff(userId);
    const { status, from, to, page = 1, limit = 20 } = query;

    const where: Prisma.WorkOrderWhereInput = {
      assignedStaff: { has: staff.id },
      status: status ?? { notIn: ['CANCELLED', 'DRAFT'] },
    };

    if (from || to) {
      where.plannedDate = {};
      if (from) where.plannedDate.gte = new Date(from);
      if (to) where.plannedDate.lte = new Date(to);
    }

    const [data, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        include: {
          property: true,
          customer: true,
          activityType: true,
          photos: { select: { id: true } },
          timeEntries: {
            where: { staffId: staff.id },
            orderBy: { startedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: [{ plannedDate: 'asc' }, { plannedStartTime: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.workOrder.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findMyOrder(userId: string, orderId: string) {
    const staff = await this.resolveStaff(userId);

    const order = await this.prisma.workOrder.findUnique({
      where: { id: orderId },
      include: {
        property: true,
        customer: true,
        activityType: {
          include: {
            requiredSkills: true,
            defaultEquipment: true,
          },
        },
        equipment: { include: { equipment: true } },
        photos: { orderBy: { createdAt: 'desc' } },
        timeEntries: {
          where: { staffId: staff.id },
          orderBy: { startedAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Auftrag nicht gefunden.');
    }

    if (!order.assignedStaff.includes(staff.id)) {
      throw new ForbiddenException('Dieser Auftrag ist Ihnen nicht zugewiesen.');
    }

    return order;
  }

  // ─── Arbeit starten / stoppen ──────────────────────────────────────────────

  async startWork(userId: string, orderId: string) {
    const staff = await this.resolveStaff(userId);
    const order = await this.getAssignedOrder(staff.id, orderId);

    if (!['PLANNED', 'ASSIGNED'].includes(order.status)) {
      throw new BadRequestException(
        `Auftrag kann nicht gestartet werden (aktueller Status: ${order.status}).`,
      );
    }

    return this.prisma.workOrder.update({
      where: { id: orderId },
      data: {
        status: 'IN_PROGRESS',
        actualStart: new Date(),
      },
      include: {
        property: true,
        activityType: true,
      },
    });
  }

  async stopWork(userId: string, orderId: string, dto: StopWorkDto) {
    const staff = await this.resolveStaff(userId);
    const order = await this.getAssignedOrder(staff.id, orderId);

    if (order.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Auftrag kann nicht abgeschlossen werden (aktueller Status: ${order.status}).`,
      );
    }

    const now = new Date();
    let actualDurationMin = dto.actualDurationMin;

    if (!actualDurationMin && order.actualStart) {
      actualDurationMin = Math.round(
        (now.getTime() - order.actualStart.getTime()) / 60000,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // TimeEntry erstellen
      await tx.timeEntry.create({
        data: {
          workOrderId: orderId,
          staffId: staff.id,
          startedAt: order.actualStart ?? now,
          endedAt: now,
          durationMin: actualDurationMin,
          source: 'MOBILE',
        },
      });

      // WorkOrder abschließen
      return tx.workOrder.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          actualEnd: now,
          actualDurationMin: actualDurationMin,
          completionNotes: dto.completionNotes,
        },
        include: {
          property: true,
          activityType: true,
        },
      });
    });
  }

  // ─── Zeiteinträge ──────────────────────────────────────────────────────────

  async submitTimeEntry(userId: string, orderId: string, dto: SubmitTimeEntryDto) {
    const staff = await this.resolveStaff(userId);
    await this.getAssignedOrder(staff.id, orderId);

    let durationMin = dto.durationMin;
    if (!durationMin && dto.endedAt) {
      const start = new Date(dto.startedAt);
      const end = new Date(dto.endedAt);
      durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
    }

    return this.prisma.timeEntry.create({
      data: {
        workOrderId: orderId,
        staffId: staff.id,
        startedAt: new Date(dto.startedAt),
        endedAt: dto.endedAt ? new Date(dto.endedAt) : undefined,
        durationMin,
        notes: dto.notes,
        source: 'MOBILE',
      },
    });
  }

  // ─── Fotos ─────────────────────────────────────────────────────────────────

  async uploadPhotos(
    userId: string,
    orderId: string,
    files: Express.Multer.File[],
    dto: UploadPhotoDto,
  ) {
    const staff = await this.resolveStaff(userId);
    await this.getAssignedOrder(staff.id, orderId);

    if (!files || files.length === 0) {
      throw new BadRequestException('Mindestens ein Foto ist erforderlich.');
    }

    const targetDir = this.uploads.ensureWorkOrderDirectory(orderId);

    const photos = await Promise.all(
      files.map(async (file) => {
        // Datei in Auftrags-Verzeichnis verschieben
        const { renameSync } = await import('fs');
        const newPath = `${targetDir}/${file.filename}`;
        renameSync(file.path, newPath);

        return this.prisma.workOrderPhoto.create({
          data: {
            workOrderId: orderId,
            uploadedBy: staff.id,
            fileName: file.originalname,
            mimeType: file.mimetype,
            fileSizeBytes: file.size,
            storagePath: this.uploads.getStoragePath(orderId, file.filename),
            caption: dto.caption,
            latitude: dto.latitude,
            longitude: dto.longitude,
          },
        });
      }),
    );

    return photos;
  }

  async getPhotos(userId: string, orderId: string) {
    const staff = await this.resolveStaff(userId);
    await this.getAssignedOrder(staff.id, orderId);

    return this.prisma.workOrderPhoto.findMany({
      where: { workOrderId: orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deletePhoto(userId: string, orderId: string, photoId: string) {
    const staff = await this.resolveStaff(userId);
    await this.getAssignedOrder(staff.id, orderId);

    const photo = await this.prisma.workOrderPhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo || photo.workOrderId !== orderId) {
      throw new NotFoundException('Foto nicht gefunden.');
    }

    if (photo.uploadedBy !== staff.id) {
      throw new ForbiddenException('Sie können nur eigene Fotos löschen.');
    }

    this.uploads.deleteFile(photo.storagePath);

    return this.prisma.workOrderPhoto.delete({
      where: { id: photoId },
    });
  }

  async getPhotoFile(userId: string, photoId: string) {
    await this.resolveStaff(userId);

    const photo = await this.prisma.workOrderPhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw new NotFoundException('Foto nicht gefunden.');
    }

    return {
      path: this.uploads.getAbsolutePath(photo.storagePath),
      mimeType: photo.mimeType,
      fileName: photo.fileName,
    };
  }

  // ─── Hilfsmethoden ─────────────────────────────────────────────────────────

  private async getAssignedOrder(staffId: string, orderId: string) {
    const order = await this.prisma.workOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Auftrag nicht gefunden.');
    }

    if (!order.assignedStaff.includes(staffId)) {
      throw new ForbiddenException('Dieser Auftrag ist Ihnen nicht zugewiesen.');
    }

    return order;
  }
}

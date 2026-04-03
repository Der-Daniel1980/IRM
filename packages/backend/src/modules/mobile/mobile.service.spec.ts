import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { MobileService } from './mobile.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';

// ─── Mock-Factories ──────────────────────────────────────────────────────────

const createMockPrisma = () => ({
  staff: {
    findFirst: jest.fn(),
  },
  workOrder: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  timeEntry: {
    create: jest.fn(),
  },
  workOrderPhoto: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
});

const createMockUploads = () => ({
  ensureWorkOrderDirectory: jest.fn().mockReturnValue('/tmp/uploads/order-1'),
  getStoragePath: jest.fn().mockReturnValue('order-1/photo.jpg'),
  deleteFile: jest.fn().mockReturnValue(true),
  getAbsolutePath: jest.fn().mockReturnValue('/tmp/uploads/order-1/photo.jpg'),
  getFilePath: jest.fn(),
});

const STAFF_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const ORDER_ID = '33333333-3333-3333-3333-333333333333';

const makeStaff = (overrides = {}) => ({
  id: STAFF_ID,
  staffNumber: 'MA-0001',
  firstName: 'Max',
  lastName: 'Mustermann',
  email: 'max@test.de',
  phone: null,
  mobile: null,
  color: '#3B82F6',
  isActive: true,
  userId: USER_ID,
  skills: [],
  ...overrides,
});

const makeOrder = (overrides = {}) => ({
  id: ORDER_ID,
  orderNumber: '2026-10000001',
  title: 'Rasenmähen',
  status: 'ASSIGNED',
  priority: 'NORMAL',
  assignedStaff: [STAFF_ID],
  actualStart: null,
  actualEnd: null,
  actualDurationMin: null,
  completionNotes: null,
  ...overrides,
});

describe('MobileService', () => {
  let service: MobileService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let uploads: ReturnType<typeof createMockUploads>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    uploads = createMockUploads();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MobileService,
        { provide: PrismaService, useValue: prisma },
        { provide: UploadsService, useValue: uploads },
      ],
    }).compile();

    service = module.get<MobileService>(MobileService);
  });

  // ─── resolveStaff ──────────────────────────────────────────────────────────

  describe('resolveStaff', () => {
    it('sollte Staff-Profil für verknüpften User zurückgeben', async () => {
      const staff = makeStaff();
      prisma.staff.findFirst.mockResolvedValue(staff);

      const result = await service.resolveStaff(USER_ID);
      expect(result).toEqual(staff);
      expect(prisma.staff.findFirst).toHaveBeenCalledWith({
        where: { userId: USER_ID, isActive: true },
        include: { skills: { include: { skill: true } } },
      });
    });

    it('sollte 403 werfen wenn kein Staff-Profil verknüpft', async () => {
      prisma.staff.findFirst.mockResolvedValue(null);

      await expect(service.resolveStaff(USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── getProfile ────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('sollte Profil mit Tagesübersicht zurückgeben', async () => {
      prisma.staff.findFirst.mockResolvedValue(makeStaff());
      prisma.workOrder.count.mockResolvedValueOnce(3); // todayOrderCount
      prisma.workOrder.count.mockResolvedValueOnce(1); // inProgressCount

      const result = await service.getProfile(USER_ID);
      expect(result.staff.id).toBe(STAFF_ID);
      expect(result.todayOrderCount).toBe(3);
      expect(result.inProgressCount).toBe(1);
    });
  });

  // ─── startWork ─────────────────────────────────────────────────────────────

  describe('startWork', () => {
    it('sollte Auftrag auf IN_PROGRESS setzen', async () => {
      prisma.staff.findFirst.mockResolvedValue(makeStaff());
      prisma.workOrder.findUnique.mockResolvedValue(makeOrder({ status: 'ASSIGNED' }));
      prisma.workOrder.update.mockResolvedValue(
        makeOrder({ status: 'IN_PROGRESS', actualStart: new Date() }),
      );

      const result = await service.startWork(USER_ID, ORDER_ID);
      expect(result.status).toBe('IN_PROGRESS');
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ORDER_ID },
          data: expect.objectContaining({
            status: 'IN_PROGRESS',
          }),
        }),
      );
    });

    it('sollte 400 werfen wenn Auftrag nicht startbar', async () => {
      prisma.staff.findFirst.mockResolvedValue(makeStaff());
      prisma.workOrder.findUnique.mockResolvedValue(
        makeOrder({ status: 'COMPLETED' }),
      );

      await expect(service.startWork(USER_ID, ORDER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('sollte 403 werfen wenn Auftrag nicht zugewiesen', async () => {
      prisma.staff.findFirst.mockResolvedValue(makeStaff());
      prisma.workOrder.findUnique.mockResolvedValue(
        makeOrder({ assignedStaff: ['other-id'] }),
      );

      await expect(service.startWork(USER_ID, ORDER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('sollte 404 werfen wenn Auftrag nicht existiert', async () => {
      prisma.staff.findFirst.mockResolvedValue(makeStaff());
      prisma.workOrder.findUnique.mockResolvedValue(null);

      await expect(service.startWork(USER_ID, ORDER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── stopWork ──────────────────────────────────────────────────────────────

  describe('stopWork', () => {
    it('sollte Auftrag abschließen mit automatischer Dauerberechnung', async () => {
      const startTime = new Date(Date.now() - 90 * 60 * 1000); // 90 Min ago
      prisma.staff.findFirst.mockResolvedValue(makeStaff());
      prisma.workOrder.findUnique.mockResolvedValue(
        makeOrder({ status: 'IN_PROGRESS', actualStart: startTime }),
      );

      const completedOrder = makeOrder({
        status: 'COMPLETED',
        actualEnd: new Date(),
        actualDurationMin: 90,
      });

      prisma.$transaction.mockImplementation(async (fn: Function) => {
        const mockTx = {
          timeEntry: { create: jest.fn() },
          workOrder: { update: jest.fn().mockResolvedValue(completedOrder) },
        };
        return fn(mockTx);
      });

      const result = await service.stopWork(USER_ID, ORDER_ID, {});
      expect(result.status).toBe('COMPLETED');
    });

    it('sollte 400 werfen wenn Auftrag nicht IN_PROGRESS', async () => {
      prisma.staff.findFirst.mockResolvedValue(makeStaff());
      prisma.workOrder.findUnique.mockResolvedValue(
        makeOrder({ status: 'ASSIGNED' }),
      );

      await expect(
        service.stopWork(USER_ID, ORDER_ID, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── submitTimeEntry ───────────────────────────────────────────────────────

  describe('submitTimeEntry', () => {
    it('sollte manuellen Zeiteintrag erstellen', async () => {
      prisma.staff.findFirst.mockResolvedValue(makeStaff());
      prisma.workOrder.findUnique.mockResolvedValue(makeOrder());
      prisma.timeEntry.create.mockResolvedValue({
        id: 'te-1',
        workOrderId: ORDER_ID,
        staffId: STAFF_ID,
        durationMin: 60,
      });

      const result = await service.submitTimeEntry(USER_ID, ORDER_ID, {
        startedAt: '2026-04-03T08:00:00Z',
        endedAt: '2026-04-03T09:00:00Z',
      });

      expect(prisma.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workOrderId: ORDER_ID,
            staffId: STAFF_ID,
            source: 'MOBILE',
          }),
        }),
      );
    });
  });

  // ─── uploadPhotos ──────────────────────────────────────────────────────────

  describe('uploadPhotos', () => {
    it('sollte 400 werfen wenn keine Dateien', async () => {
      prisma.staff.findFirst.mockResolvedValue(makeStaff());
      prisma.workOrder.findUnique.mockResolvedValue(makeOrder());

      await expect(
        service.uploadPhotos(USER_ID, ORDER_ID, [], {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── deletePhoto ───────────────────────────────────────────────────────────

  describe('deletePhoto', () => {
    it('sollte 403 werfen wenn Foto von anderem Mitarbeiter', async () => {
      prisma.staff.findFirst.mockResolvedValue(makeStaff());
      prisma.workOrder.findUnique.mockResolvedValue(makeOrder());
      prisma.workOrderPhoto.findUnique.mockResolvedValue({
        id: 'photo-1',
        workOrderId: ORDER_ID,
        uploadedBy: 'other-staff-id',
        storagePath: 'some/path.jpg',
      });

      await expect(
        service.deletePhoto(USER_ID, ORDER_ID, 'photo-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('sollte eigenes Foto löschen können', async () => {
      prisma.staff.findFirst.mockResolvedValue(makeStaff());
      prisma.workOrder.findUnique.mockResolvedValue(makeOrder());
      prisma.workOrderPhoto.findUnique.mockResolvedValue({
        id: 'photo-1',
        workOrderId: ORDER_ID,
        uploadedBy: STAFF_ID,
        storagePath: 'order-1/photo.jpg',
      });
      prisma.workOrderPhoto.delete.mockResolvedValue({ id: 'photo-1' });

      await service.deletePhoto(USER_ID, ORDER_ID, 'photo-1');
      expect(uploads.deleteFile).toHaveBeenCalledWith('order-1/photo.jpg');
      expect(prisma.workOrderPhoto.delete).toHaveBeenCalled();
    });
  });

  // ─── getPhotoFile ──────────────────────────────────────────────────────────

  describe('getPhotoFile', () => {
    it('sollte 404 werfen wenn Foto nicht existiert', async () => {
      prisma.staff.findFirst.mockResolvedValue(makeStaff());
      prisma.workOrderPhoto.findUnique.mockResolvedValue(null);

      await expect(
        service.getPhotoFile(USER_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

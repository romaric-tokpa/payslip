/* eslint-disable @typescript-eslint/no-unsafe-assignment -- matchers Jest */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PAYSLIP_AUDIT } from './payslips.constants';
import { PayslipBulkTempStore } from './payslip-bulk-temp.store';
import { PayslipMatcherService } from './payslip-matcher.service';
import { PayslipPdfExtractorService } from './payslip-pdf-extractor.service';
import { Readable } from 'stream';
import { PayslipsService } from './payslips.service';

function pdfFile(
  name: string,
  buffer = Buffer.from('%PDF-1.4'),
  mimetype = 'application/pdf',
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: name,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: Readable.from([]),
  };
}

const userSummary = {
  firstName: 'Jean',
  lastName: 'Dupont',
  employeeId: 'E1',
  department: 'RH',
  orgDepartment: null as {
    name: string;
    direction: { name: string } | null;
  } | null,
  orgService: null as { name: string } | null,
};

describe('PayslipsService', () => {
  let service: PayslipsService;
  let prisma: {
    user: { findFirst: jest.Mock };
    payslip: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
    auditLog: { create: jest.Mock };
  };
  let storage: {
    buildPayslipKey: jest.Mock;
    uploadFile: jest.Mock;
    uploadFileWithRetry: jest.Mock;
    getPresignedUrl: jest.Mock;
    deleteFile: jest.Mock;
  };
  let users: { findByCompanyAndEmployeeId: jest.Mock };
  let notifications: { sendPushToUser: jest.Mock };

  const rh: RequestUser = {
    id: 'rh-1',
    email: 'rh@b.com',
    role: 'RH_ADMIN',
    companyId: 'co-1',
  };

  const employee: RequestUser = {
    id: 'u-emp',
    email: 'e@b.com',
    role: 'EMPLOYEE',
    companyId: 'co-1',
  };

  const superAdmin: RequestUser = {
    id: 'sa-1',
    email: 'sa@b.com',
    role: 'SUPER_ADMIN',
    companyId: null,
  };

  beforeEach(async () => {
    prisma = {
      user: { findFirst: jest.fn() },
      payslip: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    storage = {
      buildPayslipKey: jest.fn(
        (companyId: string, userId: string, year: number, month: number) =>
          `companies/${companyId}/payslips/${userId}/${year}/${String(month).padStart(2, '0')}.pdf`,
      ),
      uploadFile: jest.fn().mockResolvedValue(undefined),
      uploadFileWithRetry: jest.fn().mockResolvedValue(undefined),
      getPresignedUrl: jest
        .fn()
        .mockResolvedValue('https://signed.example/pdf'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    users = {
      findByCompanyAndEmployeeId: jest.fn(),
    };

    notifications = {
      sendPushToUser: jest.fn().mockResolvedValue({ id: 'n1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayslipsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: UsersService, useValue: users },
        { provide: NotificationsService, useValue: notifications },
        { provide: PayslipPdfExtractorService, useValue: {} },
        { provide: PayslipMatcherService, useValue: {} },
        { provide: PayslipBulkTempStore, useValue: {} },
      ],
    }).compile();

    service = module.get(PayslipsService);

    prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
  });

  describe('uploadSingle', () => {
    it('succès : upload S3, création Payslip, audit', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u-target',
        companyId: 'co-1',
      });
      prisma.payslip.findFirst.mockResolvedValue(null);
      const created = {
        id: 'ps-1',
        userId: 'u-target',
        companyId: 'co-1',
        periodMonth: 3,
        periodYear: 2024,
        fileUrl: 'key',
        fileSize: 100,
        uploadedById: rh.id,
        uploadedAt: new Date(),
        isRead: false,
        readAt: null,
        user: { ...userSummary },
      };
      prisma.payslip.create.mockResolvedValue(created);

      const file = pdfFile('b.pdf');
      const out = await service.uploadSingle(file, 'u-target', 3, 2024, rh);

      expect(out.id).toBe('ps-1');
      expect(storage.uploadFileWithRetry).toHaveBeenCalledWith(
        file.buffer,
        'companies/co-1/payslips/u-target/2024/03.pdf',
        'application/pdf',
      );
      expect(storage.buildPayslipKey).toHaveBeenCalledWith(
        'co-1',
        'u-target',
        2024,
        3,
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: rh.id,
          action: PAYSLIP_AUDIT.UPLOADED,
          entityType: 'Payslip',
          entityId: 'ps-1',
        }),
      });
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      expect(notifications.sendPushToUser).toHaveBeenCalledWith(
        'u-target',
        'Nouveau bulletin',
        expect.stringContaining('Mars'),
        expect.objectContaining({
          payslipId: 'ps-1',
          type: 'NEW_PAYSLIP',
        }),
      );
    });

    it('utilisateur hors entreprise → ForbiddenException', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.uploadSingle(pdfFile('x.pdf'), 'other', 1, 2024, rh),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storage.uploadFileWithRetry).not.toHaveBeenCalled();
    });

    it('doublon période → ConflictException', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u-target',
        companyId: 'co-1',
      });
      prisma.payslip.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(
        service.uploadSingle(pdfFile('x.pdf'), 'u-target', 1, 2024, rh),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('fichier non PDF → BadRequestException', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u-target',
        companyId: 'co-1',
      });
      prisma.payslip.findFirst.mockResolvedValue(null);
      const bad = pdfFile(
        'x.bin',
        Buffer.from('x'),
        'application/octet-stream',
      );
      await expect(
        service.uploadSingle(bad, 'u-target', 1, 2024, rh),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('uploadBulk', () => {
    it('3 fichiers dont 1 matricule inconnu → 2 OK, 1 ERROR', async () => {
      users.findByCompanyAndEmployeeId.mockImplementation(
        (_c: string, mat: string) => {
          if (mat === 'M1') return Promise.resolve({ id: 'u-m1' });
          if (mat === 'M2') return Promise.resolve({ id: 'u-m2' });
          return Promise.resolve(null);
        },
      );

      prisma.user.findFirst.mockImplementation(
        (args: { where: { id: string } }) => {
          if (args.where.id === 'u-m1') {
            return Promise.resolve({ id: 'u-m1', companyId: 'co-1' });
          }
          if (args.where.id === 'u-m2') {
            return Promise.resolve({ id: 'u-m2', companyId: 'co-1' });
          }
          return Promise.resolve(null);
        },
      );

      prisma.payslip.findFirst.mockResolvedValue(null);

      let n = 0;
      prisma.payslip.create.mockImplementation(() => {
        n += 1;
        return Promise.resolve({
          id: `ps-${n}`,
          userId: n === 1 ? 'u-m1' : 'u-m2',
          companyId: 'co-1',
          periodMonth: n === 1 ? 1 : 2,
          periodYear: 2024,
          fileUrl: 'k',
          fileSize: 10,
          uploadedById: rh.id,
          uploadedAt: new Date(),
          isRead: false,
          readAt: null,
          user: { ...userSummary },
        });
      });

      const report = await service.uploadBulk(
        [
          pdfFile('M1_01_2024.pdf'),
          pdfFile('M2_02_2024.pdf'),
          pdfFile('UNKNOWN_03_2024.pdf'),
        ],
        rh,
      );

      expect(report.total).toBe(3);
      expect(report.success).toBe(2);
      expect(report.failed).toBe(1);
      const err = report.details.find((d) => d.status === 'ERROR');
      expect(err?.reason).toBe('Matricule non trouvé');
    });
  });

  describe('findAll', () => {
    it('RH_ADMIN : filtre companyId', async () => {
      prisma.payslip.count.mockResolvedValue(1);
      prisma.payslip.findMany.mockResolvedValue([
        {
          id: 'p1',
          userId: 'u1',
          companyId: 'co-1',
          periodMonth: 1,
          periodYear: 2025,
          fileUrl: 'k',
          fileSize: 1,
          uploadedById: rh.id,
          uploadedAt: new Date(),
          isRead: false,
          readAt: null,
          user: { ...userSummary },
        },
      ]);

      const out = await service.findAll({ page: 1, limit: 20 }, rh);
      expect(out.meta.total).toBe(1);
      expect(prisma.payslip.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'co-1' }),
        }),
      );
    });

    it('EMPLOYEE : uniquement ses bulletins', async () => {
      prisma.payslip.count.mockResolvedValue(0);
      prisma.payslip.findMany.mockResolvedValue([]);
      await service.findAll({}, employee);
      expect(prisma.payslip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: employee.id }),
        }),
      );
    });

    it('SUPER_ADMIN → ForbiddenException', async () => {
      await expect(service.findAll({}, superAdmin)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('findOne', () => {
    const slip = {
      id: 'p1',
      userId: employee.id,
      companyId: 'co-1',
      periodMonth: 2,
      periodYear: 2024,
      fileUrl: 's3-key',
      fileSize: 50,
      uploadedById: rh.id,
      uploadedAt: new Date(),
      isRead: false,
      readAt: null,
      user: { ...userSummary },
    };

    it('accès OK pour le titulaire', async () => {
      prisma.payslip.findUnique.mockResolvedValue(slip);
      const out = await service.findOne('p1', employee);
      expect(out.presignedUrl).toBe('https://signed.example/pdf');
      expect(storage.getPresignedUrl).toHaveBeenCalledWith('s3-key');
    });

    it('autre employé → ForbiddenException', async () => {
      prisma.payslip.findUnique.mockResolvedValue(slip);
      await expect(
        service.findOne('p1', {
          ...employee,
          id: 'autre',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('markAsRead', () => {
    it('titulaire : isRead + readAt', async () => {
      const slip = {
        id: 'p1',
        userId: employee.id,
        companyId: 'co-1',
        periodMonth: 1,
        periodYear: 2024,
        fileUrl: 'k',
        fileSize: 1,
        uploadedById: rh.id,
        uploadedAt: new Date(),
        isRead: false,
        readAt: null,
        user: { ...userSummary },
      };
      prisma.payslip.findUnique.mockResolvedValue(slip);
      prisma.payslip.update.mockResolvedValue({
        ...slip,
        isRead: true,
        readAt: new Date(),
      });

      await service.markAsRead('p1', employee, {
        ipAddress: '203.0.113.1',
        userAgent: 'PaySlipApp/1',
      });
      expect(prisma.payslip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1' },
          data: expect.objectContaining({ isRead: true }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: employee.id,
          action: PAYSLIP_AUDIT.READ,
          entityType: 'Payslip',
          entityId: 'p1',
          ipAddress: '203.0.113.1',
          userAgent: 'PaySlipApp/1',
          metadata: expect.objectContaining({
            periodMonth: 1,
            periodYear: 2024,
          }),
        }),
      });
    });

    it('déjà lu : pas de nouvelle entrée d’audit', async () => {
      const slip = {
        id: 'p1',
        userId: employee.id,
        companyId: 'co-1',
        periodMonth: 1,
        periodYear: 2024,
        fileUrl: 'k',
        fileSize: 1,
        uploadedById: rh.id,
        uploadedAt: new Date(),
        isRead: true,
        readAt: new Date('2024-01-10'),
        user: { ...userSummary },
      };
      prisma.payslip.findUnique.mockResolvedValue(slip);
      prisma.payslip.update.mockResolvedValue({
        ...slip,
        readAt: new Date(),
      });

      await service.markAsRead('p1', employee);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('succès + audit PAYSLIP_DELETED', async () => {
      prisma.payslip.findUnique.mockResolvedValue({
        id: 'p-del',
        companyId: 'co-1',
        userId: 'u-target',
        fileUrl: 's3-key-del',
        periodMonth: 4,
        periodYear: 2024,
      });
      prisma.payslip.delete.mockResolvedValue({});

      await service.remove('p-del', rh);

      expect(storage.deleteFile).toHaveBeenCalledWith('s3-key-del');
      expect(prisma.payslip.delete).toHaveBeenCalledWith({
        where: { id: 'p-del' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: rh.id,
          action: PAYSLIP_AUDIT.DELETED,
          entityType: 'Payslip',
          entityId: 'p-del',
        }),
      });
    });
  });
});

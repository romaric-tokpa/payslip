import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service';
import type { RequestUser } from '../auth/auth.types';
import { OrganizationService } from '../organization/organization.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import { userPublicSelect } from './dto/user-public.select';
import { USER_AUDIT } from './users.constants';

function multerFile(buffer: Buffer, mimetype: string): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'test.csv',
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: null as unknown as NodeJS.ReadableStream,
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let auth: { inviteEmployee: jest.Mock };
  let prisma: {
    user: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    department: { findMany: jest.Mock; findFirst: jest.Mock };
    $transaction: jest.Mock;
    auditLog: { create: jest.Mock };
  };
  let organization: { assertOrgAssignment: jest.Mock };

  const publicUser = {
    id: 'u1',
    companyId: 'co-1',
    firstName: 'A',
    lastName: 'B',
    email: 'a@b.com',
    employeeId: 'E1',
    department: 'D1',
    departmentId: null as string | null,
    serviceId: null as string | null,
    orgDepartment: null as {
      id: string;
      name: string;
      directionId: string | null;
      direction: { id: string; name: string } | null;
    } | null,
    orgService: null as {
      id: string;
      name: string;
      departmentId: string | null;
    } | null,
    position: 'P1',
    role: 'EMPLOYEE' as const,
    isActive: true,
    entryDate: null,
    createdAt: new Date(),
  };

  const rh: RequestUser = {
    id: 'rh-1',
    email: 'rh@b.com',
    role: 'RH_ADMIN',
    companyId: 'co-1',
  };

  const superAdmin: RequestUser = {
    id: 'sa-1',
    email: 'sa@b.com',
    role: 'SUPER_ADMIN',
    companyId: null,
  };

  const employee: RequestUser = {
    id: 'u1',
    email: 'a@b.com',
    role: 'EMPLOYEE',
    companyId: 'co-1',
  };

  beforeEach(async () => {
    auth = {
      inviteEmployee: jest.fn().mockResolvedValue({
        activationCode: '123456',
        activationUrl: '/activate?code=123456',
      }),
    };

    prisma = {
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      department: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
    };

    organization = {
      assertOrgAssignment: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: OrganizationService, useValue: organization },
        { provide: AuthService, useValue: auth },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('findAllPaginated', () => {
    it('RH_ADMIN : filtre companyId + search + department', async () => {
      prisma.$transaction.mockResolvedValue([2, [publicUser]]);
      const q = { page: 1, limit: 20, search: 'fat', department: 'RH' };
      const out = await service.findAllPaginated(rh, q);

      expect(out.meta.total).toBe(2);
      expect(out.data).toHaveLength(1);
      expect(prisma.$transaction).toHaveBeenCalled();
      const txMock = prisma.$transaction as unknown as {
        mock: { calls: unknown[][] };
      };
      const firstCall = txMock.mock.calls[0];
      if (firstCall === undefined) {
        throw new Error('transaction attendue');
      }
      const ops = firstCall[0] as unknown[];
      expect(ops).toHaveLength(2);
    });

    it('SUPER_ADMIN : sans filtre entreprise', async () => {
      prisma.$transaction.mockResolvedValue([100, []]);
      await service.findAllPaginated(superAdmin, { page: 2, limit: 10 });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('EMPLOYEE : interdit', async () => {
      await expect(
        service.findAllPaginated(employee, {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('RH sans companyId : interdit', async () => {
      await expect(
        service.findAllPaginated({ ...rh, companyId: null }, {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('findOneForActor', () => {
    it('succès RH même entreprise', async () => {
      prisma.user.findUnique.mockResolvedValue(publicUser);
      const u = await service.findOneForActor(rh, 'u1');
      expect(u.id).toBe('u1');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u1' },
        select: userPublicSelect,
      });
    });

    it('RH autre entreprise → 403', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...publicUser,
        companyId: 'autre',
      });
      await expect(service.findOneForActor(rh, 'u1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('EMPLOYEE autre id → 403', async () => {
      prisma.user.findUnique.mockResolvedValue(publicUser);
      await expect(
        service.findOneForActor(employee, 'autre-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('EMPLOYEE son propre id → ok', async () => {
      prisma.user.findUnique.mockResolvedValue(publicUser);
      const u = await service.findOneForActor(employee, 'u1');
      expect(u.id).toBe('u1');
    });

    it('inconnu → 404', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOneForActor(rh, 'x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateForRhAdmin', () => {
    it('met à jour si même company', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        companyId: 'co-1',
        passwordHash: 'x',
        departmentId: null,
        serviceId: null,
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({ ...publicUser, firstName: 'Z' });

      const out = await service.updateForRhAdmin(rh, 'u1', { firstName: 'Z' });
      expect(out.firstName).toBe('Z');
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('mauvaise company → 403', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        companyId: 'autre',
      });
      await expect(
        service.updateForRhAdmin(rh, 'u1', { firstName: 'Z' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('email déjà pris → 409', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        companyId: 'co-1',
        departmentId: null,
        serviceId: null,
      });
      prisma.user.findFirst.mockResolvedValue({ id: 'other' });
      await expect(
        service.updateForRhAdmin(rh, 'u1', { email: 'taken@b.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('deactivate / reactivate', () => {
    it('deactivate : audit + isActive false', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        companyId: 'co-1',
      });
      prisma.user.update.mockResolvedValue({
        ...publicUser,
        id: 'u2',
        isActive: false,
      });

      await service.deactivateForRhAdmin(rh, 'u2');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
      const auditMock = prisma.auditLog.create as unknown as {
        mock: { calls: [unknown, ...unknown[]][] };
      };
      const deactivateAudit = auditMock.mock.calls[0][0] as {
        data: { action: string; entityId: string };
      };
      expect(deactivateAudit.data.action).toBe(USER_AUDIT.DEACTIVATED);
      expect(deactivateAudit.data.entityId).toBe('u2');
    });

    it('deactivate soi-même → 400', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: rh.id,
        companyId: 'co-1',
      });
      await expect(
        service.deactivateForRhAdmin(rh, rh.id),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reactivate : audit + isActive true', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        companyId: 'co-1',
      });
      prisma.user.update.mockResolvedValue({
        ...publicUser,
        id: 'u2',
        isActive: true,
      });

      await service.reactivateForRhAdmin(rh, 'u2');

      expect(prisma.auditLog.create).toHaveBeenCalled();
      const auditMock2 = prisma.auditLog.create as unknown as {
        mock: { calls: [unknown, ...unknown[]][] };
      };
      const reactivateAudit = auditMock2.mock.calls[0][0] as {
        data: { action: string };
      };
      expect(reactivateAudit.data.action).toBe(USER_AUDIT.REACTIVATED);
    });
  });

  describe('importEmployees', () => {
    const csvHeader = 'matricule,prenom,nom,email,departement,poste\n';

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
    });

    it('import CSV : 3 lignes créées', async () => {
      const body =
        csvHeader +
        'M1,Un,Premier,u1@t.com,RH,A\n' +
        'M2,De,Second,u2@t.com,RH,B\n' +
        'M3,Trois,Troisieme,u3@t.com,RH,C\n';
      const file = multerFile(Buffer.from(body, 'utf8'), 'text/csv');

      const report = await service.importEmployees(file, rh);

      expect(report.total).toBe(3);
      expect(report.created).toBe(3);
      expect(report.errors).toBe(0);
      expect(auth.inviteEmployee).toHaveBeenCalledTimes(3);
    });

    it('import avec erreurs (e-mail invalide + doublon fichier)', async () => {
      const body =
        csvHeader +
        'M1,A,B,bad-email,RH,X\n' +
        'M2,C,D,dup@t.com,RH,Y\n' +
        'M3,E,F,dup@t.com,RH,Z\n';
      const file = multerFile(Buffer.from(body, 'utf8'), 'text/csv');

      const report = await service.importEmployees(file, rh);

      expect(report.total).toBe(3);
      expect(report.created).toBe(1);
      expect(report.errors).toBe(2);
      expect(report.errorDetails.some((d) => d.reason.includes('E-mail'))).toBe(
        true,
      );
      expect(
        report.errorDetails.some((d) => d.reason.includes('Doublon')),
      ).toBe(true);
    });

    it('import : e-mail déjà en base', async () => {
      const body = csvHeader + 'M1,A,B,taken@t.com,RH,X\n';
      const file = multerFile(Buffer.from(body, 'utf8'), 'text/csv');
      prisma.user.findUnique.mockResolvedValue({ id: 'x' });

      const report = await service.importEmployees(file, rh);

      expect(report.created).toBe(0);
      expect(report.errors).toBe(1);
      expect(report.errorDetails[0].reason).toContain('E-mail déjà utilisé');
    });

    it('fichier vide → rapport zéro', async () => {
      const file = multerFile(
        Buffer.from('matricule,prenom,nom,email,departement,poste', 'utf8'),
        'text/csv',
      );
      const report = await service.importEmployees(file, rh);
      expect(report.total).toBe(0);
      expect(report.created).toBe(0);
    });

    it('buffer absent → BadRequest', async () => {
      const file = multerFile(Buffer.alloc(0), 'text/csv');
      await expect(service.importEmployees(file, rh)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('mimetype non autorisé → BadRequest', async () => {
      const file = multerFile(Buffer.from('x'), 'application/pdf');
      await expect(service.importEmployees(file, rh)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('CSV illisible → BadRequest', async () => {
      const file = multerFile(Buffer.from([0xff, 0xfe, 0xfd]), 'text/csv');
      await expect(service.importEmployees(file, rh)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('non RH → Forbidden', async () => {
      const file = multerFile(
        Buffer.from(csvHeader + 'M1,A,B,a@b.com,RH,X\n', 'utf8'),
        'text/csv',
      );
      await expect(
        service.importEmployees(file, superAdmin),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

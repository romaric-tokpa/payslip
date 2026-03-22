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
import { EmailService } from '../email/email.service';
import { StorageService } from '../storage/storage.service';
import { Readable } from 'stream';
import { UsersService } from './users.service';
import { userPublicSelect } from './dto/user-public.select';
import { USER_AUDIT } from './users.constants';
import type { UserImportConfigDto } from './dto/user-import-config.dto';

function multerFile(
  buffer: Buffer,
  mimetype: string,
  originalname = 'test.csv',
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
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

describe('UsersService', () => {
  let service: UsersService;
  let auth: {
    inviteEmployee: jest.Mock;
    createInvitedEmployeesBulk: jest.Mock;
    hashPassword: jest.Mock;
  };
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
    service: { findMany: jest.Mock };
    $transaction: jest.Mock;
    auditLog: { create: jest.Mock };
  };
  let organization: { assertOrgAssignment: jest.Mock };
  let storage: {
    getPresignedUrl: jest.Mock;
    uploadFileWithRetry: jest.Mock;
    deleteFile: jest.Mock;
    buildProfilePhotoKey: jest.Mock;
  };
  let email: { isSmtpConfigured: jest.Mock; sendActivationEmail: jest.Mock };

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
    mustChangePassword: false,
    entryDate: null,
    createdAt: new Date(),
    profilePhotoKey: null as string | null,
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
      createInvitedEmployeesBulk: jest.fn().mockResolvedValue(undefined),
      hashPassword: jest.fn().mockResolvedValue('hashed-password'),
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
      service: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    organization = {
      assertOrgAssignment: jest.fn().mockResolvedValue(undefined),
    };

    storage = {
      getPresignedUrl: jest
        .fn()
        .mockResolvedValue('https://signed.example/photo.jpg'),
      uploadFileWithRetry: jest.fn().mockResolvedValue(undefined),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      buildProfilePhotoKey: jest.fn(
        (c: string, u: string, e: string) => `companies/${c}/profiles/${u}.${e}`,
      ),
    };

    email = {
      isSmtpConfigured: jest.fn().mockReturnValue(false),
      sendActivationEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: OrganizationService, useValue: organization },
        { provide: StorageService, useValue: storage },
        { provide: EmailService, useValue: email },
        { provide: AuthService, useValue: auth },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('findAllPaginated', () => {
    it('RH_ADMIN : filtre companyId + search + department', async () => {
      prisma.$transaction.mockResolvedValue([
        2,
        [
          {
            ...publicUser,
            profilePhotoKey: 'companies/co-1/profiles/u1.jpg',
          },
        ],
      ]);
      const q = { page: 1, limit: 20, search: 'fat', department: 'RH' };
      const out = await service.findAllPaginated(rh, q);

      expect(out.meta.total).toBe(2);
      expect(out.data).toHaveLength(1);
      expect(out.data[0]?.profilePhotoUrl).toBe(
        'https://signed.example/photo.jpg',
      );
      expect(storage.getPresignedUrl).toHaveBeenCalled();
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
      prisma.user.findFirst.mockResolvedValue(publicUser);
      const u = await service.findOneForActor(rh, 'u1');
      expect(u.id).toBe('u1');
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'u1', companyId: 'co-1' },
        select: userPublicSelect,
      });
    });

    it('RH autre entreprise → 404 (non exposé)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.findOneForActor(rh, 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('EMPLOYEE autre id → 403', async () => {
      await expect(
        service.findOneForActor(employee, 'autre-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('EMPLOYEE son propre id → ok', async () => {
      prisma.user.findFirst.mockResolvedValue(publicUser);
      const u = await service.findOneForActor(employee, 'u1');
      expect(u.id).toBe('u1');
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'u1' },
        select: userPublicSelect,
      });
    });

    it('inconnu → 404', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.findOneForActor(rh, 'x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateForRhAdmin', () => {
    it('met à jour si même company', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({
          id: 'u1',
          companyId: 'co-1',
          passwordHash: 'x',
          departmentId: null,
          serviceId: null,
        })
        .mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({ ...publicUser, firstName: 'Z' });

      const out = await service.updateForRhAdmin(rh, 'u1', { firstName: 'Z' });
      expect(out.firstName).toBe('Z');
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('mauvaise company → 404', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.updateForRhAdmin(rh, 'u1', { firstName: 'Z' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('email déjà pris → 409', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({
          id: 'u1',
          companyId: 'co-1',
          departmentId: null,
          serviceId: null,
        })
        .mockResolvedValueOnce({ id: 'other' });
      await expect(
        service.updateForRhAdmin(rh, 'u1', { email: 'taken@b.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('deactivate / reactivate', () => {
    it('deactivate : audit + isActive false', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u2',
        companyId: 'co-1',
        employmentStatus: 'ACTIVE',
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
      prisma.user.findFirst.mockResolvedValue({
        id: rh.id,
        companyId: 'co-1',
        employmentStatus: 'ACTIVE',
      });
      await expect(
        service.deactivateForRhAdmin(rh, rh.id),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reactivate : audit + isActive true', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u2',
        companyId: 'co-1',
        employmentStatus: 'ACTIVE',
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
      prisma.user.findMany.mockResolvedValue([]);
    });

    it('import CSV avec en-tête e-mail (tiret) accepté', async () => {
      const body =
        'matricule,prenom,nom,e-mail,departement,poste\n' +
        'M1,A,B,u@t.com,RH,X\n';
      const file = multerFile(Buffer.from(body, 'utf8'), 'text/csv');

      const report = await service.importEmployees(file, rh);

      expect(report.created).toBe(1);
      expect(report.updated).toBe(0);
      expect(auth.createInvitedEmployeesBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ email: 'u@t.com' }),
        ]),
        rh,
        expect.any(Object),
      );
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
      expect(report.updated).toBe(0);
      expect(report.errors).toBe(0);
      expect(auth.createInvitedEmployeesBulk).toHaveBeenCalledTimes(1);
      expect(auth.createInvitedEmployeesBulk.mock.calls[0][0]).toHaveLength(3);
    });

    it('import avec erreurs (e-mail invalide + e-mail pris par autre matricule)', async () => {
      const body =
        csvHeader +
        'M1,A,B,bad-email,RH,X\n' +
        'M2,C,D,dup@t.com,RH,Y\n' +
        'M3,E,F,dup@t.com,RH,Z\n';
      const file = multerFile(Buffer.from(body, 'utf8'), 'text/csv');

      const report = await service.importEmployees(file, rh);

      expect(report.total).toBe(3);
      expect(report.created).toBe(1);
      expect(report.updated).toBe(0);
      expect(report.errors).toBe(2);
      expect(report.errorDetails.some((d) => d.reason.includes('Email'))).toBe(
        true,
      );
      expect(
        report.errorDetails.some(
          (d) =>
            d.reason.includes('Doublon (e-mail') ||
            d.reason.includes('autre collaborateur'),
        ),
      ).toBe(true);
    });

    it('import : e-mail déjà en base (nouveau matricule)', async () => {
      const body = csvHeader + 'M1,A,B,taken@t.com,RH,X\n';
      const file = multerFile(Buffer.from(body, 'utf8'), 'text/csv');
      prisma.user.findMany.mockImplementation(
        (args: {
          where?: { email?: { in?: string[] }; employeeId?: { in?: string[] } };
        }) => {
          if (args?.where?.employeeId?.in) {
            return Promise.resolve([]);
          }
          if (args?.where?.email?.in?.includes('taken@t.com')) {
            return Promise.resolve([
              {
                id: 'x',
                email: 'taken@t.com',
                companyId: 'co-1',
              },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const report = await service.importEmployees(file, rh);

      expect(report.created).toBe(0);
      expect(report.updated).toBe(0);
      expect(report.errors).toBe(1);
      expect(report.errorDetails[0].reason).toContain('autre collaborateur');
    });

    it('import : matricule existant → mise à jour', async () => {
      const body = csvHeader + 'M1,New,SurName,new@m.com,RH,Poste\n';
      const file = multerFile(Buffer.from(body, 'utf8'), 'text/csv');

      prisma.user.findMany.mockImplementation(
        (args: {
          where?: { email?: { in?: string[] }; employeeId?: { in?: string[] } };
        }) => {
          if (args?.where?.employeeId?.in?.includes('M1')) {
            return Promise.resolve([{ id: 'emp-1', employeeId: 'M1' }]);
          }
          if (args?.where?.email?.in?.includes('new@m.com')) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        },
      );

      prisma.user.findFirst.mockImplementation(
        (args: {
          where: {
            id?: string;
            companyId?: string;
            email?: string;
            NOT?: { id: string };
          };
        }) => {
          const w = args.where;
          if (w.id === 'emp-1' && w.companyId === 'co-1') {
            return Promise.resolve({
              id: 'emp-1',
              companyId: 'co-1',
              firstName: 'Old',
              lastName: 'One',
              email: 'old@m.com',
              employeeId: 'M1',
              department: null,
              departmentId: null,
              serviceId: null,
              role: 'EMPLOYEE' as const,
              passwordHash: 'h',
              isActive: true,
              entryDate: null,
              createdAt: new Date(),
            });
          }
          if (
            w.email === 'new@m.com' &&
            w.NOT?.id === 'emp-1'
          ) {
            return Promise.resolve(null);
          }
          return Promise.resolve(null);
        },
      );

      prisma.user.update.mockResolvedValue(publicUser);

      const report = await service.importEmployees(file, rh);

      expect(report.created).toBe(0);
      expect(report.updated).toBe(1);
      expect(report.errors).toBe(0);
      expect(auth.createInvitedEmployeesBulk).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('fichier vide → rapport zéro', async () => {
      const file = multerFile(
        Buffer.from('matricule,prenom,nom,email,departement,poste', 'utf8'),
        'text/csv',
      );
      const report = await service.importEmployees(file, rh);
      expect(report.total).toBe(0);
      expect(report.created).toBe(0);
      expect(report.updated).toBe(0);
    });

    it('buffer absent → BadRequest', async () => {
      const file = multerFile(Buffer.alloc(0), 'text/csv');
      await expect(service.importEmployees(file, rh)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('format non reconnu (PDF) → BadRequest', async () => {
      const file = multerFile(Buffer.from('x'), 'application/pdf', 'liste.pdf');
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

    it('import avec importConfig (libellés de colonnes libres)', async () => {
      const body = 'N° Employé,Prénom,NOM,MAIL\n' + 'E1,Jean,Dupont,j@t.com\n';
      const file = multerFile(Buffer.from(body, 'utf8'), 'text/csv');
      const config: UserImportConfigDto = {
        mappings: {
          matricule: 'N° Employé',
          prenom: 'Prénom',
          nom: 'NOM',
          email: 'MAIL',
        },
      };
      const report = await service.importEmployees(file, rh, config);
      expect(report.created).toBe(1);
      expect(report.updated).toBe(0);
      expect(auth.createInvitedEmployeesBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ email: 'j@t.com', firstName: 'Jean' }),
        ]),
        rh,
        expect.any(Object),
      );
    });

    it('import avec splitFullName', async () => {
      const body = 'Code,Nom complet,Courriel\n' + 'E1,Jean Dupont,j@t.com\n';
      const file = multerFile(Buffer.from(body, 'utf8'), 'text/csv');
      const config: UserImportConfigDto = {
        mappings: {
          matricule: 'Code',
          email: 'Courriel',
        },
        splitFullName: { column: 'Nom complet', separator: ' ' },
      };
      const report = await service.importEmployees(file, rh, config);
      expect(report.created).toBe(1);
      expect(report.updated).toBe(0);
      expect(auth.createInvitedEmployeesBulk).toHaveBeenCalled();
    });

    it('importConfig rowIndices ne traite que les lignes choisies', async () => {
      const body = 'a,b,c,d\n' + 'E1,A,B,e1@t.com\n' + 'E2,C,D,e2@t.com\n';
      const file = multerFile(Buffer.from(body, 'utf8'), 'text/csv');
      const config: UserImportConfigDto = {
        mappings: {
          matricule: 'a',
          prenom: 'b',
          nom: 'c',
          email: 'd',
        },
        rowIndices: [1],
      };
      const report = await service.importEmployees(file, rh, config);
      expect(report.total).toBe(1);
      expect(report.created).toBe(1);
      expect(report.updated).toBe(0);
      expect(auth.createInvitedEmployeesBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ email: 'e2@t.com' }),
        ]),
        rh,
        expect.any(Object),
      );
    });
  });
});

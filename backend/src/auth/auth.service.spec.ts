import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@prisma/client';
import { OrganizationService } from '../organization/organization.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { RequestUser } from './auth.types';
import { AuthService } from './auth.service';
import { SESSION_DEVICE } from './constants';
import { hashOpaqueToken, hashRefreshToken } from './auth.tokens';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    $transaction: jest.Mock;
    auditLog: {
      create: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
    };
    session: {
      create: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
    user: { update: jest.Mock; findUnique: jest.Mock };
  };
  let users: {
    findByEmail: jest.Mock;
    emailTaken: jest.Mock;
    findActiveEmployeesByEmployeeIdInsensitive: jest.Mock;
  };
  let organization: { assertOrgAssignment: jest.Mock };
  let jwt: { signAsync: jest.Mock };

  const pepper = 'refresh-pepper';
  const jwtSecret = 'access-secret';

  const baseUser = (): User => ({
    id: 'user-1',
    companyId: 'co-1',
    email: 'rh@entreprise.com',
    firstName: 'Awa',
    lastName: 'Diallo',
    role: 'RH_ADMIN',
    passwordHash: 'bcrypt-hash',
    isActive: true,
    employeeId: null,
    department: null,
    departmentId: null,
    serviceId: null,
    position: null,
    profilePhotoKey: null,
    entryDate: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
  });

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      session: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(null),
        delete: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
      },
    };

    users = {
      findByEmail: jest.fn(),
      emailTaken: jest.fn(),
      findActiveEmployeesByEmployeeIdInsensitive: jest.fn(),
    };

    organization = {
      assertOrgAssignment: jest.fn().mockResolvedValue(undefined),
    };

    jwt = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.access'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: users },
        { provide: OrganizationService, useValue: organization },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: string) => {
              if (key === 'JWT_ACCESS_EXPIRES') return '15m';
              if (key === 'JWT_REFRESH_DAYS') return '7';
              return def;
            },
            getOrThrow: (key: string) => {
              if (key === 'JWT_SECRET') return jwtSecret;
              if (key === 'JWT_REFRESH_SECRET') return pepper;
              throw new Error(`missing ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.mocked(bcrypt.hash).mockClear();
    jest.mocked(bcrypt.compare).mockReset();
  });

  describe('register', () => {
    it('crée entreprise + utilisateur RH_ADMIN et retourne les tokens', async () => {
      users.emailTaken.mockResolvedValue(false);
      const created = baseUser();
      prisma.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<User>) => {
          const tx = {
            company: {
              create: jest.fn().mockResolvedValue({ id: 'co-1', name: 'Co' }),
            },
            user: {
              create: jest.fn().mockResolvedValue(created),
            },
          };
          return fn(tx as never);
        },
      );

      const dto = {
        email: 'rh@entreprise.com',
        password: 'password12',
        firstName: 'Awa',
        lastName: 'Diallo',
        companyName: 'Ma boîte',
        companyRccm: 'CI-ABJ-2018-B-12345',
      };

      const result = await service.register(dto);

      expect(result.user.email).toBe('rh@entreprise.com');
      expect(result.user.role).toBe('RH_ADMIN');
      expect(result.accessToken).toBe('signed.jwt.access');
      expect(result.refreshToken).toBeDefined();
      expect(prisma.session.create).toHaveBeenCalled();
      const regSession = (
        prisma.session.create as unknown as { mock: { calls: unknown[][] } }
      ).mock.calls[0][0] as { data: { deviceInfo: null } };
      expect(regSession.data.deviceInfo).toBeNull();
      expect(jwt.signAsync).toHaveBeenCalled();
      const signCall = (
        jwt.signAsync as unknown as { mock: { calls: unknown[][] } }
      ).mock.calls[0];
      const signPayload = signCall[0] as {
        sub: string;
        role: string;
        email: string;
        companyId: string;
      };
      const signOpts = signCall[1] as { secret: string };
      expect(signPayload.sub).toBe('user-1');
      expect(signPayload.role).toBe('RH_ADMIN');
      expect(signPayload.email).toBe('rh@entreprise.com');
      expect(signPayload.companyId).toBe('co-1');
      expect(signOpts.secret).toBe(jwtSecret);
    });

    it('rejette si e-mail déjà utilisé', async () => {
      users.emailTaken.mockResolvedValue(true);
      await expect(
        service.register({
          email: 'taken@entreprise.com',
          password: 'password12',
          firstName: 'A',
          lastName: 'B',
          companyName: 'C',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('réussit avec bons identifiants', async () => {
      const u = baseUser();
      users.findByEmail.mockResolvedValue(u);
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const out = await service.login('rh@entreprise.com', 'password12');

      expect(out.user.id).toBe('user-1');
      expect(out.accessToken).toBe('signed.jwt.access');
      expect(prisma.auditLog.create).toHaveBeenCalled();
      const loginOkAudit = (
        prisma.auditLog.create as unknown as { mock: { calls: unknown[][] } }
      ).mock.calls[0][0] as { data: { action: string } };
      expect(loginOkAudit.data.action).toBe('LOGIN_SUCCESS');
      expect(prisma.session.create).toHaveBeenCalled();
    });

    it('rejette si mot de passe incorrect', async () => {
      users.findByEmail.mockResolvedValue(baseUser());
      jest.mocked(bcrypt.compare).mockResolvedValue(false as never);
      prisma.auditLog.findFirst.mockResolvedValue(null);
      prisma.auditLog.count.mockResolvedValue(0);

      await expect(
        service.login('rh@entreprise.com', 'wrong'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.auditLog.create).toHaveBeenCalled();
      const loginFailAudit = (
        prisma.auditLog.create as unknown as { mock: { calls: unknown[][] } }
      ).mock.calls[0][0] as { data: { action: string } };
      expect(loginFailAudit.data.action).toBe('LOGIN_FAILED');
    });

    it('rejette avec 423 si compte verrouillé / inactif', async () => {
      const locked = { ...baseUser(), isActive: false };
      users.findByEmail.mockResolvedValue(locked);

      try {
        await service.login('rh@entreprise.com', 'any');
        throw new Error('devrait lever HttpException');
      } catch (e) {
        if (e instanceof Error && e.message === 'devrait lever HttpException') {
          throw e;
        }
        expect(e).toBeInstanceOf(HttpException);
        expect((e as HttpException).getStatus()).toBe(423);
      }
    });
  });

  describe('loginEmployee', () => {
    const employeeUser = (): User => ({
      ...baseUser(),
      role: 'EMPLOYEE',
      employeeId: 'EMP-001',
      email: 'collab@entreprise.com',
    });

    it('réussit avec matricule + mot de passe corrects', async () => {
      const u = employeeUser();
      users.findActiveEmployeesByEmployeeIdInsensitive.mockResolvedValue([u]);
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const out = await service.loginEmployee('EMP-001', 'secret123');

      expect(out.user.id).toBe('user-1');
      expect(out.user.role).toBe('EMPLOYEE');
      expect(out.accessToken).toBe('signed.jwt.access');
      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(prisma.session.create).toHaveBeenCalled();
    });

    it('rejette si mot de passe incorrect', async () => {
      const u = employeeUser();
      users.findActiveEmployeesByEmployeeIdInsensitive.mockResolvedValue([u]);
      jest.mocked(bcrypt.compare).mockResolvedValue(false as never);
      prisma.auditLog.findFirst.mockResolvedValue(null);
      prisma.auditLog.count.mockResolvedValue(0);

      await expect(
        service.loginEmployee('EMP-001', 'wrong'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('rejette si matricule inconnu', async () => {
      users.findActiveEmployeesByEmployeeIdInsensitive.mockResolvedValue([]);

      await expect(
        service.loginEmployee('X', 'any'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejette si matricule ambigu', async () => {
      users.findActiveEmployeesByEmployeeIdInsensitive.mockResolvedValue([
        employeeUser(),
        { ...employeeUser(), id: 'user-2', email: 'b@x.com' },
      ]);

      await expect(
        service.loginEmployee('EMP-001', 'secret123'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('émet une nouvelle paire si refresh valide', async () => {
      const refreshPlain = 'opaque-refresh-token';
      const tokenHash = hashRefreshToken(refreshPlain, pepper);
      const u = baseUser();
      const sessionRow = {
        id: 'sess-1',
        userId: u.id,
        tokenHash,
        deviceInfo: null,
        expiresAt: new Date(Date.now() + 86400000),
        user: u,
      };
      prisma.$transaction.mockImplementation(async (fn) => {
        return fn({
          session: {
            findFirst: jest.fn().mockResolvedValue(sessionRow),
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        } as never);
      });

      const out = await service.refreshTokens(refreshPlain);

      expect(out.accessToken).toBe('signed.jwt.access');
      expect(out.refreshToken).toBeDefined();
      expect(prisma.session.create).toHaveBeenCalled();
    });

    it('rejette si refresh inconnu ou expiré', async () => {
      prisma.$transaction.mockImplementation(async (fn) => {
        return fn({
          session: {
            findFirst: jest.fn().mockResolvedValue(null),
            deleteMany: jest.fn(),
          },
        } as never);
      });
      await expect(service.refreshTokens('bad')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejette si le jeton a déjà été consommé (course / double refresh)', async () => {
      const refreshPlain = 'opaque-refresh-token';
      const tokenHash = hashRefreshToken(refreshPlain, pepper);
      const u = baseUser();
      const sessionRow = {
        id: 'sess-1',
        userId: u.id,
        tokenHash,
        deviceInfo: null,
        expiresAt: new Date(Date.now() + 86400000),
        user: u,
      };
      prisma.$transaction.mockImplementation(async (fn) => {
        return fn({
          session: {
            findFirst: jest.fn().mockResolvedValue(sessionRow),
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
        } as never);
      });
      await expect(service.refreshTokens(refreshPlain)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('inviteEmployee', () => {
    const inviterRh: RequestUser = {
      id: 'rh-1',
      email: 'rh@b.com',
      role: 'RH_ADMIN',
      companyId: 'co-1',
    };
    const inviterEmployee: RequestUser = {
      id: 'e-1',
      email: 'e@b.com',
      role: 'EMPLOYEE',
      companyId: 'co-1',
    };

    const inviteDto = {
      email: 'nouveau@corp.com',
      firstName: 'Fatou',
      lastName: 'Koné',
      employeeId: 'EMP-001',
      department: 'RH',
      position: 'Assistant',
    };

    it('crée employé inactif + session INVITATION 72h', async () => {
      users.emailTaken.mockResolvedValue(false);
      prisma.session.findFirst.mockResolvedValue(null);
      const createdEmp: User = {
        id: 'emp-new',
        companyId: 'co-1',
        email: 'nouveau@corp.com',
        firstName: 'Fatou',
        lastName: 'Koné',
        role: 'EMPLOYEE',
        passwordHash: 'hashed-password',
        isActive: false,
        employeeId: 'EMP-001',
        department: 'RH',
        departmentId: null,
        serviceId: null,
        position: 'Assistant',
        profilePhotoKey: null,
        entryDate: null,
        createdAt: new Date(),
      };
      const userCreate = jest.fn().mockResolvedValue(createdEmp);
      const sessionCreate = jest.fn().mockResolvedValue({});
      prisma.$transaction.mockImplementation(
        async (fn: (tx: never) => Promise<unknown>) => {
          return fn({
            user: { create: userCreate },
            session: { create: sessionCreate },
          } as never);
        },
      );

      const out = await service.inviteEmployee(inviteDto, inviterRh);

      expect(out.activationCode).toMatch(/^\d{6}$/);
      expect(out.activationUrl).toBe(`/activate?code=${out.activationCode}`);
      const expectedHash = hashOpaqueToken(
        SESSION_DEVICE.INVITATION,
        out.activationCode,
        pepper,
      );
      expect(userCreate).toHaveBeenCalled();
      expect(sessionCreate).toHaveBeenCalled();
      const sc = sessionCreate as unknown as { mock: { calls: unknown[][] } };
      const inviteSessionArg = sc.mock.calls[0][0] as {
        data: { deviceInfo: string; tokenHash: string };
      };
      expect(inviteSessionArg.data.deviceInfo).toBe(SESSION_DEVICE.INVITATION);
      expect(inviteSessionArg.data.tokenHash).toBe(expectedHash);
    });

    it('rejette si e-mail déjà pris', async () => {
      users.emailTaken.mockResolvedValue(true);
      await expect(
        service.inviteEmployee(inviteDto, inviterRh),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejette si l’inviteur n’est pas RH_ADMIN', async () => {
      users.emailTaken.mockResolvedValue(false);
      await expect(
        service.inviteEmployee(inviteDto, inviterEmployee),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('regenerateEmployeeInvitation', () => {
    const inviterRh: RequestUser = {
      id: 'rh-1',
      email: 'rh@b.com',
      role: 'RH_ADMIN',
      companyId: 'co-1',
    };
    const inactiveEmp: User = {
      id: 'emp-1',
      companyId: 'co-1',
      email: 'nouveau@corp.com',
      firstName: 'F',
      lastName: 'L',
      role: 'EMPLOYEE',
      passwordHash: 'h',
      isActive: false,
      employeeId: 'E1',
      department: null,
      departmentId: null,
      serviceId: null,
      position: null,
      profilePhotoKey: null,
      entryDate: null,
      createdAt: new Date(),
    };

    it('émet un nouveau code et remplace les sessions INVITATION', async () => {
      prisma.user.findUnique.mockResolvedValue(inactiveEmp);
      prisma.session.findFirst.mockResolvedValue(null);
      const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
      const sessionCreate = jest.fn().mockResolvedValue({});
      prisma.$transaction.mockImplementation(
        async (fn: (tx: never) => Promise<unknown>) => {
          return fn({
            session: { deleteMany, create: sessionCreate },
          } as never);
        },
      );

      const out = await service.regenerateEmployeeInvitation(
        inactiveEmp.id,
        inviterRh,
      );

      expect(out.activationCode).toMatch(/^\d{6}$/);
      expect(out.activationUrl).toBe(`/activate?code=${out.activationCode}`);
      expect(deleteMany).toHaveBeenCalledWith({
        where: {
          userId: inactiveEmp.id,
          deviceInfo: SESSION_DEVICE.INVITATION,
        },
      });
      const expectedHash = hashOpaqueToken(
        SESSION_DEVICE.INVITATION,
        out.activationCode,
        pepper,
      );
      expect(sessionCreate).toHaveBeenCalled();
      const sc = sessionCreate as unknown as { mock: { calls: unknown[][] } };
      const arg = sc.mock.calls[0][0] as {
        data: { tokenHash: string; deviceInfo: string };
      };
      expect(arg.data.tokenHash).toBe(expectedHash);
      expect(arg.data.deviceInfo).toBe(SESSION_DEVICE.INVITATION);
    });

    it('rejette si compte déjà actif', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...inactiveEmp,
        isActive: true,
      });
      await expect(
        service.regenerateEmployeeInvitation(inactiveEmp.id, inviterRh),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejette si autre entreprise', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...inactiveEmp,
        companyId: 'co-2',
      });
      await expect(
        service.regenerateEmployeeInvitation(inactiveEmp.id, inviterRh),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('activateInvitation', () => {
    const code = '482913';
    const emp: User = {
      id: 'emp-1',
      companyId: 'co-1',
      email: 'e@corp.com',
      firstName: 'F',
      lastName: 'L',
      role: 'EMPLOYEE',
      passwordHash: 'old',
      isActive: false,
      employeeId: 'E1',
      department: null,
      departmentId: null,
      serviceId: null,
      position: null,
      profilePhotoKey: null,
      entryDate: null,
      createdAt: new Date(),
    };

    it('active le compte et retourne les tokens', async () => {
      const th = hashOpaqueToken(SESSION_DEVICE.INVITATION, code, pepper);
      prisma.session.findFirst.mockResolvedValue({
        id: 's-inv',
        userId: emp.id,
        tokenHash: th,
        deviceInfo: SESSION_DEVICE.INVITATION,
        expiresAt: new Date(Date.now() + 3600000),
        user: emp,
      });
      prisma.$transaction.mockImplementation(
        async (fn: (tx: never) => Promise<User>) => {
          const tx = {
            session: { delete: jest.fn().mockResolvedValue({}) },
            user: {
              update: jest.fn().mockResolvedValue({
                ...emp,
                isActive: true,
                passwordHash: 'hashed-password',
              }),
            },
          };
          return fn(tx as never);
        },
      );

      const out = await service.activateInvitation({
        activationCode: code,
        newPassword: 'password12',
      });

      expect(out.user.id).toBe('emp-1');
      expect(out.user.role).toBe('EMPLOYEE');
      expect(out.accessToken).toBe('signed.jwt.access');
      expect(prisma.session.create).toHaveBeenCalled();
    });

    it('normalise un code saisi avec moins de 6 chiffres (zéros à gauche)', async () => {
      const short = '2913';
      const normalized = '002913';
      const th = hashOpaqueToken(SESSION_DEVICE.INVITATION, normalized, pepper);
      prisma.session.findFirst.mockResolvedValue({
        id: 's-inv',
        userId: emp.id,
        tokenHash: th,
        deviceInfo: SESSION_DEVICE.INVITATION,
        expiresAt: new Date(Date.now() + 3600000),
        user: emp,
      });
      prisma.$transaction.mockImplementation(
        async (fn: (tx: never) => Promise<User>) => {
          const tx = {
            session: { delete: jest.fn().mockResolvedValue({}) },
            user: {
              update: jest.fn().mockResolvedValue({
                ...emp,
                isActive: true,
                passwordHash: 'hashed-password',
              }),
            },
          };
          return fn(tx as never);
        },
      );

      await service.activateInvitation({
        activationCode: short,
        newPassword: 'password12',
      });

      expect(prisma.session.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tokenHash: th,
          }),
        }),
      );
    });

    it('rejette si code invalide', async () => {
      prisma.session.findFirst.mockResolvedValue(null);
      await expect(
        service.activateInvitation({
          activationCode: code,
          newPassword: 'password12',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejette si invitation expirée (session absente)', async () => {
      prisma.session.findFirst.mockResolvedValue(null);
      await expect(
        service.activateInvitation({
          activationCode: code,
          newPassword: 'password12',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('forgotPassword / resetPassword', () => {
    const activeUser = (): User => ({
      ...baseUser(),
      id: 'u-active',
      email: 'active@b.com',
      isActive: true,
    });

    it('forgot : ne crée pas de session si aucun utilisateur', async () => {
      users.findByEmail.mockResolvedValue(null);
      const out = await service.forgotPassword({ email: 'nope@b.com' });
      expect(out.message).toBeDefined();
      expect(out.resetToken).toBeUndefined();
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('forgot : crée session PASSWORD_RESET 1h si compte actif', async () => {
      users.findByEmail.mockResolvedValue(activeUser());
      const out = await service.forgotPassword({ email: 'active@b.com' });
      expect(out.resetToken).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(out.resetUrl).toBe(`/reset-password?token=${out.resetToken}`);
      expect(prisma.session.deleteMany).toHaveBeenCalled();
      expect(prisma.session.create).toHaveBeenCalled();
      const resetToken = out.resetToken;
      if (resetToken === undefined) {
        throw new Error('resetToken attendu');
      }
      const createMock = prisma.session.create as unknown as {
        mock: { calls: unknown[][] };
      };
      const forgotArg = createMock.mock.calls[0][0] as {
        data: { deviceInfo: string; tokenHash: string };
      };
      expect(forgotArg.data.deviceInfo).toBe(SESSION_DEVICE.PASSWORD_RESET);
      expect(forgotArg.data.tokenHash).toBe(
        hashOpaqueToken(SESSION_DEVICE.PASSWORD_RESET, resetToken, pepper),
      );
    });

    it('reset : rejette jeton invalide', async () => {
      prisma.session.findFirst.mockResolvedValue(null);
      await expect(
        service.resetPassword({
          resetToken: '550e8400-e29b-41d4-a716-446655440001',
          newPassword: 'password12',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('reset : met à jour le mot de passe et supprime la session', async () => {
      const rt = '550e8400-e29b-41d4-a716-446655440002';
      const u = activeUser();
      prisma.session.findFirst.mockResolvedValue({
        id: 's-r',
        userId: u.id,
        tokenHash: hashOpaqueToken(SESSION_DEVICE.PASSWORD_RESET, rt, pepper),
        deviceInfo: SESSION_DEVICE.PASSWORD_RESET,
        expiresAt: new Date(Date.now() + 3600000),
        user: u,
      });
      prisma.$transaction.mockImplementation(
        async (fn: (tx: never) => Promise<void>) => {
          const tx = {
            session: { delete: jest.fn().mockResolvedValue({}) },
            user: { update: jest.fn().mockResolvedValue({}) },
          };
          await fn(tx as never);
        },
      );

      const msg = await service.resetPassword({
        resetToken: rt,
        newPassword: 'password12',
      });
      expect(msg.message).toContain('Mot de passe');
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const actor: RequestUser = {
      id: 'user-1',
      email: 'x@y.com',
      role: 'RH_ADMIN',
      companyId: 'co-1',
    };

    it('refuse si mot de passe actuel incorrect', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hash',
        isActive: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(actor, 'wrong', 'newpass123'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('succès : mise à jour + audit PASSWORD_CHANGED', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hash',
        isActive: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const msg = await service.changePassword(actor, 'good', 'newpass123');
      expect(msg.message).toContain('mis à jour');
      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'PASSWORD_CHANGED' }),
        }),
      );
    });
  });
});

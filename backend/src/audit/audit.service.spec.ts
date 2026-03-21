import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  const prisma = {
    $transaction: jest.fn(),
    auditLog: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(AuditService);
  });

  it('refuse EMPLOYEE', async () => {
    await expect(
      service.findAllPaginated(
        {
          id: '1',
          email: 'e@x.com',
          role: 'EMPLOYEE',
          companyId: 'c1',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('RH_ADMIN sans companyId : Forbidden', async () => {
    await expect(
      service.findAllPaginated(
        {
          id: '1',
          email: 'rh@x.com',
          role: 'RH_ADMIN',
          companyId: null,
        },
        { page: 1, limit: 10 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('SUPER_ADMIN : transaction avec filtre vide', async () => {
    prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
    prisma.auditLog.count.mockResolvedValue(0);
    prisma.auditLog.findMany.mockResolvedValue([]);

    const res = await service.findAllPaginated(
      {
        id: '1',
        email: 'sa@x.com',
        role: 'SUPER_ADMIN',
        companyId: null,
      },
      { page: 1, limit: 10 },
    );

    expect(res.meta.total).toBe(0);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      }),
    );
  });
});

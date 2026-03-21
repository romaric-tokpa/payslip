import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { COMPANY_AUDIT } from './companies.constants';
import { CompaniesService } from './companies.service';

describe('CompaniesService', () => {
  let service: CompaniesService;
  const prisma = {
    company: { update: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const users = { getMe: jest.fn() };

  const rh: RequestUser = {
    id: 'rh-1',
    email: 'rh@b.com',
    role: 'RH_ADMIN',
    companyId: 'co-1',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    service = module.get(CompaniesService);
  });

  it('EMPLOYEE → Forbidden', async () => {
    await expect(
      service.updateMyCompany(
        { id: 'e', email: 'e@b.com', role: 'EMPLOYEE', companyId: 'co-1' },
        { name: 'X' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('RH sans companyId → BadRequest', async () => {
    await expect(
      service.updateMyCompany(
        { id: 'r', email: 'r@b.com', role: 'RH_ADMIN', companyId: null },
        { name: 'X' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('succès : update + audit + getMe', async () => {
    prisma.company.update.mockResolvedValue({});
    users.getMe.mockResolvedValue({
      user: { id: rh.id },
      company: { id: 'co-1', name: 'New', rccm: null, address: null },
    });

    const out = await service.updateMyCompany(rh, { name: 'New' });

    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'co-1' },
      data: { name: 'New' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: rh.id,
        action: COMPANY_AUDIT.LEGAL_INFO_UPDATED,
        entityType: 'Company',
        entityId: 'co-1',
      }),
    });
    expect(users.getMe).toHaveBeenCalledWith(rh);
    expect(out.company?.name).toBe('New');
  });
});

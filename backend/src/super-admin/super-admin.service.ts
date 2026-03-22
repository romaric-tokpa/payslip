import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SuperAdminAuditQueryDto } from './dto/super-admin-audit-query.dto';
import type { SuperAdminCompaniesQueryDto } from './dto/super-admin-companies-query.dto';
import type { SuperAdminUpdateCompanyDto } from './dto/super-admin-update-company.dto';

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function planLabel(subscriptionPlan: string | null): string {
  return subscriptionPlan?.trim() || 'trial';
}

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformStats() {
    const start = startOfUtcMonth(new Date());
    const [
      totalCompanies,
      totalUsers,
      totalPayslips,
      activeCompanies,
      companiesThisMonth,
      usersThisMonth,
      payslipsThisMonth,
      companiesRequiringSignature,
      payslipSignaturesThisMonth,
      totalPayslipSignatures,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.user.count({ where: { role: 'EMPLOYEE' } }),
      this.prisma.payslip.count(),
      this.prisma.company.count({
        where: {
          isActive: true,
          users: {
            some: {
              isActive: true,
              role: 'EMPLOYEE',
              employmentStatus: 'ACTIVE',
            },
          },
        },
      }),
      this.prisma.company.count({
        where: { createdAt: { gte: start } },
      }),
      this.prisma.user.count({
        where: {
          createdAt: { gte: start },
          role: 'EMPLOYEE',
        },
      }),
      this.prisma.payslip.count({
        where: { uploadedAt: { gte: start } },
      }),
      this.prisma.company.count({ where: { requireSignature: true } }),
      this.prisma.payslipSignature.count({
        where: { signedAt: { gte: start } },
      }),
      this.prisma.payslipSignature.count(),
    ]);

    return {
      totalCompanies,
      totalUsers,
      totalPayslips,
      activeCompanies,
      growth: {
        companiesThisMonth,
        usersThisMonth,
        payslipsThisMonth,
      },
      signatures: {
        companiesRequiringSignature,
        recordedThisMonth: payslipSignaturesThisMonth,
        totalRecorded: totalPayslipSignatures,
      },
    };
  }

  async getCompanies(query: SuperAdminCompaniesQueryDto) {
    const {
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
      plan,
      status,
    } = query;

    const andParts: Prisma.CompanyWhereInput[] = [];

    if (search?.trim()) {
      const s = search.trim();
      andParts.push({
        OR: [
          { name: { contains: s, mode: 'insensitive' } },
          { rccm: { contains: s, mode: 'insensitive' } },
          {
            users: {
              some: {
                email: { contains: s, mode: 'insensitive' },
                role: 'RH_ADMIN',
              },
            },
          },
        ],
      });
    }

    if (plan?.trim()) {
      const p = plan.trim();
      if (p === 'trial') {
        andParts.push({
          OR: [{ subscriptionPlan: null }, { subscriptionPlan: 'trial' }],
        });
      } else {
        andParts.push({ subscriptionPlan: p });
      }
    }

    if (status === 'inactive') {
      andParts.push({ isActive: false });
    } else if (status === 'active') {
      andParts.push({ isActive: true });
    } else if (status === 'trial') {
      andParts.push({
        isActive: true,
        OR: [{ subscriptionPlan: null }, { subscriptionPlan: 'trial' }],
      });
    }

    const where: Prisma.CompanyWhereInput =
      andParts.length > 0 ? { AND: andParts } : {};

    let orderBy: Prisma.CompanyOrderByWithRelationInput | Prisma.CompanyOrderByWithAggregationInput;
    if (sortBy === 'employeeCount') {
      orderBy = { users: { _count: sortOrder } };
    } else if (sortBy === 'payslipCount') {
      orderBy = { payslips: { _count: sortOrder } };
    } else if (sortBy === 'name') {
      orderBy = { name: sortOrder };
    } else {
      orderBy = { createdAt: sortOrder };
    }

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: orderBy as Prisma.CompanyOrderByWithRelationInput,
        include: {
          _count: { select: { users: true } },
          users: {
            where: { role: 'RH_ADMIN' },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
            take: 1,
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    const enriched = await Promise.all(
      companies.map(async (c) => {
        const [employeeCount, activeCount, payslipCount, lastPayslip] =
          await Promise.all([
            this.prisma.user.count({
              where: { companyId: c.id, role: 'EMPLOYEE' },
            }),
            this.prisma.user.count({
              where: {
                companyId: c.id,
                role: 'EMPLOYEE',
                employmentStatus: 'ACTIVE',
              },
            }),
            this.prisma.payslip.count({ where: { companyId: c.id } }),
            this.prisma.payslip.findFirst({
              where: { companyId: c.id },
              orderBy: { uploadedAt: 'desc' },
              select: { uploadedAt: true },
            }),
          ]);

        const admin = c.users[0] ?? null;
        return {
          id: c.id,
          name: c.name,
          rccm: c.rccm,
          plan: planLabel(c.subscriptionPlan),
          isActive: c.isActive,
          requireSignature: c.requireSignature,
          createdAt: c.createdAt,
          admin,
          employeeCount,
          activeCount,
          payslipCount,
          lastActivity: lastPayslip?.uploadedAt ?? c.updatedAt,
        };
      }),
    );

    return { companies: enriched, total };
  }

  async getCompanyDetail(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        users: {
          where: { role: 'RH_ADMIN' },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        directions: {
          include: {
            departments: { include: { services: true } },
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Entreprise non trouvée');
    }

    const [
      totalEmployees,
      activeEmployees,
      departedEmployees,
      totalPayslips,
      readPayslips,
      payslipsByMonth,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { companyId, role: 'EMPLOYEE' },
      }),
      this.prisma.user.count({
        where: {
          companyId,
          role: 'EMPLOYEE',
          employmentStatus: 'ACTIVE',
        },
      }),
      this.prisma.user.count({
        where: {
          companyId,
          role: 'EMPLOYEE',
          employmentStatus: 'DEPARTED',
        },
      }),
      this.prisma.payslip.count({
        where: { companyId },
      }),
      this.prisma.payslip.count({
        where: { companyId, isRead: true },
      }),
      this.prisma.$queryRaw<{ month: string; count: number }[]>`
        SELECT TO_CHAR(p.uploaded_at, 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM "Payslip" p
        INNER JOIN "User" u ON p.user_id = u.id
        WHERE u.company_id = ${companyId}
        GROUP BY TO_CHAR(p.uploaded_at, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `,
    ]);

    const directions = company.directions.length;
    let departments = 0;
    let services = 0;
    for (const d of company.directions) {
      departments += d.departments.length;
      for (const dep of d.departments) {
        services += dep.services.length;
      }
    }

    const lastUpload = await this.prisma.payslip.findFirst({
      where: { companyId },
      orderBy: { uploadedAt: 'desc' },
      select: { uploadedAt: true },
    });

    return {
      id: company.id,
      name: company.name,
      rccm: company.rccm,
      phone: company.phone,
      address: company.address,
      subscriptionPlan: company.subscriptionPlan,
      plan: planLabel(company.subscriptionPlan),
      isActive: company.isActive,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      rhAdmins: company.users,
      directions: company.directions,
      stats: {
        totalEmployees,
        activeEmployees,
        departedEmployees,
        totalPayslips,
        readPayslips,
        consultationRate:
          totalPayslips > 0
            ? Math.round((readPayslips / totalPayslips) * 100)
            : 0,
        payslipsByMonth,
        orgStructure: { directions, departments, services },
        lastUploadAt: lastUpload?.uploadedAt ?? null,
      },
    };
  }

  async updateCompany(companyId: string, dto: SuperAdminUpdateCompanyDto) {
    const existing = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Entreprise non trouvée');
    }

    const data: Prisma.CompanyUpdateInput = {};
    if (dto.plan !== undefined) {
      data.subscriptionPlan = dto.plan;
    }
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    if (Object.keys(data).length === 0) {
      return this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    }

    return this.prisma.company.update({
      where: { id: companyId },
      data,
    });
  }

  async getGlobalAuditLogs(query: SuperAdminAuditQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Prisma.AuditLogWhereInput = {};

    if (query.companyId) {
      where.companyId = query.companyId;
    }
    if (query.action?.trim()) {
      where.action = query.action.trim();
    }
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        where.createdAt.lte = new Date(query.to);
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
          company: { select: { name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  async getGrowthData() {
    const [companiesByMonth, usersByMonth, payslipsByMonth, topCompaniesRaw] =
      await Promise.all([
        this.prisma.$queryRaw<{ month: string; count: number }[]>`
          SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*)::int AS count
          FROM "Company"
          GROUP BY TO_CHAR(created_at, 'YYYY-MM')
          ORDER BY month DESC
          LIMIT 12
        `,
        this.prisma.$queryRaw<{ month: string; count: number }[]>`
          SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*)::int AS count
          FROM "User"
          WHERE role = 'EMPLOYEE'
          GROUP BY TO_CHAR(created_at, 'YYYY-MM')
          ORDER BY month DESC
          LIMIT 12
        `,
        this.prisma.$queryRaw<{ month: string; count: number }[]>`
          SELECT TO_CHAR(uploaded_at, 'YYYY-MM') AS month, COUNT(*)::int AS count
          FROM "Payslip"
          GROUP BY TO_CHAR(uploaded_at, 'YYYY-MM')
          ORDER BY month DESC
          LIMIT 12
        `,
        this.prisma.company.findMany({
          take: 10,
          orderBy: { users: { _count: 'desc' } },
          include: { _count: { select: { users: true } } },
        }),
      ]);

    const topCompanies = await Promise.all(
      topCompaniesRaw.map(async (c) => {
        const employeeCount = await this.prisma.user.count({
          where: { companyId: c.id, role: 'EMPLOYEE' },
        });
        return {
          id: c.id,
          name: c.name,
          userCount: employeeCount,
          totalUsers: c._count.users,
        };
      }),
    );

    return {
      companiesByMonth,
      usersByMonth,
      payslipsByMonth,
      topCompanies,
    };
  }

  async getRecentCompanies(limit = 5) {
    const rows = await this.prisma.company.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          where: { role: 'RH_ADMIN' },
          select: { email: true, firstName: true, lastName: true },
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return Promise.all(
      rows.map(async (c) => {
        const employeeCount = await this.prisma.user.count({
          where: { companyId: c.id, role: 'EMPLOYEE' },
        });
        const admin = c.users[0];
        return {
          id: c.id,
          name: c.name,
          createdAt: c.createdAt,
          adminEmail: admin?.email ?? null,
          adminName: admin
            ? `${admin.firstName} ${admin.lastName}`.trim()
            : null,
          employeeCount,
          plan: planLabel(c.subscriptionPlan),
        };
      }),
    );
  }
}

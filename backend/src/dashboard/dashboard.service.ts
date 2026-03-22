import { ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { DepartureService } from '../users/departure.service';

export type MonthlyUploadStat = {
  month: number;
  year: number;
  count: number;
};

export type TopUnreadRow = {
  userId: string;
  firstName: string;
  lastName: string;
  employeeId: string | null;
  department: string | null;
  lastPayslipPeriod: string;
  isRead: boolean;
};

export type ExpiringContractDashboardRow = {
  userId: string;
  firstName: string;
  lastName: string;
  employeeId: string | null;
  departmentLabel: string | null;
  contractEndDate: string;
  daysRemaining: number;
};

export type DashboardStats = {
  totalEmployees: number;
  activeEmployees: number;
  /** Nouveaux collaborateurs (compte créé) sur le mois civil courant (UTC). */
  newEmployeesThisMonth: number;
  payslipsThisMonth: number;
  consultationRate: number;
  /** Taux de lecture des bulletins du mois civil précédent (UTC). */
  consultationRatePreviousMonth: number;
  /** consultationRate − consultationRatePreviousMonth (points de %). */
  consultationRateDelta: number;
  unreadPayslips: number;
  monthlyUploads: MonthlyUploadStat[];
  topUnread: TopUnreadRow[];
  expiringContracts: ExpiringContractDashboardRow[];
  departedThisMonth: number;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departure: DepartureService,
  ) {}

  private assertRhAdminWithCompany(actor: RequestUser): string {
    if (actor.role !== 'RH_ADMIN' || !actor.companyId) {
      throw new ForbiddenException();
    }
    return actor.companyId;
  }

  async getStats(actor: RequestUser): Promise<DashboardStats> {
    const companyId = this.assertRhAdminWithCompany(actor);

    const now = new Date();
    const cy = now.getUTCFullYear();
    const cm = now.getUTCMonth() + 1;

    const monthStart = new Date(Date.UTC(cy, cm - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(cy, cm, 0, 23, 59, 59, 999));
    const startOfMonthUtc = monthStart;

    const py = cm === 1 ? cy - 1 : cy;
    const pm = cm === 1 ? 12 : cm - 1;

    const [
      totalEmployees,
      activeEmployees,
      newEmployeesThisMonth,
      payslipsThisMonth,
      periodPayslipsAgg,
      prevMonthPayslipsAgg,
      unreadPayslips,
      expiringContractsRaw,
      departedThisMonth,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { companyId, role: 'EMPLOYEE' },
      }),
      this.prisma.user.count({
        where: {
          companyId,
          role: 'EMPLOYEE',
          employmentStatus: { in: ['ACTIVE', 'ON_NOTICE'] },
        },
      }),
      this.prisma.user.count({
        where: {
          companyId,
          role: 'EMPLOYEE',
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      this.prisma.payslip.count({
        where: {
          companyId,
          uploadedAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      this.prisma.payslip.findMany({
        where: {
          companyId,
          periodYear: cy,
          periodMonth: cm,
        },
        select: { isRead: true },
      }),
      this.prisma.payslip.findMany({
        where: {
          companyId,
          periodYear: py,
          periodMonth: pm,
        },
        select: { isRead: true },
      }),
      this.prisma.payslip.count({
        where: { companyId, isRead: false },
      }),
      this.departure.getExpiringContracts(companyId, 30),
      this.prisma.user.count({
        where: {
          companyId,
          role: 'EMPLOYEE',
          employmentStatus: 'DEPARTED',
          departedAt: { gte: startOfMonthUtc, lte: monthEnd },
        },
      }),
    ]);

    const periodTotal = periodPayslipsAgg.length;
    const periodRead = periodPayslipsAgg.filter((p) => p.isRead).length;
    const consultationRate =
      periodTotal > 0 ? Math.round((100 * periodRead) / periodTotal) : 0;

    const prevTotal = prevMonthPayslipsAgg.length;
    const prevRead = prevMonthPayslipsAgg.filter((p) => p.isRead).length;
    const consultationRatePreviousMonth =
      prevTotal > 0 ? Math.round((100 * prevRead) / prevTotal) : 0;
    const consultationRateDelta =
      consultationRate - consultationRatePreviousMonth;

    const monthlyUploads = await this.buildMonthlyUploads(companyId, now);

    const topUnread = await this.buildTopUnread(companyId);

    const expiringContracts: ExpiringContractDashboardRow[] =
      expiringContractsRaw.slice(0, 5).map(({ user: u, daysRemaining }) => ({
        userId: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        employeeId: u.employeeId,
        departmentLabel:
          u.orgDepartment?.name ?? u.department ?? null,
        contractEndDate: u.contractEndDate!.toISOString(),
        daysRemaining,
      }));

    return {
      totalEmployees,
      activeEmployees,
      newEmployeesThisMonth,
      payslipsThisMonth,
      consultationRate,
      consultationRatePreviousMonth,
      consultationRateDelta,
      unreadPayslips,
      monthlyUploads,
      topUnread,
      expiringContracts,
      departedThisMonth,
    };
  }

  private async buildMonthlyUploads(
    companyId: string,
    now: Date,
  ): Promise<MonthlyUploadStat[]> {
    const out: MonthlyUploadStat[] = [];
    const baseY = now.getUTCFullYear();
    const baseM = now.getUTCMonth();

    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(baseY, baseM - i, 1));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      const count = await this.prisma.payslip.count({
        where: {
          companyId,
          uploadedAt: { gte: start, lte: end },
        },
      });
      out.push({ month: m, year: y, count });
    }
    return out;
  }

  private async buildTopUnread(companyId: string): Promise<TopUnreadRow[]> {
    const payslips = await this.prisma.payslip.findMany({
      where: {
        companyId,
        user: { role: 'EMPLOYEE' },
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
          },
        },
      },
    });

    const latestByUser = new Map<string, (typeof payslips)[0]>();
    for (const p of payslips) {
      if (!latestByUser.has(p.userId)) {
        latestByUser.set(p.userId, p);
      }
    }

    const unread = [...latestByUser.values()]
      .filter((p) => !p.isRead)
      .sort((a, b) => {
        if (b.periodYear !== a.periodYear) {
          return b.periodYear - a.periodYear;
        }
        return b.periodMonth - a.periodMonth;
      })
      .slice(0, 10);

    return unread.map((p) => ({
      userId: p.userId,
      firstName: p.user.firstName,
      lastName: p.user.lastName,
      employeeId: p.user.employeeId,
      department: p.user.department,
      lastPayslipPeriod: `${String(p.periodMonth).padStart(2, '0')}/${String(p.periodYear)}`,
      isRead: p.isRead,
    }));
  }
}

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

export type ConsultationByMonthRow = {
  month: string;
  total: number;
  read: number;
  rate: number;
};

export type ConsultationByDepartmentRow = {
  departmentId: string;
  departmentName: string;
  total: number;
  read: number;
  rate: number;
};

export type PayslipsByMonthChartRow = {
  month: string;
  count: number;
};

export type UnreadEmployeeMonthRow = {
  payslipId: string;
  userId: string;
  name: string;
  employeeId: string | null;
  department: string | null;
  distributedAt: string;
};

export type RecentPayslipDashboardRow = {
  id: string;
  periodMonth: number;
  periodYear: number;
  uploadedAt: string;
  isRead: boolean;
  isSigned: boolean;
  user: {
    firstName: string;
    lastName: string;
    employeeId: string | null;
  };
};

export type DashboardKpiBlock = {
  totalEmployees: number;
  activeEmployeesStrict: number;
  departedEmployees: number;
  onNoticeEmployees: number;
  pendingEmployees: number;
  totalPayslips: number;
  totalDirections: number;
  totalDepartments: number;
  totalServices: number;
};

export type DashboardStats = {
  totalEmployees: number;
  activeEmployees: number;
  totalDepartments: number;
  totalPayslips: number;
  newEmployeesThisMonth: number;
  /** Bulletins sur la période de paie du mois civil courant (UTC), aligné sur consultationRate. */
  payslipsThisMonth: number;
  consultationRate: number;
  consultationRatePreviousMonth: number;
  consultationRateDelta: number;
  unreadPayslips: number;
  monthlyUploads: MonthlyUploadStat[];
  topUnread: TopUnreadRow[];
  expiringContracts: ExpiringContractDashboardRow[];
  departedThisMonth: number;
  requireSignature: boolean;
  signatureRateCurrentMonth: number | null;
  signaturePeriodMonth: number;
  signaturePeriodYear: number;
  signaturePeriodSigned: number;
  signaturePeriodTotal: number;
  kpi: DashboardKpiBlock;
  currentMonth: {
    month: number;
    year: number;
    payslipsDistributed: number;
    payslipsRead: number;
    consultationRate: number;
    newEmployees: number;
  };
  trends: {
    consultationRateDelta: number;
    payslipsDelta: number;
    employeesDelta: number;
  };
  charts: {
    consultationByMonth: ConsultationByMonthRow[];
    consultationByDepartment: ConsultationByDepartmentRow[];
    payslipsByMonth: PayslipsByMonthChartRow[];
  };
  unreadEmployeesThisMonth: UnreadEmployeeMonthRow[];
  recentPayslips: RecentPayslipDashboardRow[];
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

  async remindUnreadCurrentMonth(actor: RequestUser): Promise<{ reminded: number }> {
    const companyId = this.assertRhAdminWithCompany(actor);
    const now = new Date();
    const cy = now.getUTCFullYear();
    const cm = now.getUTCMonth() + 1;

    const rows = await this.prisma.payslip.findMany({
      where: {
        companyId,
        periodMonth: cm,
        periodYear: cy,
        isRead: false,
        user: {
          employmentStatus: { in: ['ACTIVE', 'ON_NOTICE'] },
        },
      },
      select: { userId: true },
    });

    const userIds = [...new Set(rows.map((r) => r.userId))];
    if (userIds.length === 0) {
      return { reminded: 0 };
    }

    const periodLabel = `${String(cm).padStart(2, '0')}/${cy}`;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title: 'Rappel : bulletin de paie',
        message: `Votre bulletin ${periodLabel} est disponible — consultez-le dans l’application PaySlip Manager.`,
        type: 'PAYSLIP_READ_REMINDER',
      })),
    });

    return { reminded: userIds.length };
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
    const prevMonthStart = new Date(Date.UTC(py, pm - 1, 1, 0, 0, 0, 0));
    const prevMonthEnd = new Date(Date.UTC(py, pm, 0, 23, 59, 59, 999));

    const [
      companyRow,
      totalEmployees,
      activeEmployeesStrict,
      onNoticeEmployees,
      departedEmployees,
      pendingEmployees,
      totalDepartments,
      totalDirections,
      totalServices,
      totalPayslips,
      newEmployeesThisMonth,
      newEmployeesPrevMonth,
      periodPayslipsAgg,
      prevMonthPayslipsAgg,
      unreadPayslips,
      expiringContractsRaw,
      departedThisMonth,
    ] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({
        where: { id: companyId },
        select: { requireSignature: true },
      }),
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
          employmentStatus: 'ON_NOTICE',
        },
      }),
      this.prisma.user.count({
        where: {
          companyId,
          role: 'EMPLOYEE',
          employmentStatus: 'DEPARTED',
        },
      }),
      this.prisma.user.count({
        where: {
          companyId,
          role: 'EMPLOYEE',
          employmentStatus: 'PENDING',
        },
      }),
      this.prisma.department.count({ where: { companyId } }),
      this.prisma.direction.count({ where: { companyId } }),
      this.prisma.service.count({ where: { companyId } }),
      this.prisma.payslip.count({ where: { companyId } }),
      this.prisma.user.count({
        where: {
          companyId,
          role: 'EMPLOYEE',
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      this.prisma.user.count({
        where: {
          companyId,
          role: 'EMPLOYEE',
          createdAt: { gte: prevMonthStart, lte: prevMonthEnd },
        },
      }),
      this.prisma.payslip.findMany({
        where: {
          companyId,
          periodYear: cy,
          periodMonth: cm,
        },
        select: { isRead: true, isSigned: true },
      }),
      this.prisma.payslip.findMany({
        where: {
          companyId,
          periodYear: py,
          periodMonth: pm,
        },
        select: { isRead: true, isSigned: true },
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

    const activeEmployees = activeEmployeesStrict + onNoticeEmployees;

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

    const payslipsThisMonth = periodTotal;
    const payslipsDelta = periodTotal - prevTotal;
    const employeesDelta = newEmployeesThisMonth - newEmployeesPrevMonth;

    const sigSigned = periodPayslipsAgg.filter((p) => p.isSigned).length;
    const signatureRateCurrentMonth =
      companyRow.requireSignature && periodTotal > 0
        ? Math.round((100 * sigSigned) / periodTotal)
        : null;

    const [
      consultationByMonth,
      consultationByDepartment,
      payslipsByMonth,
      unreadPayslipRows,
      recentPayslipRows,
    ] = await Promise.all([
      this.prisma.$queryRaw<ConsultationByMonthRow[]>`
        SELECT
          TO_CHAR(MAKE_DATE(p.period_year, p.period_month, 1), 'YYYY-MM') AS month,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE p.is_read = true)::int AS read,
          CASE
            WHEN COUNT(*) > 0
            THEN ROUND(
              (COUNT(*) FILTER (WHERE p.is_read = true)::numeric / COUNT(*)::numeric) * 100
            )::int
            ELSE 0
          END AS rate
        FROM "Payslip" p
        WHERE p.company_id = ${companyId}
          AND MAKE_DATE(p.period_year, p.period_month, 1) >= (
            (date_trunc('month', timezone('utc', now())))::date - interval '11 months'
          )
        GROUP BY p.period_year, p.period_month
        ORDER BY p.period_year ASC, p.period_month ASC
      `,
      this.prisma.$queryRaw<ConsultationByDepartmentRow[]>`
        SELECT
          d.id AS "departmentId",
          d.name AS "departmentName",
          COUNT(p.id)::int AS total,
          COUNT(p.id) FILTER (WHERE p.is_read = true)::int AS read,
          CASE
            WHEN COUNT(p.id) > 0
            THEN ROUND(
              (COUNT(p.id) FILTER (WHERE p.is_read = true)::numeric / COUNT(p.id)::numeric) * 100
            )::int
            ELSE 0
          END AS rate
        FROM "Department" d
        INNER JOIN "User" u ON u.department_id = d.id
        INNER JOIN "Payslip" p ON p.user_id = u.id
        WHERE d.company_id = ${companyId}
          AND p.period_month = ${cm}
          AND p.period_year = ${cy}
        GROUP BY d.id, d.name
        ORDER BY rate ASC
      `,
      this.prisma.$queryRaw<PayslipsByMonthChartRow[]>`
        SELECT
          TO_CHAR(date_trunc('month', p.uploaded_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS month,
          COUNT(*)::int AS count
        FROM "Payslip" p
        WHERE p.company_id = ${companyId}
          AND p.uploaded_at >= (
            date_trunc('month', timezone('utc', now())) - interval '11 months'
          )
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      this.prisma.payslip.findMany({
        where: {
          companyId,
          periodMonth: cm,
          periodYear: cy,
          isRead: false,
          user: {
            employmentStatus: { in: ['ACTIVE', 'ON_NOTICE'] },
          },
        },
        select: {
          id: true,
          uploadedAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: true,
              orgDepartment: { select: { name: true } },
            },
          },
        },
        orderBy: { uploadedAt: 'asc' },
        take: 15,
      }),
      this.prisma.payslip.findMany({
        where: { companyId },
        orderBy: { uploadedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          periodMonth: true,
          periodYear: true,
          uploadedAt: true,
          isRead: true,
          isSigned: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              employeeId: true,
            },
          },
        },
      }),
    ]);

    const monthlyUploads = await this.buildMonthlyUploads(companyId, now);

    const topUnread = await this.buildTopUnread(companyId);

    const expiringContracts: ExpiringContractDashboardRow[] =
      expiringContractsRaw.slice(0, 10).map(({ user: u, daysRemaining }) => ({
        userId: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        employeeId: u.employeeId,
        departmentLabel:
          u.orgDepartment?.name ?? u.department ?? null,
        contractEndDate: u.contractEndDate!.toISOString(),
        daysRemaining,
      }));

    const unreadEmployeesThisMonth: UnreadEmployeeMonthRow[] =
      unreadPayslipRows.map((p) => ({
        payslipId: p.id,
        userId: p.user.id,
        name: `${p.user.firstName} ${p.user.lastName}`.trim(),
        employeeId: p.user.employeeId,
        department:
          p.user.orgDepartment?.name?.trim() ||
          p.user.department?.trim() ||
          null,
        distributedAt: p.uploadedAt.toISOString(),
      }));

    const recentPayslips: RecentPayslipDashboardRow[] = recentPayslipRows.map(
      (p) => ({
        id: p.id,
        periodMonth: p.periodMonth,
        periodYear: p.periodYear,
        uploadedAt: p.uploadedAt.toISOString(),
        isRead: p.isRead,
        isSigned: p.isSigned,
        user: {
          firstName: p.user.firstName,
          lastName: p.user.lastName,
          employeeId: p.user.employeeId,
        },
      }),
    );

    const kpi: DashboardKpiBlock = {
      totalEmployees,
      activeEmployeesStrict,
      departedEmployees,
      onNoticeEmployees,
      pendingEmployees,
      totalPayslips,
      totalDirections,
      totalDepartments,
      totalServices,
    };

    return {
      totalEmployees,
      activeEmployees,
      totalDepartments,
      totalPayslips,
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
      requireSignature: companyRow.requireSignature,
      signatureRateCurrentMonth,
      signaturePeriodMonth: cm,
      signaturePeriodYear: cy,
      signaturePeriodSigned: sigSigned,
      signaturePeriodTotal: periodTotal,
      kpi,
      currentMonth: {
        month: cm,
        year: cy,
        payslipsDistributed: periodTotal,
        payslipsRead: periodRead,
        consultationRate,
        newEmployees: newEmployeesThisMonth,
      },
      trends: {
        consultationRateDelta,
        payslipsDelta,
        employeesDelta,
      },
      charts: {
        consultationByMonth,
        consultationByDepartment,
        payslipsByMonth,
      },
      unreadEmployeesThisMonth,
      recentPayslips,
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

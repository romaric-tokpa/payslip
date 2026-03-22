import { ForbiddenException, Injectable, StreamableFile } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

const FR_MONTHS = [
  '',
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

const auditUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  companyId: true,
} satisfies Prisma.UserSelect;

export type AuditLogRow = Prisma.AuditLogGetPayload<{
  include: { user: { select: typeof auditUserSelect } };
}>;

export type PaginatedAuditLogs = {
  data: AuditLogRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

const EXPORT_MAX_ROWS = 10_000;

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllPaginated(
    actor: RequestUser,
    query: QueryAuditLogsDto,
  ): Promise<PaginatedAuditLogs> {
    if (actor.role !== 'RH_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException();
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    await this.assertUserFilterAllowed(actor, query.userId);
    const where = this.buildWhere(actor, query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: auditUserSelect },
        },
      }),
    ]);

    return {
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  /** Actions présentes dans le périmètre (entreprise pour RH_ADMIN). */
  async listDistinctActions(actor: RequestUser): Promise<string[]> {
    if (actor.role !== 'RH_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException();
    }
    const where = this.buildWhere(actor, {});
    const rows = await this.prisma.auditLog.findMany({
      where,
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });
    return rows.map((r) => r.action);
  }

  async exportCsvStream(
    actor: RequestUser,
    query: QueryAuditLogsDto,
  ): Promise<StreamableFile> {
    if (actor.role !== 'RH_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException();
    }
    await this.assertUserFilterAllowed(actor, query.userId);
    const where = this.buildWhere(actor, query);

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: EXPORT_MAX_ROWS,
      include: { user: { select: auditUserSelect } },
    });

    const header = ['Date', 'Action', 'Détail', 'Utilisateur', 'IP'].join(
      ',',
    );
    const lines = rows.map((r) =>
      [
        csvEscape(r.createdAt.toISOString()),
        csvEscape(r.action),
        csvEscape(this.formatDetail(r)),
        csvEscape(this.formatUserName(r.user)),
        csvEscape(r.ipAddress ?? ''),
      ].join(','),
    );
    const body = [header, ...lines].join('\n');
    const withBom = `\uFEFF${body}`;
    const buf = Buffer.from(withBom, 'utf8');
    return new StreamableFile(buf, {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="journal-activite.csv"',
    });
  }

  private formatUserName(
    user: { firstName: string; lastName: string } | null,
  ): string {
    if (!user) {
      return '';
    }
    return `${user.firstName} ${user.lastName}`.trim();
  }

  private formatDetail(row: AuditLogRow): string {
    const meta = row.metadata as Record<string, unknown> | null | undefined;
    const pm =
      typeof meta?.periodMonth === 'number'
        ? meta.periodMonth
        : typeof meta?.periodMonth === 'string'
          ? Number(meta.periodMonth)
          : undefined;
    const py =
      typeof meta?.periodYear === 'number'
        ? meta.periodYear
        : typeof meta?.periodYear === 'string'
          ? Number(meta.periodYear)
          : undefined;
    const periodPhrase =
      pm != null &&
      py != null &&
      pm >= 1 &&
      pm <= 12 &&
      !Number.isNaN(py)
        ? `${FR_MONTHS[pm]} ${py}`
        : null;

    switch (row.action) {
      case 'LOGIN_SUCCESS':
        return 'Connexion réussie';
      case 'LOGIN_FAILED':
        return 'Échec de connexion';
      case 'PASSWORD_CHANGED':
        return 'Mot de passe modifié';
      case 'USER_DEACTIVATED':
        return 'Collaborateur désactivé';
      case 'USER_REACTIVATED':
        return 'Collaborateur réactivé';
      case 'PAYSLIP_UPLOADED':
        return periodPhrase
          ? `Bulletin téléversé — ${periodPhrase}`
          : 'Bulletin téléversé';
      case 'PAYSLIP_READ':
        return periodPhrase
          ? `Bulletin consulté — ${periodPhrase}`
          : 'Bulletin consulté (marqué lu)';
      case 'PAYSLIP_DELETED':
        return periodPhrase
          ? `Bulletin supprimé — ${periodPhrase}`
          : 'Bulletin supprimé';
      case 'COMPANY_LEGAL_INFO_UPDATED':
        return 'Informations légales de l’entreprise mises à jour';
      case 'COMPANY_REGISTERED':
        return 'Inscription entreprise et compte administrateur créés';
      default:
        return row.entityType
          ? `${row.action} (${row.entityType})`
          : row.action;
    }
  }

  private async assertUserFilterAllowed(
    actor: RequestUser,
    userId: string | undefined,
  ): Promise<void> {
    const uid = userId?.trim();
    if (!uid) {
      return;
    }
    if (actor.role === 'SUPER_ADMIN') {
      return;
    }
    if (actor.role !== 'RH_ADMIN' || !actor.companyId) {
      throw new ForbiddenException();
    }
    const u = await this.prisma.user.findFirst({
      where: { id: uid, companyId: actor.companyId },
      select: { id: true },
    });
    if (!u) {
      throw new ForbiddenException(
        'Utilisateur inconnu ou hors de votre entreprise',
      );
    }
  }

  private buildWhere(
    actor: RequestUser,
    query: QueryAuditLogsDto,
  ): Prisma.AuditLogWhereInput {
    const and: Prisma.AuditLogWhereInput[] = [];

    if (actor.role === 'RH_ADMIN') {
      if (!actor.companyId) {
        throw new ForbiddenException('Compte sans entreprise associée');
      }
      and.push({
        OR: [
          { companyId: actor.companyId },
          {
            AND: [
              { companyId: null },
              { user: { companyId: actor.companyId } },
            ],
          },
        ],
      });
    }

    if (query.userId?.trim()) {
      and.push({ userId: query.userId.trim() });
    }

    if (query.action?.trim()) {
      and.push({ action: query.action.trim() });
    }

    if (query.entityType?.trim()) {
      and.push({ entityType: query.entityType.trim() });
    }

    const start = query.startDate?.trim() || query.from?.trim();
    const end = query.endDate?.trim() || query.to?.trim();
    const createdAt: Prisma.DateTimeFilter = {};
    if (start) {
      const d = new Date(start);
      if (!Number.isNaN(d.getTime())) {
        createdAt.gte = d;
      }
    }
    if (end) {
      const d = new Date(end);
      if (!Number.isNaN(d.getTime())) {
        createdAt.lte = d;
      }
    }
    if (Object.keys(createdAt).length > 0) {
      and.push({ createdAt });
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      and.push({
        OR: [
          { user: { email: { contains: s, mode: 'insensitive' } } },
          { user: { firstName: { contains: s, mode: 'insensitive' } } },
          { user: { lastName: { contains: s, mode: 'insensitive' } } },
          { action: { contains: s, mode: 'insensitive' } },
          { entityType: { contains: s, mode: 'insensitive' } },
          { entityId: { contains: s, mode: 'insensitive' } },
        ],
      });
    }

    if (and.length === 0) {
      return {};
    }
    return { AND: and };
  }
}

import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

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
        user: { companyId: actor.companyId },
      });
    }

    if (query.action?.trim()) {
      and.push({ action: query.action.trim() });
    }

    if (query.entityType?.trim()) {
      and.push({ entityType: query.entityType.trim() });
    }

    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from?.trim()) {
      const d = new Date(query.from.trim());
      if (!Number.isNaN(d.getTime())) {
        createdAt.gte = d;
      }
    }
    if (query.to?.trim()) {
      const d = new Date(query.to.trim());
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

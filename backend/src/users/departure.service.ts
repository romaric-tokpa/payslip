import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';

export type UserWithOrgForContracts = Prisma.UserGetPayload<{
  include: { orgDepartment: true; orgService: true };
}>;
import { PrismaService } from '../prisma/prisma.service';
import type { BulkDepartureDto, InitiateDepartureDto } from './dto/departure.dto';

@Injectable()
export class DepartureService {
  private readonly logger = new Logger(DepartureService.name);

  constructor(private readonly prisma: PrismaService) {}

  async initiateDepart(
    userId: string,
    dto: InitiateDepartureDto,
    companyId: string,
    adminId: string,
  ): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
    });

    if (!user) {
      throw new NotFoundException('Collaborateur non trouvé');
    }
    if (
      user.employmentStatus === 'DEPARTED' ||
      user.employmentStatus === 'ARCHIVED'
    ) {
      throw new BadRequestException(
        "Ce collaborateur est déjà sorti de l'entreprise",
      );
    }

    if (dto.departureType === 'TERMINATION' && !dto.reason?.trim()) {
      throw new BadRequestException(
        'Le motif est obligatoire pour un licenciement',
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { readOnlyDaysAfterDeparture: true },
    });
    const readOnlyDays = company?.readOnlyDaysAfterDeparture ?? 90;

    const departureDate = new Date(dto.departureDate);
    const now = new Date();
    const noticeEnd = dto.noticeEndDate
      ? new Date(dto.noticeEndDate)
      : null;
    const hasNotice =
      noticeEnd != null && !Number.isNaN(noticeEnd.getTime()) && noticeEnd > now;

    const readOnlyUntil = new Date(departureDate);
    readOnlyUntil.setDate(readOnlyUntil.getDate() + readOnlyDays);

    const meta: Prisma.InputJsonValue = {
      departureType: dto.departureType,
      reason: dto.reason ?? null,
      departureDate: dto.departureDate,
      hasNotice,
      noticeEndDate: dto.noticeEndDate ?? null,
    };

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          employmentStatus: hasNotice ? 'ON_NOTICE' : 'DEPARTED',
          departureType: dto.departureType,
          departureReason: dto.reason?.trim() || null,
          departureDate,
          noticeStartDate: hasNotice ? now : null,
          noticeEndDate: hasNotice ? noticeEnd : null,
          departedAt: hasNotice ? null : now,
          departedById: adminId,
          readOnlyUntil,
          isActive: hasNotice ? true : false,
        },
      });

      if (!hasNotice) {
        await tx.session.deleteMany({ where: { userId } });
      }

      await tx.auditLog.create({
        data: {
          userId: adminId,
          companyId,
          action: 'USER_DEPARTED',
          entityType: 'USER',
          entityId: userId,
          metadata: meta,
        },
      });

      return updated;
    });

    return updatedUser;
  }

  async bulkDepart(
    dto: BulkDepartureDto,
    companyId: string,
    adminId: string,
  ): Promise<{ departed: number; errors: { userId: string; reason: string }[] }> {
    const BATCH_SIZE = 50;
    let departed = 0;
    const errors: { userId: string; reason: string }[] = [];

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { readOnlyDaysAfterDeparture: true },
    });
    const readOnlyDays = company?.readOnlyDaysAfterDeparture ?? 90;

    for (let i = 0; i < dto.userIds.length; i += BATCH_SIZE) {
      const batch = dto.userIds.slice(i, i + BATCH_SIZE);

      await this.prisma.$transaction(
        async (tx) => {
          for (const uid of batch) {
            try {
              const u = await tx.user.findFirst({
                where: {
                  id: uid,
                  companyId,
                  employmentStatus: {
                    in: ['ACTIVE', 'ON_NOTICE', 'PENDING'],
                  },
                },
              });

              if (!u) {
                errors.push({
                  userId: uid,
                  reason: 'Collaborateur non trouvé ou déjà sorti',
                });
                continue;
              }

              const departureDate = new Date(dto.departureDate);
              const readOnlyUntil = new Date(departureDate);
              readOnlyUntil.setDate(readOnlyUntil.getDate() + readOnlyDays);

              await tx.user.update({
                where: { id: uid },
                data: {
                  employmentStatus: 'DEPARTED',
                  departureType: dto.departureType,
                  departureReason: dto.reason?.trim() || null,
                  departureDate,
                  noticeStartDate: null,
                  noticeEndDate: null,
                  departedAt: new Date(),
                  departedById: adminId,
                  readOnlyUntil,
                  isActive: false,
                },
              });

              await tx.session.deleteMany({ where: { userId: uid } });
              departed += 1;
            } catch (e) {
              errors.push({
                userId: uid,
                reason: e instanceof Error ? e.message : String(e),
              });
            }
          }
        },
        { timeout: 30_000 },
      );
    }

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        companyId,
        action: 'BULK_DEPARTURE',
        entityType: 'USER',
        entityId: companyId,
        metadata: {
          total: dto.userIds.length,
          departed,
          errors: errors.length,
          departureType: dto.departureType,
          reason: dto.reason ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    return { departed, errors };
  }

  async reinstate(
    userId: string,
    companyId: string,
    adminId: string,
    newContractEndDate?: string,
  ): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        employmentStatus: { in: ['DEPARTED', 'ON_NOTICE'] },
      },
    });

    if (!user) {
      throw new NotFoundException(
        'Collaborateur non trouvé ou pas en état de réintégration',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const reinstated = await tx.user.update({
        where: { id: userId },
        data: {
          employmentStatus: 'ACTIVE',
          isActive: true,
          departureType: null,
          departureReason: null,
          departureDate: null,
          noticeStartDate: null,
          noticeEndDate: null,
          departedAt: null,
          departedById: null,
          readOnlyUntil: null,
          contractEndDate: newContractEndDate
            ? new Date(newContractEndDate)
            : user.contractEndDate,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          companyId,
          action: 'USER_REINSTATED',
          entityType: 'USER',
          entityId: userId,
          metadata: {
            previousStatus: user.employmentStatus,
          } as Prisma.InputJsonValue,
        },
      });

      return reinstated;
    });
  }

  /**
   * Archivage manuel : compte marqué ARCHIVED, sessions révoquées.
   * Les bulletins restent en base / S3 (conformité).
   */
  async archiveDepartedUser(
    userId: string,
    companyId: string,
    adminId: string,
  ): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId, employmentStatus: 'DEPARTED' },
    });
    if (!user) {
      throw new BadRequestException(
        'Seul un collaborateur en statut « sorti » (DEPARTED) peut être archivé.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const archived = await tx.user.update({
        where: { id: userId },
        data: {
          employmentStatus: 'ARCHIVED',
          isActive: false,
          readOnlyUntil: null,
          archivedAt: new Date(),
        },
      });
      await tx.session.deleteMany({ where: { userId } });
      await tx.auditLog.create({
        data: {
          userId: adminId,
          companyId,
          action: 'USER_ARCHIVED',
          entityType: 'USER',
          entityId: userId,
          metadata: {} as Prisma.InputJsonValue,
        },
      });
      return archived;
    });
  }

  async getExpiringContracts(
    companyId: string,
    daysAhead: number = 30,
  ): Promise<{ user: UserWithOrgForContracts; daysRemaining: number }[]> {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + daysAhead);

    const users = await this.prisma.user.findMany({
      where: {
        companyId,
        employmentStatus: { in: ['ACTIVE', 'ON_NOTICE'] },
        contractType: { in: ['CDD', 'INTERIM', 'STAGE'] },
        contractEndDate: {
          not: null,
          lte: deadline,
          gte: new Date(),
        },
      },
      include: {
        orgDepartment: true,
        orgService: true,
      },
      orderBy: { contractEndDate: 'asc' },
    });

    return users.map((u) => ({
      user: u,
      daysRemaining: Math.ceil(
        (u.contractEndDate!.getTime() - Date.now()) / (86_400_000),
      ),
    }));
  }

  async processExpiredNotices(): Promise<number> {
    const now = new Date();
    const due = await this.prisma.user.findMany({
      where: {
        employmentStatus: 'ON_NOTICE',
        noticeEndDate: { lte: now },
      },
      select: { id: true },
    });
    if (due.length === 0) {
      return 0;
    }
    const ids = due.map((d) => d.id);
    await this.prisma.$transaction([
      this.prisma.user.updateMany({
        where: { id: { in: ids } },
        data: {
          employmentStatus: 'DEPARTED',
          isActive: false,
          departedAt: now,
        },
      }),
      this.prisma.session.deleteMany({
        where: { userId: { in: ids } },
      }),
    ]);
    if (due.length > 0) {
      this.logger.log(
        `${due.length} collaborateur(s) en préavis passé(s) en DEPARTED`,
      );
    }
    return due.length;
  }

  async processExpiredReadOnly(): Promise<number> {
    const now = new Date();
    const expired = await this.prisma.user.findMany({
      where: {
        employmentStatus: 'DEPARTED',
        readOnlyUntil: { not: null, lte: now },
        archivedAt: null,
      },
      select: { id: true },
    });
    if (expired.length === 0) {
      return 0;
    }
    const ids = expired.map((e) => e.id);
    await this.prisma.$transaction([
      this.prisma.user.updateMany({
        where: { id: { in: ids } },
        data: { readOnlyUntil: null },
      }),
      this.prisma.session.deleteMany({ where: { userId: { in: ids } } }),
    ]);
    return expired.length;
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/auth.types';
import { frenchMonthName } from '../notifications/notifications.constants';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { PAYSLIP_AUDIT } from './payslips.constants';
import { QueryPayslipsDto } from './dto/query-payslips.dto';
import { isLikelyPdfUpload } from './payslip-pdf.util';

/** MATRICULE_MM_AAAA.pdf (underscores entre segments). */
const BULK_FILENAME_SEP = /^(.*)_(\d{2})_(\d{4})\.pdf$/i;
/** Forme compacte : …MMYYYY.pdf (ex. EMP001032024.pdf). */
const BULK_FILENAME_COMPACT = /^(.+)(\d{2})(\d{4})\.pdf$/i;

function parseBulkFilename(name: string): {
  matricule: string;
  month: number;
  year: number;
} | null {
  const sep = name.match(BULK_FILENAME_SEP);
  if (sep) {
    return {
      matricule: sep[1].trim(),
      month: Number.parseInt(sep[2], 10),
      year: Number.parseInt(sep[3], 10),
    };
  }
  const compact = name.match(BULK_FILENAME_COMPACT);
  if (compact) {
    return {
      matricule: compact[1].replace(/_+$/u, '').trim(),
      month: Number.parseInt(compact[2], 10),
      year: Number.parseInt(compact[3], 10),
    };
  }
  return null;
}

const userListSelect = {
  firstName: true,
  lastName: true,
  employeeId: true,
  department: true,
  orgDepartment: {
    select: {
      name: true,
      direction: { select: { name: true } },
    },
  },
  orgService: { select: { name: true } },
} as const;

export type PayslipWithUserList = Prisma.PayslipGetPayload<{
  include: { user: { select: typeof userListSelect } };
}>;

export type PayslipDetail = PayslipWithUserList & { presignedUrl: string };

export type PaginatedPayslips = {
  data: PayslipWithUserList[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type BulkUploadDetail = {
  filename: string;
  matricule: string;
  status: 'OK' | 'ERROR';
  reason?: string;
};

export type BulkUploadReport = {
  total: number;
  success: number;
  failed: number;
  details: BulkUploadDetail[];
};

@Injectable()
export class PayslipsService {
  private readonly logger = new Logger(PayslipsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  async uploadSingle(
    file: Express.Multer.File,
    userId: string,
    periodMonth: number,
    periodYear: number,
    adminUser: RequestUser,
  ): Promise<PayslipWithUserList> {
    this.assertRhAdminWithCompany(adminUser);

    if (!isLikelyPdfUpload(file)) {
      throw new BadRequestException('Seuls les fichiers PDF sont acceptés');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Le fichier ne doit pas dépasser 10 Mo');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: userId, companyId: adminUser.companyId! },
    });
    if (!target) {
      throw new ForbiddenException(
        'Utilisateur introuvable ou hors de votre entreprise',
      );
    }

    const existing = await this.prisma.payslip.findFirst({
      where: { userId, periodMonth, periodYear },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Un bulletin existe déjà pour cette période et ce collaborateur',
      );
    }

    const key = this.storage.buildPayslipKey(
      adminUser.companyId!,
      userId,
      periodYear,
      periodMonth,
    );
    try {
      await this.storage.uploadFile(file.buffer, key, 'application/pdf');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Échec upload stockage S3: ${msg}`);
      throw new ServiceUnavailableException(
        `Stockage S3/MinIO indisponible : ${msg}. Vérifiez que MinIO tourne (docker compose up -d minio), les variables S3_* dans backend/.env, et le bucket (ou ajoutez S3_ENSURE_BUCKET=true pour le créer au démarrage).`,
      );
    }

    let created: PayslipWithUserList;
    try {
      created = await this.prisma.payslip.create({
        data: {
          userId,
          companyId: adminUser.companyId!,
          periodMonth,
          periodYear,
          fileUrl: key,
          fileSize: file.size,
          uploadedById: adminUser.id,
        },
        include: { user: { select: { ...userListSelect } } },
      });
    } catch (e) {
      await this.storage.deleteFile(key).catch(() => undefined);
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Un bulletin existe déjà pour cette période et ce collaborateur',
        );
      }
      throw e;
    }

    await this.prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: PAYSLIP_AUDIT.UPLOADED,
        entityType: 'Payslip',
        entityId: created.id,
        metadata: {
          targetUserId: userId,
          periodMonth,
          periodYear,
        } as Prisma.InputJsonValue,
      },
    });

    void this.notifications
      .sendPushToUser(
        created.userId,
        'Nouveau bulletin',
        `Votre bulletin de paie de ${frenchMonthName(created.periodMonth)} ${created.periodYear} est disponible`,
        { payslipId: created.id, type: 'NEW_PAYSLIP' },
      )
      .catch((err: unknown) => {
        this.logger.warn(
          `Échec notification bulletin ${created.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    return created;
  }

  async uploadBulk(
    files: Express.Multer.File[],
    adminUser: RequestUser,
  ): Promise<BulkUploadReport> {
    this.assertRhAdminWithCompany(adminUser);
    const list = files ?? [];
    const details: BulkUploadDetail[] = [];
    let success = 0;
    let failed = 0;

    for (const file of list) {
      const filename = file.originalname || '';

      if (!isLikelyPdfUpload(file)) {
        failed += 1;
        details.push({
          filename,
          matricule: '—',
          status: 'ERROR',
          reason: 'Seuls les fichiers PDF sont acceptés',
        });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        failed += 1;
        details.push({
          filename,
          matricule: '—',
          status: 'ERROR',
          reason: 'Le fichier ne doit pas dépasser 10 Mo',
        });
        continue;
      }

      const parsed = parseBulkFilename(filename);
      if (!parsed) {
        failed += 1;
        details.push({
          filename,
          matricule: '—',
          status: 'ERROR',
          reason:
            'Nom de fichier invalide (attendu : MATRICULE_MM_AAAA.pdf ou …MMYYYY.pdf, ex. EMP001_03_2024.pdf)',
        });
        continue;
      }

      const { matricule, month, year } = parsed;
      if (month < 1 || month > 12 || year < 2020) {
        failed += 1;
        details.push({
          filename,
          matricule,
          status: 'ERROR',
          reason: 'Période invalide dans le nom du fichier',
        });
        continue;
      }

      const employee = await this.users.findByCompanyAndEmployeeId(
        adminUser.companyId!,
        matricule,
      );
      if (!employee) {
        failed += 1;
        details.push({
          filename,
          matricule,
          status: 'ERROR',
          reason: 'Matricule non trouvé',
        });
        continue;
      }

      try {
        await this.uploadSingle(file, employee.id, month, year, adminUser);
        success += 1;
        details.push({ filename, matricule, status: 'OK' });
      } catch (e) {
        failed += 1;
        const reason =
          e instanceof ConflictException
            ? 'Bulletin déjà existant pour cette période'
            : e instanceof ForbiddenException
              ? 'Accès refusé'
              : e instanceof BadRequestException
                ? e.message
                : e instanceof Error
                  ? e.message
                  : 'Erreur inconnue';
        details.push({ filename, matricule, status: 'ERROR', reason });
      }
    }

    return {
      total: list.length,
      success,
      failed,
      details,
    };
  }

  async findAll(
    query: QueryPayslipsDto,
    actor: RequestUser,
  ): Promise<PaginatedPayslips> {
    if (actor.role !== 'RH_ADMIN' && actor.role !== 'EMPLOYEE') {
      throw new ForbiddenException();
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.PayslipWhereInput = {};

    if (actor.role === 'RH_ADMIN') {
      if (!actor.companyId) {
        throw new ForbiddenException('Compte sans entreprise associée');
      }
      where.companyId = actor.companyId;
      if (query.userId) {
        where.userId = query.userId;
      }
    } else {
      where.userId = actor.id;
    }

    if (query.year != null) {
      where.periodYear = query.year;
    }
    if (query.month != null) {
      where.periodMonth = query.month;
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.payslip.count({ where }),
      this.prisma.payslip.findMany({
        where,
        include: { user: { select: { ...userListSelect } } },
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async findOne(id: string, actor: RequestUser): Promise<PayslipDetail> {
    const payslip = await this.prisma.payslip.findUnique({
      where: { id },
      include: { user: { select: { ...userListSelect } } },
    });
    if (!payslip) {
      throw new NotFoundException('Bulletin introuvable');
    }
    this.assertPayslipAccess(payslip, actor);
    const presignedUrl = await this.storage.getPresignedUrl(payslip.fileUrl);
    return { ...payslip, presignedUrl };
  }

  async getDownloadUrl(id: string, actor: RequestUser): Promise<string> {
    const { presignedUrl } = await this.findOne(id, actor);
    return presignedUrl;
  }

  async markAsRead(
    id: string,
    actor: RequestUser,
    client?: { ipAddress: string | null; userAgent: string | null },
  ): Promise<PayslipWithUserList> {
    if (actor.role !== 'EMPLOYEE') {
      throw new ForbiddenException();
    }
    const payslip = await this.prisma.payslip.findUnique({
      where: { id },
      include: { user: { select: { ...userListSelect } } },
    });
    if (!payslip) {
      throw new NotFoundException('Bulletin introuvable');
    }
    if (payslip.userId !== actor.id) {
      throw new ForbiddenException();
    }

    const wasUnread = !payslip.isRead;
    const readAt = new Date();

    const updated = await this.prisma.payslip.update({
      where: { id },
      data: { isRead: true, readAt },
      include: { user: { select: { ...userListSelect } } },
    });

    if (wasUnread) {
      await this.prisma.auditLog.create({
        data: {
          userId: actor.id,
          action: PAYSLIP_AUDIT.READ,
          entityType: 'Payslip',
          entityId: id,
          ipAddress: client?.ipAddress ?? undefined,
          userAgent: client?.userAgent ?? undefined,
          metadata: {
            periodMonth: payslip.periodMonth,
            periodYear: payslip.periodYear,
            readAt: readAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    }

    return updated;
  }

  async remove(id: string, actor: RequestUser): Promise<void> {
    this.assertRhAdminWithCompany(actor);

    const payslip = await this.prisma.payslip.findUnique({ where: { id } });
    if (!payslip) {
      throw new NotFoundException('Bulletin introuvable');
    }
    if (payslip.companyId !== actor.companyId) {
      throw new ForbiddenException();
    }

    await this.storage.deleteFile(payslip.fileUrl);
    await this.prisma.payslip.delete({ where: { id } });

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: PAYSLIP_AUDIT.DELETED,
        entityType: 'Payslip',
        entityId: id,
        metadata: {
          targetUserId: payslip.userId,
          periodMonth: payslip.periodMonth,
          periodYear: payslip.periodYear,
        } as Prisma.InputJsonValue,
      },
    });
  }

  private assertRhAdminWithCompany(actor: RequestUser): void {
    if (actor.role !== 'RH_ADMIN') {
      throw new ForbiddenException();
    }
    if (!actor.companyId) {
      throw new ForbiddenException('Compte sans entreprise associée');
    }
  }

  private assertPayslipAccess(
    payslip: { companyId: string; userId: string },
    actor: RequestUser,
  ): void {
    if (actor.role === 'RH_ADMIN') {
      if (!actor.companyId || payslip.companyId !== actor.companyId) {
        throw new ForbiddenException();
      }
      return;
    }
    if (actor.role === 'EMPLOYEE') {
      if (payslip.userId !== actor.id) {
        throw new ForbiddenException();
      }
      return;
    }
    throw new ForbiddenException();
  }
}

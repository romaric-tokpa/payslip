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
import { isUserOperational } from '../users/user-lifecycle.util';
import { UsersService } from '../users/users.service';
import {
  PAYSLIP_AUDIT,
  PAYSLIP_BULK_USER_MESSAGES,
} from './payslips.constants';
import { QueryPayslipsDto } from './dto/query-payslips.dto';
import { parseBulkFilename } from './payslip-bulk-filename.util';
import {
  PayslipBulkTempStore,
  type PayslipBulkStoredFile,
} from './payslip-bulk-temp.store';
import type { PayslipMatchResult } from './payslip-matcher.types';
import { PayslipMatcherService } from './payslip-matcher.service';
import { PayslipPdfExtractorService } from './payslip-pdf-extractor.service';
import { isLikelyPdfUpload } from './payslip-pdf.util';

const userListSelect = {
  firstName: true,
  lastName: true,
  employeeId: true,
  department: true,
  profilePhotoKey: true,
  orgDepartment: {
    select: {
      name: true,
      direction: { select: { name: true } },
    },
  },
  orgService: { select: { name: true } },
} as const;

const payslipListInclude = {
  user: { select: userListSelect },
  signature: {
    select: { id: true, verificationCode: true, signedAt: true },
  },
} satisfies Prisma.PayslipInclude;

export type PayslipWithUserList = Prisma.PayslipGetPayload<{
  include: typeof payslipListInclude;
}>;

/** Utilisateur embarqué côté API (pas de clé S3, URL présignée pour l’avatar). */
export type PayslipUserListClient = Omit<
  PayslipWithUserList['user'],
  'profilePhotoKey'
> & { profilePhotoUrl: string | null };

export type PayslipWithUserListClient = Omit<PayslipWithUserList, 'user'> & {
  user: PayslipUserListClient;
};

export type PayslipDetailClient = PayslipWithUserListClient & {
  presignedUrl: string;
};

export type PaginatedPayslips = {
  data: PayslipWithUserListClient[];
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
  fileIndex?: number;
  /** Échec technique (stockage / persistance) — peut être rejoué depuis l’admin. */
  retryable?: boolean;
};

export type BulkUploadReport = {
  total: number;
  success: number;
  failed: number;
  details: BulkUploadDetail[];
};

export type BulkAnalyzeRow = {
  filename: string;
  fileIndex: number;
  extracted: {
    matricule?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    periodMonth?: number;
    periodYear?: number;
    confidence: number;
  };
  match: {
    userId?: string;
    employeeName?: string;
    employeeId?: string | null;
    periodMonth?: number;
    periodYear?: number;
    matchMethod: 'matricule' | 'name' | 'filename' | 'unmatched';
    confidence: number;
    lifecycleWarning?: string;
  };
  status: 'auto_matched' | 'needs_review' | 'unmatched';
  duplicate: boolean;
  duplicateReason?: 'database' | 'batch';
  /** Texte affiché à l’étape de vérification (doublon base + conflit lot). */
  duplicateMessage?: string;
  /** PDF illisible ou rejet technique côté analyse. */
  blockingError?: string;
};

function classifyBulkMatchStatus(
  match: PayslipMatchResult,
): 'auto_matched' | 'needs_review' | 'unmatched' {
  if (!match.userId) {
    return 'unmatched';
  }
  if (match.matchMethod === 'matricule') {
    return 'auto_matched';
  }
  return 'needs_review';
}

function payslipKey(userId: string, month: number, year: number): string {
  return `${userId}:${month}:${year}`;
}

/** Aligné sur la TTL des photos profil (GET /users). */
const PAYSLIP_USER_PROFILE_PHOTO_URL_TTL_SEC = 7 * 24 * 3600;

@Injectable()
export class PayslipsService {
  private readonly logger = new Logger(PayslipsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly pdfExtractor: PayslipPdfExtractorService,
    private readonly payslipMatcher: PayslipMatcherService,
    private readonly bulkTempStore: PayslipBulkTempStore,
  ) {}

  private async attachProfilePhotoUrlsToPayslips(
    payslips: PayslipWithUserList[],
  ): Promise<PayslipWithUserListClient[]> {
    const uniqueKeys = [
      ...new Set(
        payslips
          .map((p) => p.user.profilePhotoKey)
          .filter((k): k is string => k != null && k !== ''),
      ),
    ];
    const keyToUrl = new Map<string, string>();
    await Promise.all(
      uniqueKeys.map(async (key) => {
        const url = await this.storage.getPresignedUrl(
          key,
          PAYSLIP_USER_PROFILE_PHOTO_URL_TTL_SEC,
        );
        keyToUrl.set(key, url);
      }),
    );
    return payslips.map((p) => {
      const { profilePhotoKey, ...userWithoutKey } = p.user;
      const profilePhotoUrl =
        profilePhotoKey != null && profilePhotoKey !== ''
          ? (keyToUrl.get(profilePhotoKey) ?? null)
          : null;
      return {
        ...p,
        user: { ...userWithoutKey, profilePhotoUrl },
      };
    });
  }

  private async attachProfilePhotoUrlToPayslip(
    payslip: PayslipWithUserList,
  ): Promise<PayslipWithUserListClient> {
    const [out] = await this.attachProfilePhotoUrlsToPayslips([payslip]);
    return out!;
  }

  async uploadSingle(
    file: Express.Multer.File,
    userId: string,
    periodMonth: number,
    periodYear: number,
    adminUser: RequestUser,
  ): Promise<PayslipWithUserListClient> {
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
      throw new NotFoundException('Collaborateur introuvable');
    }

    if (target.role === 'EMPLOYEE') {
      if (!isUserOperational(target) || !target.isActive) {
        if (
          target.employmentStatus === 'DEPARTED' ||
          target.employmentStatus === 'ARCHIVED'
        ) {
          const d = target.departureDate
            ? target.departureDate.toLocaleDateString('fr-FR')
            : '—';
          throw new BadRequestException(
            `Ce collaborateur est sorti de l'entreprise depuis le ${d}. Le bulletin ne sera pas distribué.`,
          );
        }
        throw new BadRequestException(
          'Ce collaborateur ne peut pas recevoir de bulletin dans son état actuel.',
        );
      }
    }

    const existing = await this.prisma.payslip.findFirst({
      where: {
        userId,
        periodMonth,
        periodYear,
        companyId: adminUser.companyId!,
      },
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
      await this.storage.uploadFileWithRetry(
        file.buffer,
        key,
        'application/pdf',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Échec upload stockage S3 après reprises : ${msg}`,
      );
      throw new ServiceUnavailableException(
        PAYSLIP_BULK_USER_MESSAGES.STORAGE_FAILED,
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
        include: payslipListInclude,
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
      const prismaMsg =
        e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `Échec création bulletin en base après upload S3 (rollback S3 effectué) : ${prismaMsg}`,
      );
      throw new BadRequestException(
        PAYSLIP_BULK_USER_MESSAGES.PERSIST_FAILED,
      );
    }

    await this.prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        companyId: adminUser.companyId!,
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

    return this.attachProfilePhotoUrlToPayslip(created);
  }

  async analyzeBulk(
    files: Express.Multer.File[],
    adminUser: RequestUser,
  ): Promise<{ batchId: string; analyses: BulkAnalyzeRow[] }> {
    this.assertRhAdminWithCompany(adminUser);
    const list = files ?? [];
    const companyId = adminUser.companyId!;
    const stored: PayslipBulkStoredFile[] = [];
    const drafts: Omit<BulkAnalyzeRow, 'duplicate' | 'duplicateReason'>[] = [];

    for (let i = 0; i < list.length; i += 1) {
      const file = list[i]!;
      const filename = file.originalname || `fichier-${i}.pdf`;

      if (!isLikelyPdfUpload(file)) {
        drafts.push({
          filename,
          fileIndex: i,
          extracted: { confidence: 0 },
          match: {
            matchMethod: 'unmatched',
            confidence: 0,
          },
          status: 'unmatched',
          blockingError:
            'Format non supporté — seuls les fichiers PDF sont acceptés',
        });
        stored.push({
          fileIndex: i,
          buffer: file.buffer,
          originalname: filename,
          mimetype: file.mimetype || 'application/pdf',
          size: file.size,
        });
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        const mo = (file.size / (1024 * 1024)).toFixed(1);
        drafts.push({
          filename,
          fileIndex: i,
          extracted: { confidence: 0 },
          match: {
            matchMethod: 'unmatched',
            confidence: 0,
          },
          status: 'unmatched',
          blockingError: `Fichier trop volumineux (${mo} Mo) — maximum 10 Mo`,
        });
        stored.push({
          fileIndex: i,
          buffer: file.buffer,
          originalname: filename,
          mimetype: file.mimetype || 'application/pdf',
          size: file.size,
        });
        continue;
      }

      const extracted = await this.pdfExtractor.extractPayslipInfo(file.buffer);
      if (!extracted.pdfReadable) {
        drafts.push({
          filename,
          fileIndex: i,
          extracted: { confidence: 0 },
          match: {
            matchMethod: 'unmatched',
            confidence: 0,
          },
          status: 'unmatched',
          blockingError:
            'Le fichier PDF est illisible ou endommagé',
        });
        stored.push({
          fileIndex: i,
          buffer: file.buffer,
          originalname: filename,
          mimetype: file.mimetype || 'application/pdf',
          size: file.size,
        });
        continue;
      }

      const match = await this.payslipMatcher.matchPayslipToEmployee(
        extracted,
        filename,
        companyId,
      );
      const status = classifyBulkMatchStatus(match);

      drafts.push({
        filename,
        fileIndex: i,
        extracted: {
          matricule: extracted.matricule,
          firstName: extracted.firstName,
          lastName: extracted.lastName,
          fullName: extracted.fullName,
          periodMonth: extracted.periodMonth,
          periodYear: extracted.periodYear,
          confidence: extracted.confidence,
        },
        match: {
          userId: match.userId,
          employeeName: match.employeeName,
          employeeId: match.employeeId,
          periodMonth: match.periodMonth,
          periodYear: match.periodYear,
          matchMethod: match.matchMethod,
          confidence: match.confidence,
          lifecycleWarning: match.lifecycleWarning,
        },
        status,
      });
      stored.push({
        fileIndex: i,
        buffer: file.buffer,
        originalname: filename,
        mimetype: file.mimetype || 'application/pdf',
        size: file.size,
      });
    }

    const analyses = await this.applyDuplicateFlags(drafts, companyId);
    const batchId = this.bulkTempStore.createSession(
      companyId,
      adminUser.id,
      stored,
    );
    return { batchId, analyses };
  }

  async confirmBulk(
    dto: {
      batchId: string;
      assignments: Array<{
        fileIndex: number;
        userId: string;
        periodMonth: number;
        periodYear: number;
      }>;
    },
    adminUser: RequestUser,
  ): Promise<BulkUploadReport> {
    this.assertRhAdminWithCompany(adminUser);
    const session = this.bulkTempStore.getSession(dto.batchId);
    if (!session) {
      throw new BadRequestException(
        'Lot expiré ou introuvable. Relancez l’analyse des fichiers.',
      );
    }
    if (session.companyId !== adminUser.companyId) {
      throw new ForbiddenException();
    }

    const byIndex = new Map(session.files.map((f) => [f.fileIndex, f]));
    const details: BulkUploadDetail[] = [];
    let success = 0;
    let failed = 0;

    try {
      for (const a of dto.assignments) {
        const stored = byIndex.get(a.fileIndex);
        const filename = stored?.originalname ?? `#${String(a.fileIndex)}`;

        if (!stored) {
          failed += 1;
          details.push({
            filename,
            matricule: '—',
            status: 'ERROR',
            reason: 'Fichier absent du lot (index invalide)',
            fileIndex: a.fileIndex,
            retryable: false,
          });
          continue;
        }

        const file = this.storedFileToMulter(stored);
        if (!isLikelyPdfUpload(file)) {
          failed += 1;
          details.push({
            filename,
            matricule: '—',
            status: 'ERROR',
            reason: 'Seuls les fichiers PDF sont acceptés',
            fileIndex: a.fileIndex,
            retryable: false,
          });
          continue;
        }

        const target = await this.prisma.user.findFirst({
          where: { id: a.userId, companyId: adminUser.companyId! },
          select: { employeeId: true },
        });
        if (!target) {
          failed += 1;
          details.push({
            filename,
            matricule: '—',
            status: 'ERROR',
            reason: 'Collaborateur introuvable dans votre entreprise',
            fileIndex: a.fileIndex,
            retryable: false,
          });
          continue;
        }

        try {
          await this.uploadSingle(
            file,
            a.userId,
            a.periodMonth,
            a.periodYear,
            adminUser,
          );
          success += 1;
          details.push({
            filename,
            matricule: target.employeeId?.trim() || '—',
            status: 'OK',
            fileIndex: a.fileIndex,
          });
        } catch (e) {
          failed += 1;
          const mat = target.employeeId?.trim() || '—';
          let reason: string;
          let retryable = false;
          if (e instanceof ServiceUnavailableException) {
            reason = PAYSLIP_BULK_USER_MESSAGES.STORAGE_FAILED;
            retryable = true;
          } else if (
            e instanceof BadRequestException &&
            e.message === PAYSLIP_BULK_USER_MESSAGES.PERSIST_FAILED
          ) {
            reason = PAYSLIP_BULK_USER_MESSAGES.PERSIST_FAILED;
            retryable = true;
          } else if (e instanceof ConflictException) {
            reason = e.message;
          } else if (e instanceof ForbiddenException) {
            reason = 'Accès refusé';
          } else if (e instanceof BadRequestException) {
            reason = e.message;
          } else if (e instanceof Error) {
            reason = e.message;
          } else {
            reason = 'Erreur inconnue';
          }
          details.push({
            filename,
            matricule: mat,
            status: 'ERROR',
            reason,
            fileIndex: a.fileIndex,
            retryable,
          });
        }
      }
    } finally {
      this.bulkTempStore.deleteSession(dto.batchId);
    }

    return {
      total: dto.assignments.length,
      success,
      failed,
      details,
    };
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
      where.user = { companyId: actor.companyId };
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
        include: payslipListInclude,
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const dataWithPhotos = await this.attachProfilePhotoUrlsToPayslips(data);
    return {
      data: dataWithPhotos,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async findOne(id: string, actor: RequestUser): Promise<PayslipDetailClient> {
    const scopedWhere: Prisma.PayslipWhereInput = { id };
    if (actor.role === 'RH_ADMIN') {
      if (!actor.companyId) {
        throw new ForbiddenException('Compte sans entreprise associée');
      }
      scopedWhere.companyId = actor.companyId;
    } else if (actor.role === 'EMPLOYEE') {
      scopedWhere.userId = actor.id;
    } else {
      throw new ForbiddenException();
    }

    const payslip = await this.prisma.payslip.findFirst({
      where: scopedWhere,
      include: payslipListInclude,
    });
    if (!payslip) {
      throw new NotFoundException('Bulletin introuvable');
    }
    const presignedUrl = await this.storage.getPresignedUrl(payslip.fileUrl);
    const mapped = await this.attachProfilePhotoUrlToPayslip(payslip);
    return { ...mapped, presignedUrl };
  }

  async getDownloadUrl(id: string, actor: RequestUser): Promise<string> {
    const { presignedUrl } = await this.findOne(id, actor);
    return presignedUrl;
  }

  async markAsRead(
    id: string,
    actor: RequestUser,
    client?: { ipAddress: string | null; userAgent: string | null },
  ): Promise<PayslipWithUserListClient> {
    const scopedWhere: Prisma.PayslipWhereInput = { id };
    if (actor.role === 'EMPLOYEE') {
      scopedWhere.userId = actor.id;
    } else if (actor.role === 'RH_ADMIN') {
      if (!actor.companyId) {
        throw new ForbiddenException('Compte sans entreprise associée');
      }
      scopedWhere.companyId = actor.companyId;
    } else {
      throw new ForbiddenException();
    }

    const payslip = await this.prisma.payslip.findFirst({
      where: scopedWhere,
      include: payslipListInclude,
    });
    if (!payslip) {
      throw new NotFoundException('Bulletin introuvable');
    }

    const wasUnread = !payslip.isRead;
    const readAt = new Date();

    const updated = await this.prisma.payslip.update({
      where: { id },
      data: { isRead: true, readAt },
      include: payslipListInclude,
    });

    if (wasUnread && actor.role === 'EMPLOYEE') {
      await this.prisma.auditLog.create({
        data: {
          userId: actor.id,
          companyId: payslip.companyId,
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

    return this.attachProfilePhotoUrlToPayslip(updated);
  }

  async remove(id: string, actor: RequestUser): Promise<void> {
    this.assertRhAdminWithCompany(actor);

    const payslip = await this.prisma.payslip.findFirst({
      where: { id, companyId: actor.companyId! },
    });
    if (!payslip) {
      throw new NotFoundException('Bulletin introuvable');
    }

    await this.storage.deleteFile(payslip.fileUrl);
    await this.prisma.payslip.delete({ where: { id } });

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        companyId: actor.companyId!,
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

  private async applyDuplicateFlags(
    drafts: Array<
      Omit<BulkAnalyzeRow, 'duplicate' | 'duplicateReason' | 'duplicateMessage'>
    >,
    companyId: string,
  ): Promise<BulkAnalyzeRow[]> {
    const keyToSortedRows = new Map<
      string,
      Array<{ fileIndex: number; filename: string }>
    >();

    const completeTriples: Array<{
      userId: string;
      periodMonth: number;
      periodYear: number;
      k: string;
      filename: string;
      fileIndex: number;
    }> = [];

    for (const r of drafts) {
      if (r.blockingError) {
        continue;
      }
      const uid = r.match.userId;
      const pm = r.match.periodMonth;
      const py = r.match.periodYear;
      if (uid == null || pm == null || py == null) {
        continue;
      }
      const k = payslipKey(uid, pm, py);
      completeTriples.push({
        userId: uid,
        periodMonth: pm,
        periodYear: py,
        k,
        filename: r.filename,
        fileIndex: r.fileIndex,
      });
      const list = keyToSortedRows.get(k) ?? [];
      list.push({ fileIndex: r.fileIndex, filename: r.filename });
      keyToSortedRows.set(k, list);
    }

    for (const rows of keyToSortedRows.values()) {
      rows.sort((a, b) => a.fileIndex - b.fileIndex);
    }

    const batchKeyCounts = new Map<string, number>();
    for (const t of completeTriples) {
      batchKeyCounts.set(t.k, (batchKeyCounts.get(t.k) ?? 0) + 1);
    }

    const dbKeys = new Set<string>();
    if (completeTriples.length > 0) {
      const dedup = new Map<
        string,
        { userId: string; periodMonth: number; periodYear: number }
      >();
      for (const t of completeTriples) {
        dedup.set(t.k, {
          userId: t.userId,
          periodMonth: t.periodMonth,
          periodYear: t.periodYear,
        });
      }
      const unique = [...dedup.values()];
      const existing = await this.prisma.payslip.findMany({
        where: {
          companyId,
          OR: unique.map((t) => ({
            userId: t.userId,
            periodMonth: t.periodMonth,
            periodYear: t.periodYear,
          })),
        },
        select: { userId: true, periodMonth: true, periodYear: true },
      });
      for (const p of existing) {
        dbKeys.add(payslipKey(p.userId, p.periodMonth, p.periodYear));
      }
    }

    return drafts.map((r) => {
      if (r.blockingError) {
        return { ...r, duplicate: false };
      }

      const uid = r.match.userId;
      const pm = r.match.periodMonth;
      const py = r.match.periodYear;
      if (uid == null || pm == null || py == null) {
        return { ...r, duplicate: false };
      }

      const k = payslipKey(uid, pm, py);
      const batchDup = (batchKeyCounts.get(k) ?? 0) > 1;
      const dbDup = dbKeys.has(k);
      const duplicate = batchDup || dbDup;
      let duplicateReason: 'database' | 'batch' | undefined;
      if (duplicate) {
        duplicateReason = batchDup ? 'batch' : 'database';
      }

      const msgs: string[] = [];
      if (dbDup) {
        msgs.push(
          `Doublon — un bulletin de ${frenchMonthName(pm)} ${py} existe déjà pour ce collaborateur.`,
        );
      }
      if (batchDup) {
        const sorted = [...(keyToSortedRows.get(k) ?? [])].sort(
          (a, b) => a.fileIndex - b.fileIndex,
        );
        const first = sorted[0];
        if (sorted.length > 1 && first) {
          if (r.fileIndex === first.fileIndex) {
            const second = sorted[1]!;
            msgs.push(
              `Conflit — un autre fichier du lot (« ${second.filename} ») cible le même collaborateur et la même période.`,
            );
          } else {
            msgs.push(
              `Conflit — le fichier « ${r.filename} » cible le même collaborateur et la même période (doublon avec « ${first.filename} » dans ce lot).`,
            );
          }
        }
      }

      const duplicateMessage =
        msgs.length > 0 ? msgs.join(' ') : undefined;

      return {
        ...r,
        duplicate,
        duplicateReason,
        duplicateMessage,
      };
    });
  }

  private storedFileToMulter(
    stored: PayslipBulkStoredFile,
  ): Express.Multer.File {
    return {
      fieldname: 'files',
      originalname: stored.originalname,
      encoding: '7bit',
      mimetype: stored.mimetype,
      buffer: stored.buffer,
      size: stored.size,
      destination: '',
      filename: '',
      path: '',
      stream: undefined as never,
    };
  }

  private assertRhAdminWithCompany(actor: RequestUser): void {
    if (actor.role !== 'RH_ADMIN') {
      throw new ForbiddenException();
    }
    if (!actor.companyId) {
      throw new ForbiddenException('Compte sans entreprise associée');
    }
  }

}

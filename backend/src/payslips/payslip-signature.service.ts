import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  PAYSLIP_AUDIT,
  PAYSLIP_SIGNATURE_AUDIT,
} from './payslips.constants';

export type SignPayslipMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: string | null;
};

@Injectable()
export class PayslipSignatureService {
  private readonly logger = new Logger(PayslipSignatureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async signPayslip(
    payslipId: string,
    userId: string,
    metadata: SignPayslipMetadata,
  ) {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, userId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true,
            companyId: true,
          },
        },
      },
    });

    if (!payslip) {
      throw new NotFoundException('Bulletin non trouvé');
    }

    if (payslip.isSigned) {
      throw new BadRequestException('Ce bulletin a déjà été signé');
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await this.storage.getFileBuffer(payslip.fileUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Lecture S3 bulletin ${payslipId} : ${msg}`);
      throw new ServiceUnavailableException(
        'Impossible de lire le fichier bulletin pour établir la preuve',
      );
    }

    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
    const now = new Date();
    const fullName = `${payslip.user.firstName} ${payslip.user.lastName}`.trim();

    const signature = await this.prisma.$transaction(async (tx) => {
      const verificationCode = await this.generateUniqueVerificationCode(tx);

      const sig = await tx.payslipSignature.create({
        data: {
          payslipId,
          userId,
          employeeId: payslip.user.employeeId?.trim() || null,
          fullName,
          fileHash,
          signedAt: now,
          ipAddress: metadata.ipAddress ?? null,
          userAgent: metadata.userAgent ?? null,
          deviceInfo: metadata.deviceInfo ?? null,
          verificationCode,
          companyId: payslip.companyId,
          periodMonth: payslip.periodMonth,
          periodYear: payslip.periodYear,
        },
      });

      await tx.payslip.update({
        where: { id: payslipId },
        data: {
          isSigned: true,
          signedAt: now,
          isRead: true,
          readAt: payslip.readAt ?? now,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          companyId: payslip.companyId,
          action: PAYSLIP_AUDIT.SIGNED,
          entityType: 'Payslip',
          entityId: payslipId,
          ipAddress: metadata.ipAddress ?? undefined,
          userAgent: metadata.userAgent ?? undefined,
          metadata: {
            periodMonth: payslip.periodMonth,
            periodYear: payslip.periodYear,
            fileHash,
            verificationCode,
          } as Prisma.InputJsonValue,
        },
      });

      return sig;
    });

    return signature;
  }

  async verifySignature(verificationCode: string): Promise<{
    valid: boolean;
    details?: {
      employeeName: string;
      employeeId: string;
      companyName: string;
      period: string;
      signedAt: Date;
      fileHash: string;
    };
  }> {
    const code = verificationCode.trim().toUpperCase();
    const signature = await this.prisma.payslipSignature.findUnique({
      where: { verificationCode: code },
      include: {
        company: { select: { name: true } },
      },
    });

    if (!signature) {
      return { valid: false };
    }

    return {
      valid: true,
      details: {
        employeeName: signature.fullName,
        employeeId: signature.employeeId ?? '',
        companyName: signature.company.name,
        period: `${String(signature.periodMonth).padStart(2, '0')}/${signature.periodYear}`,
        signedAt: signature.signedAt,
        fileHash: signature.fileHash,
      },
    };
  }

  async getSignatureStats(
    companyId: string,
    periodMonth: number,
    periodYear: number,
  ) {
    const [total, signed, recentSignatures] = await Promise.all([
      this.prisma.payslip.count({
        where: {
          companyId,
          periodMonth,
          periodYear,
        },
      }),
      this.prisma.payslip.count({
        where: {
          companyId,
          periodMonth,
          periodYear,
          isSigned: true,
        },
      }),
      this.prisma.payslipSignature.findMany({
        where: { companyId, periodMonth, periodYear },
        orderBy: { signedAt: 'desc' },
        take: 10,
        include: {
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

    const unsigned = total - signed;
    return {
      total,
      signed,
      unsigned,
      signatureRate: total > 0 ? Math.round((signed / total) * 100) : 0,
      recentSignatures,
    };
  }

  getUnsignedPayslips(
    companyId: string,
    periodMonth: number,
    periodYear: number,
  ) {
    return this.prisma.payslip.findMany({
      where: {
        companyId,
        periodMonth,
        periodYear,
        isSigned: false,
        user: {
          companyId,
          employmentStatus: { in: ['ACTIVE', 'ON_NOTICE'] },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            orgDepartment: { select: { name: true } },
          },
        },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });
  }

  async generateSignatureCertificate(
    signatureId: string,
    companyId: string,
  ): Promise<Buffer> {
    const signature = await this.prisma.payslipSignature.findFirst({
      where: { id: signatureId, companyId },
      include: {
        company: { select: { name: true, rccm: true } },
        payslip: { select: { periodMonth: true, periodYear: true } },
      },
    });

    if (!signature) {
      throw new NotFoundException('Signature non trouvée');
    }

    const doc = new PDFDocument({ size: 'A4', margin: 60 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(20).fillColor('#0F5C5E').text('Certificat de réception', {
      align: 'center',
    });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .fillColor('#7F8C8D')
      .text('PaySlip Manager — Preuve de remise de bulletin de paie', {
        align: 'center',
      });
    doc.moveDown(2);

    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#E8E8E8').stroke();
    doc.moveDown(1);

    doc.fontSize(11).fillColor('#1C2833');

    const rows: [string, string][] = [
      ['Collaborateur', signature.fullName],
      ['Matricule', signature.employeeId ?? 'N/A'],
      ['Entreprise', signature.company.name],
      ['RCCM', signature.company.rccm ?? 'N/A'],
      [
        'Période',
        `${String(signature.periodMonth).padStart(2, '0')}/${signature.periodYear}`,
      ],
      [
        'Date de signature',
        signature.signedAt.toLocaleString('fr-FR', {
          timeZone: 'Africa/Abidjan',
        }),
      ],
      ['Empreinte du document (SHA-256)', signature.fileHash],
      ['Code de vérification', signature.verificationCode],
      ['Adresse IP', signature.ipAddress ?? 'N/A'],
      [
        'Appareil',
        signature.deviceInfo ?? signature.userAgent ?? 'N/A',
      ],
    ];

    for (const [label, value] of rows) {
      doc.font('Helvetica-Bold').text(`${label} : `, { continued: true });
      doc.font('Helvetica').text(value);
      doc.moveDown(0.35);
    }

    doc.moveDown(1.5);
    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#E8E8E8').stroke();
    doc.moveDown(1);

    doc
      .fontSize(9)
      .fillColor('#BDC3C7')
      .text(
        "Ce document atteste que le collaborateur mentionné ci-dessus a accusé réception de son bulletin de paie via la plateforme PaySlip Manager. L'empreinte SHA-256 garantit l'intégrité du document signé. Pour vérifier cette signature, utilisez la page publique « Vérifier un accusé de réception » et entrez le code de vérification.",
        { align: 'justify', lineGap: 3 },
      );

    doc.moveDown(2);
    doc
      .fontSize(8)
      .fillColor('#D5D8DC')
      .text(
        `Généré le ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan' })} — PaySlip Manager`,
        { align: 'center' },
      );

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }

  async remindUnsigned(
    companyId: string,
    dto: {
      month: number;
      year: number;
      message?: string;
      userIds?: string[];
    },
    adminUserId: string,
  ): Promise<{ reminded: number }> {
    let unsigned = await this.getUnsignedPayslips(
      companyId,
      dto.month,
      dto.year,
    );
    if (dto.userIds?.length) {
      const allowed = new Set(dto.userIds);
      unsigned = unsigned.filter((p) => allowed.has(p.userId));
    }

    if (unsigned.length === 0) {
      return { reminded: 0 };
    }

    const defaultMsg = `Votre bulletin de ${String(dto.month).padStart(2, '0')}/${dto.year} est en attente de votre accusé de réception.`;
    const text = dto.message?.trim() || defaultMsg;

    await this.prisma.notification.createMany({
      data: unsigned.map((p) => ({
        userId: p.userId,
        title: 'Bulletin en attente de signature',
        message: text,
        type: 'SIGNATURE_REMINDER',
      })),
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        companyId,
        action: PAYSLIP_SIGNATURE_AUDIT.REMINDER_SENT,
        entityType: 'PAYSLIP',
        entityId: companyId,
        metadata: {
          month: dto.month,
          year: dto.year,
          count: unsigned.length,
        } as Prisma.InputJsonValue,
      },
    });

    return { reminded: unsigned.length };
  }

  async exportComplianceCsv(
    companyId: string,
    periodMonth: number,
    periodYear: number,
  ): Promise<string> {
    const rows = await this.prisma.payslip.findMany({
      where: { companyId, periodMonth, periodYear },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
            orgDepartment: { select: { name: true } },
          },
        },
        signature: {
          select: {
            verificationCode: true,
            signedAt: true,
            fileHash: true,
          },
        },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });

    const sep = ';';
    const header = [
      'Collaborateur',
      'Matricule',
      'Département',
      'Période',
      'Signé',
      'Date signature',
      'Code vérification',
      'Empreinte SHA-256',
    ].join(sep);

    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

    const lines = rows.map((p) => {
      const name = `${p.user.lastName} ${p.user.firstName}`.trim();
      const dept =
        p.user.orgDepartment?.name?.trim() || p.user.department || '—';
      const period = `${String(p.periodMonth).padStart(2, '0')}/${p.periodYear}`;
      const signed = p.isSigned ? 'Oui' : 'Non';
      const signedAt = p.signature?.signedAt
        ? p.signature.signedAt.toISOString()
        : '';
      const code = p.signature?.verificationCode ?? '';
      const hash = p.signature?.fileHash ?? '';
      return [
        esc(name),
        esc(p.user.employeeId?.trim() || '—'),
        esc(dept),
        esc(period),
        esc(signed),
        esc(signedAt),
        esc(code),
        esc(hash),
      ].join(sep);
    });

    return [header, ...lines].join('\n');
  }

  private async generateUniqueVerificationCode(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const code = randomBytes(6).toString('hex').toUpperCase();
      const clash = await tx.payslipSignature.findUnique({
        where: { verificationCode: code },
        select: { id: true },
      });
      if (!clash) {
        return code;
      }
    }
    throw new ServiceUnavailableException(
      'Impossible de générer un code de vérification unique',
    );
  }
}

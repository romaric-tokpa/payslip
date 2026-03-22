import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseBulkFilename } from './payslip-bulk-filename.util';
import type { ExtractedPayslipInfo } from './payslip-pdf-extractor.types';
import type {
  PayslipMatchEmployeeRow,
  PayslipMatchResult,
} from './payslip-matcher.types';

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) {
    return n;
  }
  if (n === 0) {
    return m;
  }
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j += 1) {
    row[j] = j;
  }
  for (let i = 1; i <= m; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n];
}

function normalizeComparable(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function displayName(u: PayslipMatchEmployeeRow): string {
  return `${u.firstName} ${u.lastName}`.trim();
}

@Injectable()
export class PayslipMatcherService {
  constructor(private readonly prisma: PrismaService) {}

  async matchPayslipToEmployee(
    extracted: ExtractedPayslipInfo,
    filename: string,
    companyId: string,
  ): Promise<PayslipMatchResult> {
    const employees = await this.prisma.user.findMany({
      where: { companyId, role: UserRole.EMPLOYEE },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
      },
    });

    const periodFromExtract =
      extracted.periodMonth != null && extracted.periodYear != null
        ? { month: extracted.periodMonth, year: extracted.periodYear }
        : undefined;

    const parsedFile = parseBulkFilename(filename);
    const periodFromFile =
      parsedFile &&
      parsedFile.month >= 1 &&
      parsedFile.month <= 12 &&
      parsedFile.year >= 2020
        ? { month: parsedFile.month, year: parsedFile.year }
        : undefined;

    const periodMonth = periodFromExtract?.month ?? periodFromFile?.month;
    const periodYear = periodFromExtract?.year ?? periodFromFile?.year;

    const hadMatriculeInPdf = Boolean(extracted.matricule?.trim());
    let matriculeMatchedDb = false;
    if (extracted.matricule) {
      const mat = extracted.matricule.trim();
      const hit = employees.find(
        (u) =>
          u.employeeId != null &&
          u.employeeId.trim().toLowerCase() === mat.toLowerCase(),
      );
      if (hit) {
        matriculeMatchedDb = true;
        return {
          userId: hit.id,
          employeeName: displayName(hit),
          employeeId: hit.employeeId,
          periodMonth,
          periodYear,
          matchMethod: 'matricule',
          confidence: Math.min(100, extracted.confidence + 25),
        };
      }
    }

    const fullFromExtract =
      extracted.fullName?.trim() ||
      [extracted.firstName, extracted.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
    if (fullFromExtract.length > 0) {
      const normTarget = normalizeComparable(fullFromExtract);
      let best: { u: PayslipMatchEmployeeRow; d: number } | null = null;
      for (const u of employees) {
        const variants = [
          normalizeComparable(`${u.firstName} ${u.lastName}`),
          normalizeComparable(`${u.lastName} ${u.firstName}`),
        ];
        for (const v of variants) {
          if (!v) {
            continue;
          }
          const d = levenshtein(normTarget, v);
          if (d <= 2 && (best == null || d < best.d)) {
            best = { u, d };
          }
        }
      }
      if (best) {
        const penalty = best.d * 8;
        return {
          userId: best.u.id,
          employeeName: displayName(best.u),
          employeeId: best.u.employeeId,
          periodMonth,
          periodYear,
          matchMethod: 'name',
          confidence: Math.min(
            100,
            Math.max(0, extracted.confidence + 20 - penalty),
          ),
          ambiguousMatricule: hadMatriculeInPdf && !matriculeMatchedDb,
        };
      }
    }

    if (parsedFile) {
      const { matricule, month, year } = parsedFile;
      if (month >= 1 && month <= 12 && year >= 2020) {
        const hit = employees.find(
          (u) =>
            u.employeeId != null &&
            u.employeeId.trim().toLowerCase() === matricule.toLowerCase(),
        );
        if (hit) {
          return {
            userId: hit.id,
            employeeName: displayName(hit),
            employeeId: hit.employeeId,
            periodMonth: month,
            periodYear: year,
            matchMethod: 'filename',
            confidence: Math.min(100, extracted.confidence + 10),
          };
        }
      }
    }

    return {
      periodMonth,
      periodYear,
      matchMethod: 'unmatched',
      confidence: extracted.confidence,
    };
  }
}

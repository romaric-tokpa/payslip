import { Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import type { ExtractedPayslipInfo } from './payslip-pdf-extractor.types';

const MATRICULE_RES: RegExp[] = [
  /matricule\s*[:-]?\s*([A-Z0-9-]+)/i,
  /n[°o]\s+employ[ée]\s*[:-]?\s*([A-Z0-9-]+)/i,
  /code\s+employ[ée]\s*[:-]?\s*([A-Z0-9-]+)/i,
];

const PERIOD_RES: RegExp[] = [
  /(?:bulletin|fiche)\s*(?:de\s*)?(?:paie|salaire)\s*(?:du\s+mois\s+(?:de\s*)?)?(\w+)\s+(\d{4})/i,
  /p[ée]riode\s*[:-]?\s*(\w+)\s+(\d{4})/i,
  /mois\s*[:-]?\s*(\w+)\s+(\d{4})/i,
];

const NAME_RES: RegExp[] = [
  /nom\s*(?:et\s+pr[ée]nom)?s?\s*[:-]?\s*([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)+)/i,
  /employ[ée]\s*[:-]?\s*([A-ZÀ-Ü][\w\sà-üÀ-Ü'-]+)/i,
];

const MONTH_FR: Readonly<Record<string, number>> = {
  janvier: 1,
  février: 2,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  août: 8,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  décembre: 12,
  decembre: 12,
};

function parseMonthToken(raw: string): number | undefined {
  const t = raw.trim().toLowerCase();
  if (/^\d{1,2}$/u.test(t)) {
    const n = Number.parseInt(t, 10);
    if (n >= 1 && n <= 12) {
      return n;
    }
    return undefined;
  }
  return MONTH_FR[t];
}

function splitFullName(full: string): {
  firstName?: string;
  lastName?: string;
} {
  const parts = full
    .trim()
    .split(/\s+/u)
    .filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }
  if (parts.length === 1) {
    return { lastName: parts[0] };
  }
  return {};
}

@Injectable()
export class PayslipPdfExtractorService {
  private readonly logger = new Logger(PayslipPdfExtractorService.name);

  async extractPayslipInfo(buffer: Buffer): Promise<ExtractedPayslipInfo> {
    let text = '';
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText({ first: 3 });
      text = result.text ?? '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`PDF text extraction failed: ${msg}`);
      return { confidence: 0, pdfReadable: false };
    } finally {
      await parser.destroy().catch(() => undefined);
    }

    const normalized = text.replace(/\r\n?/g, '\n');
    let confidence = 0;

    let matricule: string | undefined;
    for (const re of MATRICULE_RES) {
      const m = normalized.match(re);
      if (m?.[1]) {
        matricule = m[1].trim();
        break;
      }
    }
    if (matricule) {
      confidence += 40;
    }

    let periodMonth: number | undefined;
    let periodYear: number | undefined;
    for (const re of PERIOD_RES) {
      const m = normalized.match(re);
      if (m?.[1] && m[2]) {
        const mo = parseMonthToken(m[1]);
        const yr = Number.parseInt(m[2], 10);
        if (mo != null && yr >= 1990 && yr <= 2100) {
          periodMonth = mo;
          periodYear = yr;
          break;
        }
      }
    }
    if (periodMonth != null && periodYear != null) {
      confidence += 30;
    }

    let fullName: string | undefined;
    for (const re of NAME_RES) {
      const m = normalized.match(re);
      if (m?.[1]) {
        const raw = m[1].replace(/\s+/gu, ' ').trim();
        if (raw.length >= 2 && raw.length <= 120) {
          fullName = raw;
          break;
        }
      }
    }
    let firstName: string | undefined;
    let lastName: string | undefined;
    if (fullName) {
      confidence += 30;
      const sp = splitFullName(fullName);
      firstName = sp.firstName;
      lastName = sp.lastName ?? sp.firstName;
    }

    return {
      matricule,
      firstName,
      lastName,
      fullName,
      periodMonth,
      periodYear,
      confidence: Math.min(100, confidence),
      pdfReadable: true,
    };
  }
}

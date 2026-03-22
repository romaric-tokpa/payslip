import { ContractType } from '@prisma/client';

export type FlexibleDateParse =
  | { ok: true; date: Date }
  | { ok: false; empty: true }
  | { ok: false; empty: false };

/**
 * Parse une date fichier : ISO, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, ou Date JS tolérante.
 */
export function parseFlexibleImportDate(raw?: string): FlexibleDateParse {
  const t = raw?.trim() ?? '';
  if (!t) {
    return { ok: false, empty: true };
  }
  const iso = /^\d{4}-\d{2}-\d{2}/.test(t);
  if (iso) {
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) {
      return { ok: true, date: d };
    }
  }
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const dd = Number.parseInt(m[1], 10);
    const mm = Number.parseInt(m[2], 10) - 1;
    const yy = Number.parseInt(m[3], 10);
    const d = new Date(yy, mm, dd);
    if (
      d.getFullYear() === yy &&
      d.getMonth() === mm &&
      d.getDate() === dd
    ) {
      return { ok: true, date: d };
    }
  }
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    return { ok: true, date: d };
  }
  return { ok: false, empty: false };
}

/**
 * Interprète une valeur fichier (libellé ou code) vers l’enum Prisma.
 */
export function parseImportContractType(
  raw?: string,
): ContractType | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  const v = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

  const has = (keys: string[]) => keys.some((k) => v.includes(k));

  if (has(['cdi', 'indetermine', 'permanent', 'titulaire'])) {
    return 'CDI';
  }
  if (
    has([
      'cdd',
      'determine',
      'duree determine',
      'fixed',
      'temporaire',
      'precaire',
    ])
  ) {
    return 'CDD';
  }
  if (has(['interim', 'interimaire', 'mission', 'temp', 'vacataire'])) {
    return 'INTERIM';
  }
  if (has(['stage', 'stagiaire', 'intern', 'apprenti', 'alternance'])) {
    return 'STAGE';
  }

  const n = v.replace(/\s+/g, '');
  if (n === 'cdi') return 'CDI';
  if (n === 'cdd') return 'CDD';
  if (n === 'interim') return 'INTERIM';
  if (n === 'stage') return 'STAGE';

  return undefined;
}

export function parseImportContractEndDateIso(raw?: string): string | null {
  const p = parseFlexibleImportDate(raw);
  return p.ok ? p.date.toISOString() : null;
}

export function parseImportEntryDateIso(raw?: string): string | null {
  const p = parseFlexibleImportDate(raw);
  return p.ok ? p.date.toISOString() : null;
}

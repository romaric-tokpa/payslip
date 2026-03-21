import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

export function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export type NormalizedImportRow = Record<string, string>;

function cellToString(v: unknown): string {
  if (v === null || v === undefined) {
    return '';
  }
  if (
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean'
  ) {
    return String(v).trim();
  }
  return '';
}

export function parseCsvBuffer(buffer: Buffer): NormalizedImportRow[] {
  const text = stripBom(buffer.toString('utf8'));
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => normalizeHeader(h),
  });
  if (result.errors.length > 0 && !result.data?.length) {
    throw new Error(result.errors.map((e) => e.message).join('; '));
  }
  return (result.data ?? []).map((row) => stringifyRowValues(row));
}

export function parseXlsxBuffer(buffer: Buffer): NormalizedImportRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return [];
  }
  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });
  return raw.map((row) => {
    const out: NormalizedImportRow = {};
    for (const [k, v] of Object.entries(row)) {
      out[normalizeHeader(k)] = cellToString(v);
    }
    return out;
  });
}

function stringifyRowValues(row: Record<string, string>): NormalizedImportRow {
  const out: NormalizedImportRow = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = String(v ?? '').trim();
  }
  return out;
}

function stripBom(s: string): string {
  if (s.charCodeAt(0) === 0xfeff) {
    return s.slice(1);
  }
  return s;
}

export function extractImportFields(row: NormalizedImportRow): {
  matricule: string;
  prenom: string;
  nom: string;
  email: string;
  departement: string;
  poste: string;
} {
  return {
    matricule: row['matricule'] ?? '',
    prenom: row['prenom'] ?? '',
    nom: row['nom'] ?? '',
    email: (row['email'] ?? '').toLowerCase(),
    departement: row['departement'] ?? '',
    poste: row['poste'] ?? '',
  };
}

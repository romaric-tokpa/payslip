import { BadRequestException } from '@nestjs/common';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Choisit le parseur selon l’extension (prioritaire) puis le MIME — évite de traiter un CSV
 * comme Excel lorsque le système annonce un type trompeur (ex. .csv + application/vnd.ms-excel).
 */
export function resolveImportParser(
  file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>,
): 'csv' | 'xlsx' {
  const n = file.originalname.trim().toLowerCase();
  if (n.endsWith('.csv')) {
    return 'csv';
  }
  if (n.endsWith('.xlsx') || n.endsWith('.xls')) {
    return 'xlsx';
  }
  const mt = file.mimetype;
  if (mt === 'text/csv' || mt === 'text/plain' || mt === 'application/csv') {
    return 'csv';
  }
  if (
    mt ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mt === 'application/vnd.ms-excel'
  ) {
    return 'xlsx';
  }
  if (mt === 'application/octet-stream') {
    throw new BadRequestException(
      'Extension de fichier absente ou inconnue : utilisez .csv, .xlsx ou .xls dans le nom du fichier.',
    );
  }
  throw new BadRequestException(
    'Format non reconnu : utilisez un fichier .csv, .xlsx ou .xls.',
  );
}

export function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export type NormalizedImportRow = Record<string, string>;

/** Libellés explicites → clé canonique (après normalizeHeader sur la clé). */
const IMPORT_KEY_ALIASES: Record<string, string> = {
  matricule: 'matricule',
  /** Faute de frappe fréquente (i / r). */
  maricule: 'matricule',
  matricul: 'matricule',
  matriculee: 'matricule',
  'e-mail': 'email',
  email: 'email',
  courriel: 'email',
  mail: 'email',
  mel: 'email',
  'adresse email': 'email',
  'adresse mail': 'email',
  prenom: 'prenom',
  'first name': 'prenom',
  firstname: 'prenom',
  prnom: 'prenom',
  nom: 'nom',
  'last name': 'nom',
  lastname: 'nom',
  'nom de famille': 'nom',
  surname: 'nom',
  'id employe': 'matricule',
  'id employé': 'matricule',
  'employee id': 'matricule',
  employeeid: 'matricule',
  'n° matricule': 'matricule',
  'no matricule': 'matricule',
  'code employe': 'matricule',
  'code employé': 'matricule',
  mat: 'matricule',
  department: 'departement',
  departement: 'departement',
  dept: 'departement',
  fonction: 'poste',
  emploi: 'poste',
  intitule: 'poste',
  titre: 'poste',
  job: 'poste',
  role: 'poste',
  direction: 'departement',
  pole: 'departement',
  /** Service organisationnel (distinct du département). */
  service: 'service',
  unite: 'service',
  unit: 'service',
  equipe: 'service',
  team: 'service',
  cellule: 'service',
  pool: 'service',
};

function compactKey(normalizedKey: string): string {
  return normalizedKey.replace(/[\s._\-\/:]+/g, '');
}

const IMPORT_KEY_ALIASES_COMPACT: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [k, v] of Object.entries(IMPORT_KEY_ALIASES)) {
    m[compactKey(k)] = v;
  }
  return m;
})();

/**
 * Heuristiques sur la clé compactée (sans espaces ni ponctuation) pour les fichiers Excel variés.
 */
function guessCanonicalFromCompact(c: string): string | null {
  if (!c || c.startsWith('__empty')) {
    return null;
  }
  if (
    c.includes('prenom') ||
    c.includes('firstname') ||
    c.includes('givenname') ||
    c === 'fname' ||
    c === 'prnom'
  ) {
    return 'prenom';
  }
  if (
    c.includes('courriel') ||
    c.endsWith('email') ||
    c === 'mel' ||
    (c.includes('mail') && !c.includes('matric'))
  ) {
    return 'email';
  }
  if (
    c.includes('matricule') ||
    c.includes('matricul') ||
    c === 'maricule' ||
    /^idemp/.test(c) ||
    c === 'mat' ||
    (c.includes('code') && c.includes('emp'))
  ) {
    return 'matricule';
  }
  if (
    c === 'nom' ||
    c.includes('lastname') ||
    c.includes('familyname') ||
    c.includes('nomdefamille') ||
    c.includes('nomfamille')
  ) {
    return 'nom';
  }
  if (
    c.includes('depart') ||
    c.includes('department') ||
    (c.startsWith('dept') && !c.includes('service')) ||
    c.includes('direction') ||
    c.includes('pole')
  ) {
    return 'departement';
  }
  if (
    c === 'service' ||
    (c.includes('service') &&
      !c.includes('depart') &&
      !c.includes('department')) ||
    c.includes('unite') ||
    c.includes('equipe') ||
    c.includes('cellule') ||
    c.includes('pool')
  ) {
    return 'service';
  }
  if (
    c.includes('fonction') ||
    c.includes('emploi') ||
    c.includes('poste') ||
    c.includes('titre') ||
    c.includes('jobtitle') ||
    c === 'job'
  ) {
    return 'poste';
  }
  return null;
}

/**
 * Associe un en-tête de colonne (brut ou déjà normalisé) à matricule | prenom | nom | email | …
 */
export function resolveCanonicalColumnName(rawKey: string): string {
  const key = normalizeHeader(rawKey);
  if (key === '' || key.startsWith('__empty')) {
    return '';
  }
  const fromExact = IMPORT_KEY_ALIASES[key];
  if (fromExact) {
    return fromExact;
  }
  const comp = compactKey(key);
  const fromCompact = IMPORT_KEY_ALIASES_COMPACT[comp];
  if (fromCompact) {
    return fromCompact;
  }
  const guessed = guessCanonicalFromCompact(comp);
  if (guessed) {
    return guessed;
  }
  return key;
}

/** Vérifie que les colonnes nécessaires sont présentes (sur les noms d’en-têtes, pas les valeurs). */
export function importHeadersSatisfyRequired(headerKeys: string[]): boolean {
  const mapped = new Set<string>();
  for (const h of headerKeys) {
    const c = resolveCanonicalColumnName(h);
    if (c) {
      mapped.add(c);
    }
  }
  return ['matricule', 'prenom', 'nom', 'email'].every((req) =>
    mapped.has(req),
  );
}

export function remapImportRowToCanonicalKeys(
  row: NormalizedImportRow,
): NormalizedImportRow {
  const out: NormalizedImportRow = {};
  for (const [k, v] of Object.entries(row)) {
    const canonical = resolveCanonicalColumnName(k);
    if (!canonical) {
      continue;
    }
    const s = String(v ?? '').trim();
    if (out[canonical] === undefined || out[canonical] === '') {
      out[canonical] = s;
    }
  }
  return out;
}

export function normalizeImportRows(
  rows: NormalizedImportRow[],
): NormalizedImportRow[] {
  return rows.map(remapImportRowToCanonicalKeys);
}

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
  const data = (result.data ?? []).map((row) => stringifyRowValues(row));
  return normalizeImportRows(data);
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
  const rows = raw.map((row) => {
    const out: NormalizedImportRow = {};
    for (const [k, v] of Object.entries(row)) {
      out[normalizeHeader(k)] = cellToString(v);
    }
    return out;
  });
  return normalizeImportRows(rows);
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
  direction: string;
  departement: string;
  service: string;
  poste: string;
} {
  return {
    matricule: row['matricule'] ?? '',
    prenom: row['prenom'] ?? '',
    nom: row['nom'] ?? '',
    email: (row['email'] ?? '').toLowerCase(),
    direction: row['direction'] ?? '',
    departement: row['departement'] ?? '',
    service: row['service'] ?? '',
    poste: row['poste'] ?? '',
  };
}

/** Colonnes du fichier telles qu’affichées (1re ligne), clés des lignes = ces libellés trimés. */
export type RawImportRow = Record<string, string>;

export type ImportMappingsInput = {
  matricule: string;
  prenom?: string;
  nom?: string;
  email: string;
  departement?: string;
  service?: string;
  direction?: string;
  poste?: string;
};

export type SplitFullNameInput = {
  column: string;
  separator: ' ' | ',' | '-';
};

export function getMappedCell(row: RawImportRow, header: string): string {
  if (!header) {
    return '';
  }
  if (Object.prototype.hasOwnProperty.call(row, header)) {
    return String(row[header] ?? '').trim();
  }
  const hit = Object.keys(row).find((k) => k.trim() === header.trim());
  return hit !== undefined ? String(row[hit] ?? '').trim() : '';
}

/**
 * Découpe un nom complet selon le séparateur choisi (aligné avec le front).
 * Espace : 1er token = prénom, le reste = nom.
 * Virgule : « nom, prénom » si deux segments.
 * Tiret : premier segment = prénom, le reste après le 1er tiret = nom.
 */
export function splitFullNameValue(
  value: string,
  separator: SplitFullNameInput['separator'],
): { prenom: string; nom: string } {
  const v = value.trim();
  if (!v) {
    return { prenom: '', nom: '' };
  }
  if (separator === ',') {
    const parts = v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return { prenom: parts[1] ?? '', nom: parts[0] ?? '' };
    }
    return { prenom: '', nom: parts[0] ?? '' };
  }
  if (separator === '-') {
    const i = v.indexOf('-');
    if (i === -1) {
      return { prenom: '', nom: v };
    }
    return {
      prenom: v.slice(0, i).trim(),
      nom: v.slice(i + 1).trim(),
    };
  }
  const parts = v.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { prenom: '', nom: '' };
  }
  if (parts.length === 1) {
    return { prenom: '', nom: parts[0] };
  }
  return { prenom: parts[0], nom: parts.slice(1).join(' ') };
}

export function rowFromExplicitMappings(
  row: RawImportRow,
  mappings: ImportMappingsInput,
  splitFullName?: SplitFullNameInput | null,
): NormalizedImportRow {
  let prenom = getMappedCell(row, mappings.prenom ?? '');
  let nom = getMappedCell(row, mappings.nom ?? '');
  if (splitFullName) {
    const full = getMappedCell(row, splitFullName.column);
    const parts = splitFullNameValue(full, splitFullName.separator);
    prenom = parts.prenom;
    nom = parts.nom;
  }
  return {
    matricule: getMappedCell(row, mappings.matricule),
    prenom,
    nom,
    email: getMappedCell(row, mappings.email).toLowerCase(),
    direction: getMappedCell(row, mappings.direction ?? ''),
    departement: getMappedCell(row, mappings.departement ?? ''),
    service: getMappedCell(row, mappings.service ?? ''),
    poste: getMappedCell(row, mappings.poste ?? ''),
  };
}

export function parseCsvBufferRaw(buffer: Buffer): {
  headers: string[];
  rows: RawImportRow[];
} {
  const text = stripBom(buffer.toString('utf8'));
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
  if (result.errors.length > 0 && !(result.data?.length ?? 0)) {
    throw new Error(result.errors.map((e) => e.message).join('; '));
  }
  const data = result.data ?? [];
  if (data.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = Object.keys(data[0] as object).filter(
    (k) => k !== '' && !k.startsWith('__'),
  );
  const rows: RawImportRow[] = data.map((r) => {
    const out: RawImportRow = {};
    for (const h of headers) {
      out[h] = cellToString(r[h]);
    }
    return out;
  });
  return { headers, rows };
}

export function parseXlsxBufferRaw(buffer: Buffer): {
  headers: string[];
  rows: RawImportRow[];
} {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [] };
  }
  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });
  if (raw.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = Object.keys(raw[0] as object).map((k) => k.trim());
  const rows: RawImportRow[] = raw.map((row) => {
    const out: RawImportRow = {};
    for (const [k, v] of Object.entries(row)) {
      out[k.trim()] = cellToString(v);
    }
    return out;
  });
  return { headers, rows };
}

export function parseImportBufferRaw(
  file: Pick<Express.Multer.File, 'mimetype' | 'originalname' | 'buffer'>,
): { headers: string[]; rows: RawImportRow[] } {
  const parser = resolveImportParser(file);
  return parser === 'csv'
    ? parseCsvBufferRaw(file.buffer)
    : parseXlsxBufferRaw(file.buffer);
}

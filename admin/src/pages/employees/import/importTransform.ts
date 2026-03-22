import type { ImportFullNameSeparator, UserImportConfigPayload } from '../../../types/employees'

/** Ligne brute : clés = libellés exacts des colonnes du fichier. */
export type RawImportRow = Record<string, string>

export type ImportMappingsInput = UserImportConfigPayload['mappings']

function getMappedCell(row: RawImportRow, header: string): string {
  if (!header) return ''
  if (Object.prototype.hasOwnProperty.call(row, header)) {
    return String(row[header] ?? '').trim()
  }
  const hit = Object.keys(row).find((k) => k.trim() === header.trim())
  return hit !== undefined ? String(row[hit] ?? '').trim() : ''
}

/**
 * Même logique que `splitFullNameValue` côté backend.
 */
export function splitFullNameValue(
  value: string,
  separator: ImportFullNameSeparator,
): { prenom: string; nom: string } {
  const v = value.trim()
  if (!v) return { prenom: '', nom: '' }
  if (separator === ',') {
    const parts = v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length >= 2) {
      return { prenom: parts[1] ?? '', nom: parts[0] ?? '' }
    }
    return { prenom: '', nom: parts[0] ?? '' }
  }
  if (separator === '-') {
    const i = v.indexOf('-')
    if (i === -1) return { prenom: '', nom: v }
    return { prenom: v.slice(0, i).trim(), nom: v.slice(i + 1).trim() }
  }
  const parts = v.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { prenom: '', nom: '' }
  if (parts.length === 1) return { prenom: '', nom: parts[0] }
  return { prenom: parts[0], nom: parts.slice(1).join(' ') }
}

export type CanonicalImportRow = {
  matricule: string
  prenom: string
  nom: string
  email: string
  direction: string
  departement: string
  service: string
  poste: string
  contractType: string
  contractEndDate: string
  entryDate: string
}

export function rowToCanonical(
  row: RawImportRow,
  mappings: ImportMappingsInput,
  splitFullName: UserImportConfigPayload['splitFullName'] | undefined,
): CanonicalImportRow {
  let prenom = getMappedCell(row, mappings.prenom ?? '')
  let nom = getMappedCell(row, mappings.nom ?? '')
  if (splitFullName) {
    const full = getMappedCell(row, splitFullName.column)
    const parts = splitFullNameValue(full, splitFullName.separator)
    prenom = parts.prenom
    nom = parts.nom
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
    contractType: getMappedCell(row, mappings.contractType ?? ''),
    contractEndDate: getMappedCell(row, mappings.contractEndDate ?? ''),
    entryDate: getMappedCell(row, mappings.entryDate ?? ''),
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim().toLowerCase())
}

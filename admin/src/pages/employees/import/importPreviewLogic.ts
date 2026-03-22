import type { ImportFullNameSeparator } from '../../../types/employees'
import type { OrgResolutionResult } from '../../../types/org'
import type { MappingSelection } from './importMappingState'
import { normalizeOrgKey } from './orgNormalize'
import { isValidEmail, rowToCanonical, type RawImportRow } from './importTransform'

export type PreviewRow = {
  key: number
  line: number
  matricule: string
  prenom: string
  nom: string
  email: string
  departement: string
  service: string
  poste: string
  status: 'ok' | 'error'
  errorMessage?: string
}

function buildSplitConfig(
  mapping: MappingSelection,
  useFullNameSplit: boolean,
  separator: ImportFullNameSeparator,
): { column: string; separator: ImportFullNameSeparator } | undefined {
  if (mapping.nomComplet && useFullNameSplit) {
    return { column: mapping.nomComplet, separator }
  }
  return undefined
}

export function buildMappingsPayload(
  mapping: MappingSelection,
  useFullNameSplit: boolean,
  fullNameSeparator: ImportFullNameSeparator,
): {
  mappings: {
    matricule: string
    prenom?: string
    nom?: string
    email: string
    departement?: string
    service?: string
    poste?: string
  }
  splitFullName?: { column: string; separator: ImportFullNameSeparator }
} {
  const split = buildSplitConfig(mapping, useFullNameSplit, fullNameSeparator)
  const mappings: {
    matricule: string
    prenom?: string
    nom?: string
    email: string
    direction?: string
    departement?: string
    service?: string
    poste?: string
    contractType?: string
    contractEndDate?: string
    entryDate?: string
  } = {
    matricule: mapping.matricule ?? '',
    email: mapping.email ?? '',
  }
  if (mapping.direction) {
    mappings.direction = mapping.direction
  }
  if (mapping.departement) {
    mappings.departement = mapping.departement
  }
  if (mapping.service) {
    mappings.service = mapping.service
  }
  if (mapping.poste) {
    mappings.poste = mapping.poste
  }
  if (mapping.contractType) {
    mappings.contractType = mapping.contractType
  }
  if (mapping.contractEndDate) {
    mappings.contractEndDate = mapping.contractEndDate
  }
  if (mapping.entryDate) {
    mappings.entryDate = mapping.entryDate
  }
  if (!split) {
    mappings.prenom = mapping.prenom ?? ''
    mappings.nom = mapping.nom ?? ''
  }
  return split ? { mappings, splitFullName: split } : { mappings }
}

function isIgnoredLabel(raw: string, ignored: string[] | undefined): boolean {
  const t = raw.trim()
  if (!t || !ignored?.length) {
    return false
  }
  const k = normalizeOrgKey(t)
  return ignored.some((x) => normalizeOrgKey(x) === k)
}

function displayMapped(
  raw: string,
  ignored: string[] | undefined,
  displayMap: Record<string, string> | undefined,
): string {
  const t = raw.trim()
  if (!t) {
    return ''
  }
  if (isIgnoredLabel(t, ignored)) {
    return ''
  }
  if (displayMap) {
    if (displayMap[t] !== undefined) {
      return displayMap[t]
    }
    const k = normalizeOrgKey(t)
    for (const [key, name] of Object.entries(displayMap)) {
      if (normalizeOrgKey(key) === k) {
        return name
      }
    }
  }
  return t
}

export function computePreviewRows(
  rawRows: RawImportRow[],
  mapping: MappingSelection,
  useFullNameSplit: boolean,
  fullNameSeparator: ImportFullNameSeparator,
  orgResult?: OrgResolutionResult | null,
): PreviewRow[] {
  const { mappings, splitFullName } = buildMappingsPayload(
    mapping,
    useFullNameSplit,
    fullNameSeparator,
  )
  /** Déduplication fichier : le matricule est la clé (pas l’e-mail). */
  const seenMat = new Map<string, number>()

  return rawRows.map((row, index) => {
    const line = index + 2
    const c = rowToCanonical(row, mappings, splitFullName)
    const mat = c.matricule.trim()
    const email = c.email.trim().toLowerCase()
    let status: 'ok' | 'error' = 'ok'
    let errorMessage: string | undefined

    if (!mat) {
      status = 'error'
      errorMessage = 'Matricule vide'
    } else if (!c.prenom.trim()) {
      status = 'error'
      errorMessage = 'Prénom vide'
    } else if (!c.nom.trim()) {
      status = 'error'
      errorMessage = 'Nom vide'
    } else if (!email || !isValidEmail(email)) {
      status = 'error'
      errorMessage = 'Email invalide'
    }

    if (status === 'ok') {
      const prevM = seenMat.get(mat)
      if (prevM !== undefined) {
        status = 'error'
        errorMessage = `Doublon (matricule, voir ligne ${prevM})`
      } else {
        seenMat.set(mat, line)
      }
    }

    const deptDisplay = orgResult
      ? displayMapped(
          c.departement,
          orgResult.ignoredDepartments,
          orgResult.departmentDisplayByFileLabel,
        )
      : c.departement
    const svcDisplay = orgResult
      ? displayMapped(
          c.service,
          orgResult.ignoredServices,
          orgResult.serviceDisplayByFileLabel,
        )
      : c.service

    return {
      key: index,
      line,
      matricule: c.matricule,
      prenom: c.prenom,
      nom: c.nom,
      email: c.email,
      departement: deptDisplay,
      service: svcDisplay,
      poste: c.poste,
      status,
      errorMessage,
    }
  })
}

export function countPreviewStats(rows: PreviewRow[]): {
  ok: number
  errors: number
} {
  let ok = 0
  let errors = 0
  for (const r of rows) {
    if (r.status === 'ok') ok += 1
    else errors += 1
  }
  return { ok, errors }
}

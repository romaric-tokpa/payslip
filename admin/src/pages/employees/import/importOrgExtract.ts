import type { OrgTreeResponse } from '../../../types/orgTree'
import type { CanonicalImportRow } from './importTransform'
import { normalizeOrgKey } from './orgNormalize'

export function uniqueOrgLabels(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const t = v.trim()
    if (!t) {
      continue
    }
    const k = normalizeOrgKey(t)
    if (seen.has(k)) {
      continue
    }
    seen.add(k)
    out.push(t)
  }
  return out
}

export function extractOrgLabelsFromRows(rows: CanonicalImportRow[]) {
  return {
    directions: uniqueOrgLabels(rows.map((r) => r.direction)),
    departments: uniqueOrgLabels(rows.map((r) => r.departement)),
    services: uniqueOrgLabels(rows.map((r) => r.service)),
  }
}

export function flattenOrgTree(tree: OrgTreeResponse): {
  directions: { id: string; name: string }[]
  departments: { id: string; name: string; directionId: string | null }[]
  services: { id: string; name: string; departmentId: string | null }[]
} {
  const directions: { id: string; name: string }[] = []
  const departments: { id: string; name: string; directionId: string | null }[] =
    []
  const services: { id: string; name: string; departmentId: string | null }[] =
    []
  for (const dir of tree.directions) {
    directions.push({ id: dir.id, name: dir.name })
    for (const dep of dir.departments) {
      departments.push({
        id: dep.id,
        name: dep.name,
        directionId: dep.directionId,
      })
      for (const svc of dep.services) {
        services.push({
          id: svc.id,
          name: svc.name,
          departmentId: svc.departmentId,
        })
      }
    }
  }
  return { directions, departments, services }
}

/** Détection rapide : tout existe déjà au sens « normalisé » strict (comme le backend exact). */
export function fileNeedsOrgResolutionStep(
  directionLabels: string[],
  departmentLabels: string[],
  serviceLabels: string[],
  flat: {
    directions: { name: string }[]
    departments: { name: string }[]
    services: { name: string }[]
  },
): boolean {
  const dirSet = new Set(flat.directions.map((d) => normalizeOrgKey(d.name)))
  const deptSet = new Set(
    flat.departments.map((d) => normalizeOrgKey(d.name)),
  )
  const svcSet = new Set(flat.services.map((s) => normalizeOrgKey(s.name)))
  for (const l of directionLabels) {
    if (!dirSet.has(normalizeOrgKey(l))) {
      return true
    }
  }
  for (const l of departmentLabels) {
    if (!deptSet.has(normalizeOrgKey(l))) {
      return true
    }
  }
  for (const l of serviceLabels) {
    if (!svcSet.has(normalizeOrgKey(l))) {
      return true
    }
  }
  return false
}

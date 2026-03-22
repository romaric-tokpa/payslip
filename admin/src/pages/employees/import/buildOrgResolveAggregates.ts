import type { CanonicalImportRow } from './importTransform'
import { normalizeOrgKey } from './orgNormalize'

/** Compacte les lignes import → payload léger pour POST /org/resolve (évite 413). */
export function buildOrgResolveAggregates(rows: CanonicalImportRow[]) {
  const directionCounts: Record<string, number> = {}
  const departmentCounts: Record<string, number> = {}
  const serviceCounts: Record<string, number> = {}

  const svcDept = new Map<
    string,
    { departmentRaw: string; n: number }
  >()
  const deptDir = new Map<
    string,
    { directionRaw: string; n: number }
  >()

  for (const r of rows) {
    const dir = r.direction.trim()
    const dep = r.departement.trim()
    const svc = r.service.trim()

    if (dir) {
      const k = normalizeOrgKey(dir)
      directionCounts[k] = (directionCounts[k] ?? 0) + 1
    }
    if (dep) {
      const k = normalizeOrgKey(dep)
      departmentCounts[k] = (departmentCounts[k] ?? 0) + 1
    }
    if (svc) {
      const k = normalizeOrgKey(svc)
      serviceCounts[k] = (serviceCounts[k] ?? 0) + 1
    }

    if (svc && dep) {
      const sn = normalizeOrgKey(svc)
      const dn = normalizeOrgKey(dep)
      const ek = `${sn}\u0000${dn}`
      const cur = svcDept.get(ek)
      if (cur) {
        cur.n += 1
      } else {
        svcDept.set(ek, { departmentRaw: dep, n: 1 })
      }
    }

    if (dep && dir) {
      const depn = normalizeOrgKey(dep)
      const dirn = normalizeOrgKey(dir)
      const ek = `${depn}\u0000${dirn}`
      const cur = deptDir.get(ek)
      if (cur) {
        cur.n += 1
      } else {
        deptDir.set(ek, { directionRaw: dir, n: 1 })
      }
    }
  }

  const serviceDepartmentEdges: {
    serviceNorm: string
    departmentRaw: string
    count: number
  }[] = []
  for (const [k, v] of svcDept) {
    const i = k.indexOf('\u0000')
    serviceDepartmentEdges.push({
      serviceNorm: k.slice(0, i),
      departmentRaw: v.departmentRaw,
      count: v.n,
    })
  }

  const departmentDirectionEdges: {
    departmentNorm: string
    directionRaw: string
    count: number
  }[] = []
  for (const [k, v] of deptDir) {
    const i = k.indexOf('\u0000')
    departmentDirectionEdges.push({
      departmentNorm: k.slice(0, i),
      directionRaw: v.directionRaw,
      count: v.n,
    })
  }

  return {
    directionCounts,
    departmentCounts,
    serviceCounts,
    serviceDepartmentEdges,
    departmentDirectionEdges,
  }
}

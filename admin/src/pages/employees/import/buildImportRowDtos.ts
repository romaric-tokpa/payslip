import type { ImportFullNameSeparator } from '../../../types/employees'
import type { OrgResolutionResult } from '../../../types/org'
import type { ImportRowDto } from '../../../types/employees'
import { buildMappingsPayload } from './importPreviewLogic'
import { rowToCanonical, type RawImportRow } from './importTransform'
import { normalizeOrgKey } from './orgNormalize'
import type { MappingSelection } from './importMappingState'

function isIgnoredLabel(raw: string, ignored: string[] | undefined): boolean {
  const t = raw.trim()
  if (!t || !ignored?.length) {
    return false
  }
  const k = normalizeOrgKey(t)
  return ignored.some((x) => normalizeOrgKey(x) === k)
}

function mapLabelToId(
  raw: string,
  map: Record<string, string>,
): string | undefined {
  const t = raw.trim()
  if (!t) {
    return undefined
  }
  if (map[t] !== undefined) {
    return map[t]
  }
  const nk = normalizeOrgKey(t)
  for (const [k, id] of Object.entries(map)) {
    if (normalizeOrgKey(k) === nk) {
      return id
    }
  }
  return undefined
}

function displayFromMap(
  raw: string,
  displayMap: Record<string, string> | undefined,
): string | undefined {
  const t = raw.trim()
  if (!t || !displayMap) {
    return undefined
  }
  if (displayMap[t] !== undefined) {
    return displayMap[t]
  }
  const nk = normalizeOrgKey(t)
  for (const [k, name] of Object.entries(displayMap)) {
    if (normalizeOrgKey(k) === nk) {
      return name
    }
  }
  return undefined
}

export function buildImportRowDtos(
  rawRows: RawImportRow[],
  mapping: MappingSelection,
  useFullNameSplit: boolean,
  fullNameSeparator: ImportFullNameSeparator,
  orgResult: OrgResolutionResult | null | undefined,
): ImportRowDto[] {
  const { mappings, splitFullName } = buildMappingsPayload(
    mapping,
    useFullNameSplit,
    fullNameSeparator,
  )

  return rawRows.map((row, rowIndex) => {
    const c = rowToCanonical(row, mappings, splitFullName)

    let departmentId: string | undefined
    let departmentName: string | undefined
    let serviceId: string | undefined
    let serviceName: string | undefined
    let directionId: string | undefined
    let directionName: string | undefined

    const deptRaw = c.departement.trim()
    if (deptRaw) {
      if (!orgResult || !isIgnoredLabel(deptRaw, orgResult.ignoredDepartments)) {
        departmentId = orgResult
          ? mapLabelToId(deptRaw, orgResult.departmentMap)
          : undefined
        departmentName =
          displayFromMap(deptRaw, orgResult?.departmentDisplayByFileLabel) ??
          deptRaw
      }
    }

    const svcRaw = c.service.trim()
    if (svcRaw) {
      if (!orgResult || !isIgnoredLabel(svcRaw, orgResult.ignoredServices)) {
        serviceId = orgResult
          ? mapLabelToId(svcRaw, orgResult.serviceMap)
          : undefined
        serviceName =
          displayFromMap(svcRaw, orgResult?.serviceDisplayByFileLabel) ?? svcRaw
      }
    }

    const dirRaw = c.direction.trim()
    if (dirRaw && mapping.direction) {
      if (!orgResult || !isIgnoredLabel(dirRaw, orgResult.ignoredDirections)) {
        directionId = orgResult
          ? mapLabelToId(dirRaw, orgResult.directionMap)
          : undefined
        directionName = dirRaw
      }
    }

    return {
      rowIndex,
      employeeId: c.matricule.trim() || undefined,
      firstName: c.prenom.trim(),
      lastName: c.nom.trim(),
      email: c.email.trim().toLowerCase(),
      position: c.poste.trim() || undefined,
      departmentId,
      departmentName: departmentName || undefined,
      serviceId,
      serviceName: serviceName || undefined,
      directionId,
      directionName: directionName || undefined,
      contractType: c.contractType.trim() || undefined,
      contractEndDate: c.contractEndDate.trim() || undefined,
      entryDate: c.entryDate.trim() || undefined,
    }
  })
}

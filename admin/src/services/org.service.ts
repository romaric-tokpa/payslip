import { api } from './api'
import type {
  OrgDepartment,
  OrgDirection,
  OrgService,
} from '../types/organization'
import type { BulkCreateOrgResponse, ResolveOrgResponse } from '../types/org'
import type { OrgTreeResponse } from '../types/orgTree'

export async function getOrgTree(): Promise<OrgTreeResponse> {
  const { data } = await api.get<OrgTreeResponse>('/org/tree')
  return data
}

export async function resolveOrg(body: {
  directions: string[]
  departments: string[]
  services: string[]
  orgRows?: Array<{
    direction?: string
    department?: string
    service?: string
  }>
  orgAggregates?: {
    directionCounts: Record<string, number>
    departmentCounts: Record<string, number>
    serviceCounts: Record<string, number>
    serviceDepartmentEdges: Array<{
      serviceNorm: string
      departmentRaw: string
      count: number
    }>
    departmentDirectionEdges: Array<{
      departmentNorm: string
      directionRaw: string
      count: number
    }>
  }
}): Promise<ResolveOrgResponse> {
  const { data } = await api.post<ResolveOrgResponse>('/org/resolve', body, {
    timeout: 120_000,
  })
  return data
}

export async function bulkCreateOrg(body: {
  directions: { name: string; id?: string }[]
  departments: { name: string; directionId?: string; id?: string }[]
  services: { name: string; departmentId?: string; id?: string }[]
}): Promise<BulkCreateOrgResponse> {
  const { data } = await api.post<BulkCreateOrgResponse>(
    '/org/bulk-create',
    body,
    { timeout: 120_000 },
  )
  return data
}

export async function createDirection(name: string): Promise<OrgDirection> {
  const { data } = await api.post<OrgDirection>('/org/directions', { name })
  return data
}

export async function updateDirection(
  id: string,
  name: string,
): Promise<OrgDirection> {
  const { data } = await api.patch<OrgDirection>(
    `/org/directions/${encodeURIComponent(id)}`,
    { name },
  )
  return data
}

export async function deleteDirection(id: string): Promise<void> {
  await api.delete(`/org/directions/${encodeURIComponent(id)}`)
}

export async function createDepartment(body: {
  name: string
  directionId?: string
}): Promise<OrgDepartment> {
  const { data } = await api.post<OrgDepartment>('/org/departments', body)
  return data
}

export async function updateDepartment(
  id: string,
  body: { name?: string; directionId?: string | null },
): Promise<OrgDepartment> {
  const { data } = await api.patch<OrgDepartment>(
    `/org/departments/${encodeURIComponent(id)}`,
    body,
  )
  return data
}

export async function deleteDepartment(id: string): Promise<void> {
  await api.delete(`/org/departments/${encodeURIComponent(id)}`)
}

export async function createService(body: {
  name: string
  departmentId?: string
}): Promise<OrgService> {
  const { data } = await api.post<OrgService>('/org/services', body)
  return data
}

export async function updateService(
  id: string,
  body: { name: string; departmentId?: string | null },
): Promise<OrgService> {
  const { data } = await api.patch<OrgService>(
    `/org/services/${encodeURIComponent(id)}`,
    body,
  )
  return data
}

export async function deleteService(id: string): Promise<void> {
  await api.delete(`/org/services/${encodeURIComponent(id)}`)
}

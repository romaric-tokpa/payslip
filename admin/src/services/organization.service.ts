import { api } from './api'
import type { OrgDepartment, OrgDirection, OrgService } from '../types/organization'

export async function listDirections(): Promise<OrgDirection[]> {
  const { data } = await api.get<OrgDirection[]>('/organization/directions')
  return data
}

export async function createDirection(name: string): Promise<OrgDirection> {
  const { data } = await api.post<OrgDirection>('/organization/directions', {
    name,
  })
  return data
}

export async function updateDirection(
  id: string,
  name: string,
): Promise<OrgDirection> {
  const { data } = await api.patch<OrgDirection>(
    `/organization/directions/${encodeURIComponent(id)}`,
    { name },
  )
  return data
}

export async function deleteDirection(id: string): Promise<void> {
  await api.delete(`/organization/directions/${encodeURIComponent(id)}`)
}

export async function listDepartments(): Promise<OrgDepartment[]> {
  const { data } = await api.get<OrgDepartment[]>('/organization/departments')
  return data
}

export async function createDepartment(body: {
  name: string
  directionId?: string
}): Promise<OrgDepartment> {
  const { data } = await api.post<OrgDepartment>(
    '/organization/departments',
    body,
  )
  return data
}

export async function updateDepartment(
  id: string,
  body: { name?: string; directionId?: string | null },
): Promise<OrgDepartment> {
  const { data } = await api.patch<OrgDepartment>(
    `/organization/departments/${encodeURIComponent(id)}`,
    body,
  )
  return data
}

export async function deleteDepartment(id: string): Promise<void> {
  await api.delete(`/organization/departments/${encodeURIComponent(id)}`)
}

export async function listServices(
  departmentId?: string,
): Promise<OrgService[]> {
  const { data } = await api.get<OrgService[]>('/organization/services', {
    params:
      departmentId != null && departmentId !== ''
        ? { departmentId }
        : undefined,
  })
  return data
}

export async function createService(body: {
  name: string
  departmentId?: string
}): Promise<OrgService> {
  const { data } = await api.post<OrgService>('/organization/services', body)
  return data
}

export async function updateService(
  id: string,
  body: { name: string; departmentId?: string | null },
): Promise<OrgService> {
  const { data } = await api.patch<OrgService>(
    `/organization/services/${encodeURIComponent(id)}`,
    body,
  )
  return data
}

export async function deleteService(id: string): Promise<void> {
  await api.delete(`/organization/services/${encodeURIComponent(id)}`)
}

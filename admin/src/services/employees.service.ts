import { AxiosHeaders } from 'axios'
import { api } from './api'
import type {
  CreateEmployeePayload,
  EmployeeUser,
  GetEmployeesParams,
  ImportEmployeesReport,
  InviteEmployeeResponse,
  PaginatedEmployeesResponse,
  UpdateEmployeePayload,
} from '../types/employees'

function toQuery(params: GetEmployeesParams): Record<string, string | number> {
  const q: Record<string, string | number> = {}
  if (params.page != null) q.page = params.page
  if (params.limit != null) q.limit = params.limit
  if (params.search != null && params.search !== '') q.search = params.search
  if (params.department != null && params.department !== '') {
    q.department = params.department
  }
  return q
}

export async function getEmployees(
  params: GetEmployeesParams,
): Promise<PaginatedEmployeesResponse> {
  const { data } = await api.get<PaginatedEmployeesResponse>('/users', {
    params: toQuery(params),
  })
  return data
}

export async function createEmployee(
  body: CreateEmployeePayload,
): Promise<InviteEmployeeResponse> {
  const { data } = await api.post<InviteEmployeeResponse>('/users', body)
  return data
}

export async function updateEmployee(
  id: string,
  body: UpdateEmployeePayload,
): Promise<EmployeeUser> {
  const { data } = await api.patch<EmployeeUser>(`/users/${id}`, body)
  return data
}

export async function deactivateEmployee(id: string): Promise<EmployeeUser> {
  const { data } = await api.patch<EmployeeUser>(`/users/${id}/deactivate`)
  return data
}

export async function reactivateEmployee(id: string): Promise<EmployeeUser> {
  const { data } = await api.patch<EmployeeUser>(`/users/${id}/reactivate`)
  return data
}

export async function importEmployees(
  file: File,
): Promise<ImportEmployeesReport> {
  const formData = new FormData()
  formData.append('file', file)
  const headers = new AxiosHeaders()
  headers.delete('Content-Type')
  const { data } = await api.post<ImportEmployeesReport>(
    '/users/import',
    formData,
    { headers },
  )
  return data
}

export async function downloadTemplate(): Promise<void> {
  const { data } = await api.get<Blob>('/users/import/template', {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = 'import_template.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

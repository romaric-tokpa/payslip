import { AxiosHeaders } from 'axios'
import { getApiBaseUrl } from '../config/env'
import type {
  ActivationMessagingConfig,
  BulkActivateDto,
  BulkActivateResponse,
  BulkDepartureDto,
  CreateEmployeePayload,
  EmployeeUser,
  ExpiringContractRow,
  GetEmployeesParams,
  ImportEmployeesReport,
  ImportProgressEvent,
  ImportResultDetail,
  ImportResultDto,
  ImportRowDto,
  InitiateDepartureDto,
  InviteEmployeeResponse,
  PaginatedEmployeesResponse,
  ReinstateDto,
  UpdateEmployeePayload,
  UserImportConfigPayload,
  ValidateImportResponse,
} from '../types/employees'
import { api } from './api'
import { getAccessTokenFromStore } from './authStorage'

function toQuery(
  params: GetEmployeesParams,
): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = {}
  if (params.page != null) q.page = params.page
  if (params.limit != null) q.limit = params.limit
  if (params.search != null && params.search !== '') q.search = params.search
  if (params.department != null && params.department !== '') {
    q.department = params.department
  }
  if (params.departmentId != null && params.departmentId !== '') {
    q.departmentId = params.departmentId
  }
  if (params.directionId != null && params.directionId !== '') {
    q.directionId = params.directionId
  }
  if (params.activationStatus != null && params.activationStatus !== 'all') {
    q.activationStatus = params.activationStatus
  }
  if (params.employmentFilter != null && params.employmentFilter !== 'all') {
    q.employmentFilter = params.employmentFilter
  }
  if (params.contractType != null && params.contractType !== 'all') {
    q.contractType = params.contractType
  }
  if (params.expiringContracts30d === true) {
    q.expiringContracts30d = true
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

export async function getEmployeeById(id: string): Promise<EmployeeUser> {
  const { data } = await api.get<EmployeeUser>(`/users/${id}`)
  return data
}

export async function getActivationMessagingConfig(): Promise<ActivationMessagingConfig> {
  const { data } = await api.get<ActivationMessagingConfig>(
    '/users/activation/messaging-config',
  )
  return data
}

export async function bulkActivate(
  body: BulkActivateDto,
): Promise<BulkActivateResponse> {
  const { data } = await api.post<BulkActivateResponse>(
    '/users/bulk-activate',
    body,
    { timeout: 300_000 },
  )
  return data
}

export async function createEmployee(
  body: CreateEmployeePayload,
): Promise<InviteEmployeeResponse> {
  const { data } = await api.post<InviteEmployeeResponse>('/users', body)
  return data
}

/** Nouveau code d’activation (72 h) ; les codes précédents sont invalidés. */
export async function regenerateEmployeeInvitation(
  userId: string,
): Promise<InviteEmployeeResponse> {
  const { data } = await api.post<InviteEmployeeResponse>(
    `/users/${encodeURIComponent(userId)}/invitation`,
  )
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

export async function initiateDepart(
  userId: string,
  body: InitiateDepartureDto,
): Promise<EmployeeUser> {
  const { data } = await api.post<EmployeeUser>(
    `/users/${encodeURIComponent(userId)}/depart`,
    body,
  )
  return data
}

export async function bulkDepart(body: BulkDepartureDto): Promise<{
  departed: number
  errors: { userId: string; reason: string }[]
}> {
  const { data } = await api.post<{
    departed: number
    errors: { userId: string; reason: string }[]
  }>('/users/bulk-depart', body, { timeout: 120_000 })
  return data
}

export async function reinstateUser(
  userId: string,
  body?: ReinstateDto,
): Promise<EmployeeUser> {
  const { data } = await api.post<EmployeeUser>(
    `/users/${encodeURIComponent(userId)}/reinstate`,
    body ?? {},
  )
  return data
}

export async function archiveDepartedUser(userId: string): Promise<EmployeeUser> {
  const { data } = await api.post<EmployeeUser>(
    `/users/${encodeURIComponent(userId)}/archive`,
    { confirm: 'ARCHIVER' },
  )
  return data
}

export async function getExpiringContracts(
  days: number = 30,
): Promise<ExpiringContractRow[]> {
  const { data } = await api.get<ExpiringContractRow[]>(
    '/users/expiring-contracts',
    { params: { days } },
  )
  return data
}

function importFormData(
  file: File,
  importConfig?: UserImportConfigPayload,
): FormData {
  const formData = new FormData()
  formData.append('file', file)
  if (importConfig !== undefined) {
    formData.append('importConfig', JSON.stringify(importConfig))
  }
  return formData
}

function importMultipartHeaders(): AxiosHeaders {
  const headers = new AxiosHeaders()
  headers.delete('Content-Type')
  return headers
}

/** Démarre un import asynchrone ; consommer le flux avec `streamImportEmployeesJob`. */
export async function startImportEmployeesAsync(
  file: File,
  importConfig?: UserImportConfigPayload,
): Promise<{ jobId: string }> {
  const { data } = await api.post<{ jobId: string }>(
    '/users/import/async',
    importFormData(file, importConfig),
    { headers: importMultipartHeaders(), timeout: 300_000 },
  )
  return data
}

/**
 * Lit le flux SSE (fetch + Authorization) jusqu’à l’événement `done` ou `error`.
 */
export async function streamImportEmployeesJob(
  jobId: string,
  onEvent: (e: ImportProgressEvent) => void,
  signal?: AbortSignal,
): Promise<ImportEmployeesReport> {
  const token = getAccessTokenFromStore()
  if (!token) {
    throw new Error('Session expirée : reconnectez-vous')
  }
  const url = `${getApiBaseUrl()}/users/import/jobs/${encodeURIComponent(jobId)}/events`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      text || `Flux de progression indisponible (${res.status})`,
    )
  }
  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error('Réponse sans corps (flux SSE)')
  }
  const decoder = new TextDecoder()
  let buffer = ''
  let doneReport: ImportEmployeesReport | null = null

  const flushBlocks = (flushAll: boolean) => {
    buffer = buffer.replace(/\r\n/g, '\n')
    const sep = '\n\n'
    let idx = buffer.indexOf(sep)
    while (idx !== -1) {
      const block = buffer.slice(0, idx)
      buffer = buffer.slice(idx + sep.length)
      for (const line of block.split('\n')) {
        const t = line.trim()
        if (t.startsWith('data:')) {
          const json = t.slice(5).trim()
          if (json) {
            const ev = JSON.parse(json) as ImportProgressEvent
            onEvent(ev)
            if (ev.kind === 'done') {
              doneReport = ev.report
            }
            if (ev.kind === 'error') {
              throw new Error(ev.message)
            }
          }
        }
      }
      idx = buffer.indexOf(sep)
    }
    if (flushAll && buffer.trim()) {
      for (const line of buffer.split('\n')) {
        const t = line.trim()
        if (t.startsWith('data:')) {
          const json = t.slice(5).trim()
          if (json) {
            const ev = JSON.parse(json) as ImportProgressEvent
            onEvent(ev)
            if (ev.kind === 'done') {
              doneReport = ev.report
            }
            if (ev.kind === 'error') {
              throw new Error(ev.message)
            }
          }
        }
      }
      buffer = ''
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (value) {
        buffer += decoder.decode(value, { stream: true })
        flushBlocks(false)
      }
      if (done) {
        flushBlocks(true)
        break
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!doneReport) {
    throw new Error('Import interrompu sans rapport final')
  }
  return doneReport
}

/** Enchaîne POST async + flux SSE (progression temps réel jusqu’au rapport). */
export async function importEmployeesWithLiveProgress(
  file: File,
  importConfig: UserImportConfigPayload | undefined,
  onEvent: (e: ImportProgressEvent) => void,
  signal?: AbortSignal,
): Promise<ImportEmployeesReport> {
  const { jobId } = await startImportEmployeesAsync(file, importConfig)
  return streamImportEmployeesJob(jobId, onEvent, signal)
}

/** Import synchrone classique (sans progression temps réel). */
export async function importEmployees(
  file: File,
  importConfig?: UserImportConfigPayload,
): Promise<ImportEmployeesReport> {
  const { data } = await api.post<ImportEmployeesReport>(
    '/users/import',
    importFormData(file, importConfig),
    { headers: importMultipartHeaders(), timeout: 300_000 },
  )
  return data
}

function csvEscapeCell(s: string): string {
  const t = String(s ?? '').replace(/"/g, '""')
  return `"${t}"`
}

export async function validateImport(
  rows: ImportRowDto[],
): Promise<ValidateImportResponse> {
  const { data } = await api.post<ValidateImportResponse>(
    '/users/import/validate',
    { rows },
    { timeout: 120_000 },
  )
  return data
}

export async function commitImportEmployees(
  rows: ImportRowDto[],
): Promise<ImportResultDto> {
  const { data } = await api.post<ImportResultDto>(
    '/users/import/commit',
    { rows },
    { timeout: 300_000 },
  )
  return data
}

export function exportErrorsCsv(details: ImportResultDetail[]): void {
  const lines = [
    'Ligne,Email,Matricule,Erreur',
    ...details
      .filter((d) => d.status === 'error')
      .map(
        (e) =>
          `${e.rowIndex + 2},${csvEscapeCell(e.email)},${csvEscapeCell(e.employeeId ?? '')},${csvEscapeCell(e.errorMessage ?? '')}`,
      ),
  ]
  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `erreurs_import_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportImportReportCsv(result: ImportResultDto): void {
  const lines = [
    'Ligne,Email,Matricule,Statut,Message',
    ...result.details.map(
      (d) =>
        `${d.rowIndex + 2},${csvEscapeCell(d.email)},${csvEscapeCell(d.employeeId ?? '')},${csvEscapeCell(d.status)},${csvEscapeCell(d.errorMessage ?? '')}`,
    ),
  ]
  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rapport_import_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadTemplate(): Promise<void> {
  const { data } = await api.get<Blob>('/users/import/template', {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = 'PaySlip_Manager_Import_Template.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

import { api } from './api'
import type {
  GetAuditLogsExportParams,
  GetAuditLogsParams,
  PaginatedAuditLogsResponse,
} from '../types/audit'

function toQuery(
  params: GetAuditLogsParams | GetAuditLogsExportParams,
): Record<string, string | number> {
  const q: Record<string, string | number> = {}
  if ('page' in params && params.page != null) q.page = params.page
  if ('limit' in params && params.limit != null) q.limit = params.limit
  if (params.action != null && params.action !== '') q.action = params.action
  if (params.userId != null && params.userId !== '') q.userId = params.userId
  if (params.startDate != null && params.startDate !== '') {
    q.startDate = params.startDate
  }
  if (params.endDate != null && params.endDate !== '') {
    q.endDate = params.endDate
  }
  if (params.from != null && params.from !== '') q.from = params.from
  if (params.to != null && params.to !== '') q.to = params.to
  if (params.entityType != null && params.entityType !== '') {
    q.entityType = params.entityType
  }
  if (params.search != null && params.search !== '') q.search = params.search
  return q
}

export async function getAuditLogs(
  params: GetAuditLogsParams,
): Promise<PaginatedAuditLogsResponse> {
  const { data } = await api.get<PaginatedAuditLogsResponse>('/audit', {
    params: toQuery(params),
  })
  return data
}

export async function getAuditActions(): Promise<string[]> {
  const { data } = await api.get<string[]>('/audit/actions')
  return data
}

export async function exportAuditCsv(
  params: GetAuditLogsExportParams,
): Promise<void> {
  const res = await api.get<Blob>('/audit/export', {
    params: toQuery(params),
    responseType: 'blob',
  })
  const blob = res.data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'journal-activite.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

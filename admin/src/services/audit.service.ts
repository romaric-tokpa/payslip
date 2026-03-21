import { api } from './api'
import type {
  GetAuditLogsParams,
  PaginatedAuditLogsResponse,
} from '../types/audit'

function toQuery(
  params: GetAuditLogsParams,
): Record<string, string | number> {
  const q: Record<string, string | number> = {}
  if (params.page != null) q.page = params.page
  if (params.limit != null) q.limit = params.limit
  if (params.action != null && params.action !== '') q.action = params.action
  if (params.entityType != null && params.entityType !== '') {
    q.entityType = params.entityType
  }
  if (params.from != null && params.from !== '') q.from = params.from
  if (params.to != null && params.to !== '') q.to = params.to
  if (params.search != null && params.search !== '') q.search = params.search
  return q
}

export async function getAuditLogs(
  params: GetAuditLogsParams,
): Promise<PaginatedAuditLogsResponse> {
  const { data } = await api.get<PaginatedAuditLogsResponse>('/audit-logs', {
    params: toQuery(params),
  })
  return data
}

export type AuditLogUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  companyId: string | null
}

export type AuditLog = {
  id: string
  userId: string | null
  action: string
  entityType: string
  entityId: string | null
  ipAddress: string | null
  userAgent: string | null
  metadata: unknown
  createdAt: string
  user: AuditLogUser | null
}

export type PaginatedAuditLogsResponse = {
  data: AuditLog[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export type GetAuditLogsParams = {
  page?: number
  limit?: number
  action?: string
  userId?: string
  startDate?: string
  endDate?: string
  /** @deprecated Utiliser startDate / endDate ; conservé pour compat API */
  from?: string
  to?: string
  entityType?: string
  search?: string
}

export type GetAuditLogsExportParams = Omit<
  GetAuditLogsParams,
  'page' | 'limit'
>

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
  entityType?: string
  from?: string
  to?: string
  search?: string
}

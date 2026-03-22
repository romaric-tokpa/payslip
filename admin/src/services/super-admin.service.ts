import type { AuthSessionPayload } from '../types/auth'
import type {
  GlobalAuditLogsResponse,
  ImpersonateApiResponse,
  PlatformStats,
  RecentCompanyRow,
  SuperAdminCompaniesResponse,
  SuperAdminCompanyDetail,
  SuperAdminGrowthData,
} from '../types/super-admin'
import { api } from './api'

export type SuperAdminCompaniesParams = {
  search?: string
  sortBy?: 'name' | 'createdAt' | 'employeeCount' | 'payslipCount'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
  plan?: string
  status?: 'active' | 'inactive' | 'trial'
}

export type SuperAdminAuditParams = {
  companyId?: string
  action?: string
  page?: number
  limit?: number
  from?: string
  to?: string
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const { data } = await api.get<PlatformStats>('/super-admin/stats')
  return data
}

export async function getSuperAdminCompanies(
  params?: SuperAdminCompaniesParams,
): Promise<SuperAdminCompaniesResponse> {
  const { data } = await api.get<SuperAdminCompaniesResponse>(
    '/super-admin/companies',
    { params },
  )
  return data
}

export async function getRecentCompanies(): Promise<RecentCompanyRow[]> {
  const { data } = await api.get<RecentCompanyRow[]>(
    '/super-admin/companies/recent',
  )
  return data
}

export async function getSuperAdminCompanyDetail(
  id: string,
): Promise<SuperAdminCompanyDetail> {
  const { data } = await api.get<SuperAdminCompanyDetail>(
    `/super-admin/companies/${encodeURIComponent(id)}`,
  )
  return data
}

export async function updateSuperAdminCompany(
  id: string,
  body: { plan?: string; name?: string; isActive?: boolean },
): Promise<unknown> {
  const { data } = await api.patch(
    `/super-admin/companies/${encodeURIComponent(id)}`,
    body,
  )
  return data
}

function sessionFromImpersonateResponse(
  res: ImpersonateApiResponse,
): AuthSessionPayload {
  const { user: u, accessToken, refreshToken } = res
  return {
    accessToken,
    refreshToken,
    user: {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      companyId: u.companyId,
      companyName: u.companyName ?? undefined,
      mustChangePassword: Boolean(u.mustChangePassword),
    },
  }
}

export async function impersonateCompanyRh(
  companyId: string,
): Promise<AuthSessionPayload> {
  const { data } = await api.post<ImpersonateApiResponse>(
    `/super-admin/companies/${encodeURIComponent(companyId)}/impersonate`,
  )
  return sessionFromImpersonateResponse(data)
}

export async function getGlobalAuditLogs(
  params?: SuperAdminAuditParams,
): Promise<GlobalAuditLogsResponse> {
  const { data } = await api.get<GlobalAuditLogsResponse>(
    '/super-admin/audit',
    { params },
  )
  return data
}

export async function getGrowthData(): Promise<SuperAdminGrowthData> {
  const { data } = await api.get<SuperAdminGrowthData>('/super-admin/growth')
  return data
}

import type { User } from './auth'

export type PlatformStats = {
  totalCompanies: number
  totalUsers: number
  totalPayslips: number
  activeCompanies: number
  growth: {
    companiesThisMonth: number
    usersThisMonth: number
    payslipsThisMonth: number
  }
  signatures: {
    companiesRequiringSignature: number
    recordedThisMonth: number
    totalRecorded: number
  }
}

export type SuperAdminCompanyOverview = {
  id: string
  name: string
  rccm: string | null
  plan: string
  isActive: boolean
  requireSignature: boolean
  createdAt: string
  admin: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
  employeeCount: number
  activeCount: number
  payslipCount: number
  lastActivity: string
}

export type SuperAdminCompaniesResponse = {
  companies: SuperAdminCompanyOverview[]
  total: number
}

export type MonthCount = { month: string; count: number }

export type SuperAdminCompanyDetail = {
  id: string
  name: string
  rccm: string | null
  phone: string | null
  address: string | null
  subscriptionPlan: string | null
  plan: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  rhAdmins: {
    id: string
    firstName: string
    lastName: string
    email: string
    /** Poste / fonction (champ `position` côté API). */
    position: string | null
    createdAt: string
  }[]
  directions: {
    id: string
    name: string
    departments: {
      id: string
      name: string
      services: { id: string; name: string }[]
    }[]
  }[]
  stats: {
    totalEmployees: number
    activeEmployees: number
    departedEmployees: number
    totalPayslips: number
    readPayslips: number
    consultationRate: number
    payslipsByMonth: MonthCount[]
    orgStructure: { directions: number; departments: number; services: number }
    lastUploadAt: string | null
  }
}

export type SuperAdminGrowthData = {
  companiesByMonth: MonthCount[]
  usersByMonth: MonthCount[]
  payslipsByMonth: MonthCount[]
  topCompanies: {
    id: string
    name: string
    userCount: number
    totalUsers: number
  }[]
}

export type RecentCompanyRow = {
  id: string
  name: string
  createdAt: string
  adminEmail: string | null
  adminName: string | null
  employeeCount: number
  plan: string
}

export type GlobalAuditLogUser = {
  firstName: string
  lastName: string
  email: string
}

export type GlobalAuditLogCompany = { name: string }

export type GlobalAuditLogRow = {
  id: string
  userId: string | null
  companyId: string | null
  action: string
  entityType: string
  entityId: string | null
  ipAddress: string | null
  userAgent: string | null
  metadata: unknown
  createdAt: string
  user: GlobalAuditLogUser | null
  company: GlobalAuditLogCompany | null
}

export type GlobalAuditLogsResponse = {
  logs: GlobalAuditLogRow[]
  total: number
}

export type ImpersonateApiResponse = {
  user: User & {
    companyName?: string | null
    employmentStatus?: string
    readOnlyUntil?: string | null
  }
  accessToken: string
  refreshToken: string
}

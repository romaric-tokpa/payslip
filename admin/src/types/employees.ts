import type { UserRole } from './auth'

export type OrgDirectionBrief = { id: string; name: string }

export type OrgDepartmentBrief = {
  id: string
  name: string
  directionId: string | null
  direction: OrgDirectionBrief | null
}

export type OrgServiceBrief = {
  id: string
  name: string
  departmentId: string | null
}

/** Aligné sur `UserPublic` côté API (GET /users). */
export type EmployeeUser = {
  id: string
  companyId: string | null
  firstName: string
  lastName: string
  email: string
  employeeId: string | null
  department: string | null
  departmentId: string | null
  serviceId: string | null
  orgDepartment: OrgDepartmentBrief | null
  orgService: OrgServiceBrief | null
  position: string | null
  role: UserRole
  isActive: boolean
  entryDate: string | null
  createdAt: string
}

export type EmployeesListMeta = {
  total: number
  page: number
  limit: number
  totalPages: number
}

export type PaginatedEmployeesResponse = {
  data: EmployeeUser[]
  meta: EmployeesListMeta
}

export type GetEmployeesParams = {
  page?: number
  limit?: number
  search?: string
  /** Filtre texte historique (égalité exacte) */
  department?: string
  /** Filtre structure (UUID département) */
  departmentId?: string
  /** Filtre par direction (UUID) */
  directionId?: string
}

export type CreateEmployeePayload = {
  email: string
  firstName: string
  lastName: string
  employeeId: string
  department?: string
  position?: string
  departmentId?: string
  serviceId?: string
}

export type UpdateEmployeePayload = {
  firstName?: string
  lastName?: string
  email?: string
  department?: string
  position?: string
  departmentId?: string | null
  serviceId?: string | null
}

export type InviteEmployeeResponse = {
  activationCode: string
  activationUrl: string
}

export type ImportEmployeeErrorDetail = {
  line: number
  matricule: string
  reason: string
}

export type ImportEmployeesReport = {
  total: number
  created: number
  errors: number
  errorDetails: ImportEmployeeErrorDetail[]
}

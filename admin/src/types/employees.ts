import type { UserRole } from './auth'

/** Aligné sur `UserPublic` côté API (GET /users). */
export type EmployeeUser = {
  id: string
  companyId: string | null
  firstName: string
  lastName: string
  email: string
  employeeId: string | null
  department: string | null
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
  department?: string
}

export type CreateEmployeePayload = {
  email: string
  firstName: string
  lastName: string
  employeeId: string
  department?: string
  position?: string
}

export type UpdateEmployeePayload = {
  firstName?: string
  lastName?: string
  email?: string
  department?: string
  position?: string
}

export type InviteEmployeeResponse = {
  invitationToken: string
  invitationUrl: string
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

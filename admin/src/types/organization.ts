export type OrgDirection = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type OrgDepartment = {
  id: string
  name: string
  directionId: string | null
  createdAt: string
  updatedAt: string
  direction: { id: string; name: string } | null
}

export type OrgService = {
  id: string
  name: string
  departmentId: string | null
  createdAt: string
  updatedAt: string
  department: { id: string; name: string } | null
}

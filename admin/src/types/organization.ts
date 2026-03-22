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

export type OrgChartEmployee = {
  id: string
  firstName: string
  lastName: string
  position: string | null
  serviceName: string | null
}

export type OrgChartServiceNode = {
  id: string
  name: string
  employees: OrgChartEmployee[]
}

export type OrgChartDepartmentNode = {
  id: string
  name: string
  services: OrgChartServiceNode[]
  employees: OrgChartEmployee[]
}

export type OrgChartDirectionNode = {
  id: string
  name: string
  departments: OrgChartDepartmentNode[]
}

export type OrgChartResponse = {
  companyName: string
  directions: OrgChartDirectionNode[]
  departmentsWithoutDirection: OrgChartDepartmentNode[]
  orphanServices: OrgChartServiceNode[]
}

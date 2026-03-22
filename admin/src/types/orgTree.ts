/** Aligné sur `GET /org/tree` ; même id que le backend pour la direction virtuelle. */
export const ORG_TREE_UNASSIGNED_DIRECTION_ID =
  '00000000-0000-4000-8000-000000000001'

export type OrgTreeService = {
  id: string
  name: string
  employeeCount: number
  departmentId: string | null
}

export type OrgTreeDepartment = {
  id: string
  name: string
  employeeCount: number
  directionId: string | null
  services: OrgTreeService[]
}

export type OrgTreeDirection = {
  id: string
  name: string
  employeeCount: number
  departments: OrgTreeDepartment[]
}

export type OrgTreeResponse = {
  company: {
    id: string
    name: string
    totalEmployees: number
  }
  directions: OrgTreeDirection[]
}

export type OrgSelectableType = 'company' | 'direction' | 'department' | 'service'

export type OrgSelection =
  | {
      type: 'company'
      id: string
      name: string
      employeeCount: number
    }
  | {
      type: 'direction'
      id: string
      name: string
      employeeCount: number
      departments: OrgTreeDepartment[]
      isVirtual?: boolean
    }
  | {
      type: 'department'
      id: string
      name: string
      employeeCount: number
      directionId: string | null
      directionName: string
      services: OrgTreeService[]
    }
  | {
      type: 'service'
      id: string
      name: string
      employeeCount: number
      departmentId: string | null
      departmentName: string
    }

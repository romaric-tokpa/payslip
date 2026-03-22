export type OrgResolutionStatus = 'existing' | 'similar' | 'new'

export interface OrgResolutionItem {
  value: string
  normalizedValue: string
  status: OrgResolutionStatus
  existingId?: string
  existingName?: string
  suggestedId?: string
  suggestedName?: string
  suggestedParentId?: string
  suggestedParentName?: string
  lineCount: number
}

export type OrgResolutionAction = 'create' | 'associate' | 'ignore'

export interface OrgResolutionDecision {
  value: string
  action: OrgResolutionAction
  associateToId?: string
  parentId?: string
  parentName?: string
}

export interface ResolveOrgResponse {
  directions: OrgResolutionItem[]
  departments: OrgResolutionItem[]
  services: OrgResolutionItem[]
}

export interface BulkCreateOrgResponse {
  createdDirections: { name: string; id: string }[]
  createdDepartments: { name: string; id: string }[]
  createdServices: { name: string; id: string }[]
  reusedDirections?: { name: string; id: string }[]
  reusedDepartments?: { name: string; id: string }[]
  reusedServices?: { name: string; id: string }[]
}

export interface OrgResolutionResult {
  directionMap: Record<string, string>
  departmentMap: Record<string, string>
  serviceMap: Record<string, string>
  ignoredDirections: string[]
  ignoredDepartments: string[]
  ignoredServices: string[]
  /** Libellés affichés en prévisualisation (nom en base) */
  departmentDisplayByFileLabel: Record<string, string>
  serviceDisplayByFileLabel: Record<string, string>
}

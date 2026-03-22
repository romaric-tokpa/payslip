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

export type EmploymentStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'ON_NOTICE'
  | 'DEPARTED'
  | 'ARCHIVED'

export type ContractType = 'CDI' | 'CDD' | 'INTERIM' | 'STAGE'

export type DepartureType =
  | 'RESIGNATION'
  | 'TERMINATION'
  | 'CONTRACT_END'
  | 'RETIREMENT'
  | 'MUTUAL_AGREEMENT'

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
  /** Compte activé avec mot de passe temporaire — changement obligatoire à la prochaine connexion app */
  mustChangePassword?: boolean
  entryDate: string | null
  createdAt: string
  /** URL présignée (affichage avatar), absente ou null si pas de photo */
  profilePhotoUrl?: string | null
  employmentStatus: EmploymentStatus
  contractType?: ContractType | null
  contractEndDate?: string | null
  departureType?: DepartureType | null
  departureReason?: string | null
  departureDate?: string | null
  noticeStartDate?: string | null
  noticeEndDate?: string | null
  departedAt?: string | null
  readOnlyUntil?: string | null
  archivedAt?: string | null
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
  /** Statut d’activation (RH) */
  activationStatus?: 'all' | 'active' | 'inactive' | 'pending_password'
  employmentFilter?:
    | 'all'
    | 'active'
    | 'on_notice'
    | 'departed'
    | 'pending'
    | 'archived'
  contractType?: 'all' | 'CDI' | 'CDD' | 'INTERIM' | 'STAGE'
  expiringContracts30d?: boolean
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
  contractType?: ContractType
  contractEndDate?: string
  entryDate?: string
}

export type UpdateEmployeePayload = {
  firstName?: string
  lastName?: string
  email?: string
  department?: string
  position?: string
  departmentId?: string | null
  serviceId?: string | null
  contractType?: ContractType | null
  contractEndDate?: string | null
  entryDate?: string | null
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
  /** Lignes correspondant à un matricule déjà connu, fiche mise à jour */
  updated: number
  errors: number
  errorDetails: ImportEmployeeErrorDetail[]
}

/** Événements SSE pendant POST /users/import/async */
export type ImportProgressEvent =
  | { kind: 'parsing' }
  | { kind: 'start'; total: number; sourceTotal: number }
  | {
      kind: 'progress'
      processed: number
      total: number
      created: number
      updated: number
      errors: number
    }
  | { kind: 'done'; report: ImportEmployeesReport }
  | { kind: 'error'; message: string }

/** Séparateur pour découper « nom complet » (aligné backend). */
export type ImportFullNameSeparator = ' ' | ',' | '-'

/** Cartes libellé fichier → UUID après résolution organisationnelle. */
export type OrgLabelMapsPayload = {
  directionMap?: Record<string, string>
  departmentMap?: Record<string, string>
  serviceMap?: Record<string, string>
  ignoredDirections?: string[]
  ignoredDepartments?: string[]
  ignoredServices?: string[]
}

/** Corps JSON envoyé en champ multipart `importConfig`. */
export type UserImportConfigPayload = {
  mappings: {
    matricule: string
    prenom?: string
    nom?: string
    email: string
    direction?: string
    departement?: string
    service?: string
    poste?: string
    contractType?: string
    contractEndDate?: string
    entryDate?: string
  }
  splitFullName?: {
    column: string
    separator: ImportFullNameSeparator
  }
  rowIndices?: number[]
  orgLabelMaps?: OrgLabelMapsPayload
}

/** Ligne normalisée pour validation / import JSON (aligné backend). */
export type ImportRowDto = {
  rowIndex: number
  employeeId?: string
  firstName: string
  lastName: string
  email: string
  position?: string
  departmentId?: string
  departmentName?: string
  serviceId?: string
  serviceName?: string
  directionId?: string
  directionName?: string
  contractType?: string
  contractEndDate?: string
  entryDate?: string
}

export type InitiateDepartureDto = {
  departureType: DepartureType
  departureDate: string
  reason?: string
  noticeEndDate?: string
}

export type BulkDepartureDto = {
  userIds: string[]
  departureType: DepartureType
  departureDate: string
  reason?: string
}

export type ReinstateDto = {
  newContractEndDate?: string
}

export type ExpiringContractRow = {
  user: EmployeeUser
  daysRemaining: number
}

export type ValidationError = {
  field: string
  message: string
  code: string
  suggestion?: string
}

export type ValidationWarning = {
  field: string
  message: string
  code: string
}

export type ValidatedRowStatus = 'ready' | 'update' | 'error' | 'warning'

export type ExistingUserSnapshot = {
  firstName: string
  lastName: string
  email: string
  position?: string | null
  department?: string | null
  service?: string | null
}

export type ValidatedRow = {
  rowIndex: number
  status: ValidatedRowStatus
  data: ImportRowDto
  existingUserId?: string
  existingEmployeeId?: string
  existingSnapshot?: ExistingUserSnapshot
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export type ValidateImportResponse = {
  summary: {
    total: number
    ready: number
    updates: number
    errors: number
    warnings: number
  }
  rows: ValidatedRow[]
}

export type ImportResultDetail = {
  rowIndex: number
  email: string
  employeeId?: string
  /** Présent pour created / updated lorsque le backend renvoie l’id utilisateur */
  userId?: string
  status: 'created' | 'updated' | 'skipped' | 'error'
  errorMessage?: string
  errorField?: string
}

export type ImportResultDto = {
  summary: {
    total: number
    created: number
    updated: number
    skipped: number
    errors: number
  }
  details: ImportResultDetail[]
}

export type BulkActivateDto = {
  userIds: string[]
  sendMethod: 'email' | 'pdf' | 'none'
  generateWhatsappLinks: boolean
  customMessage?: string
  tempPasswordExpiresInHours: number
}

export type ActivatedCredential = {
  userId: string
  firstName: string
  lastName: string
  email: string
  employeeId: string
  department?: string
  service?: string
  tempPassword: string
  whatsappLink?: string
  status: 'activated' | 'already_active' | 'error'
  errorMessage?: string
}

export type BulkActivateResponse = {
  summary: {
    total: number
    activated: number
    emailsSent: number
    emailsFailed: number
    alreadyActive: number
  }
  credentials: ActivatedCredential[]
  pdfDownloadUrl?: string
  emailFailedUserIds?: string[]
}

export type ActivationMessagingConfig = {
  smtpConfigured: boolean
}

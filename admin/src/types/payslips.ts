export type PayslipUserSummary = {
  firstName: string
  lastName: string
  employeeId: string | null
  department: string | null
  /** URL présignée (avatar), absente ou null si pas de photo */
  profilePhotoUrl?: string | null
}

export type Payslip = {
  id: string
  userId: string
  companyId: string
  periodMonth: number
  periodYear: number
  fileUrl: string
  fileSize: number
  uploadedById: string
  uploadedAt: string
  isRead: boolean
  readAt: string | null
  user: PayslipUserSummary
}

/** Réponse de GET /payslips/:id (URL signée pour ouvrir le PDF). */
export type PayslipDetail = Payslip & { presignedUrl: string }

export type PayslipsListMeta = {
  total: number
  page: number
  limit: number
  totalPages: number
}

export type PaginatedPayslipsResponse = {
  data: Payslip[]
  meta: PayslipsListMeta
}

export type QueryPayslipsParams = {
  page?: number
  limit?: number
  userId?: string
  year?: number
  month?: number
}

export type BulkUploadDetail = {
  filename: string
  matricule: string
  status: 'OK' | 'ERROR'
  reason?: string
  fileIndex?: number
  retryable?: boolean
}

export type BulkUploadReport = {
  total: number
  success: number
  failed: number
  /** Fichiers retirés par le RH à l’étape de vérification (fusionné côté client). */
  ignored?: number
  details: BulkUploadDetail[]
}

export type BulkAnalyzeExtracted = {
  matricule?: string
  firstName?: string
  lastName?: string
  fullName?: string
  periodMonth?: number
  periodYear?: number
  confidence: number
}

export type BulkAnalyzeMatch = {
  userId?: string
  employeeName?: string
  employeeId?: string | null
  periodMonth?: number
  periodYear?: number
  matchMethod: 'matricule' | 'name' | 'filename' | 'unmatched'
  confidence: number
}

export type BulkAnalyzeRow = {
  filename: string
  fileIndex: number
  extracted: BulkAnalyzeExtracted
  match: BulkAnalyzeMatch
  status: 'auto_matched' | 'needs_review' | 'unmatched'
  duplicate: boolean
  duplicateReason?: 'database' | 'batch'
  duplicateMessage?: string
  blockingError?: string
}

export type BulkAnalyzeResponse = {
  batchId: string
  analyses: BulkAnalyzeRow[]
}

export type ConfirmBulkAssignment = {
  fileIndex: number
  userId: string
  periodMonth: number
  periodYear: number
}

export type ConfirmBulkPayload = {
  batchId: string
  assignments: ConfirmBulkAssignment[]
}

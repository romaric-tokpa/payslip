export type PayslipUserSummary = {
  firstName: string
  lastName: string
  employeeId: string | null
  department: string | null
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
}

export type BulkUploadReport = {
  total: number
  success: number
  failed: number
  details: BulkUploadDetail[]
}

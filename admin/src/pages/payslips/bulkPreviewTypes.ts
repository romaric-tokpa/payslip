import type { EmployeeUser } from '../../types/employees'

export type BulkPreviewStatus =
  | 'invalid_format'
  | 'oversized'
  | 'invalid_period'
  | 'checking'
  | 'not_found'
  | 'ready'

export type BulkPreviewRow = {
  key: string
  file: File
  fileName: string
  matricule: string | null
  month: number | null
  year: number | null
  user: EmployeeUser | null
  collaboratorLabel: string | null
  status: BulkPreviewStatus
}

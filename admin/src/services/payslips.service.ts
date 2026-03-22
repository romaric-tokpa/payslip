import { AxiosHeaders } from 'axios'
import { api } from './api'
import type {
  BulkAnalyzeResponse,
  BulkUploadReport,
  ConfirmBulkPayload,
  PaginatedPayslipsResponse,
  Payslip,
  PayslipDetail,
  QueryPayslipsParams,
} from '../types/payslips'

function payslipQueryToParams(
  p: QueryPayslipsParams,
): Record<string, string | number> {
  const q: Record<string, string | number> = {}
  if (p.page != null) q.page = p.page
  if (p.limit != null) q.limit = p.limit
  if (p.userId != null && p.userId !== '') q.userId = p.userId
  if (p.year != null) q.year = p.year
  if (p.month != null) q.month = p.month
  return q
}

function multipartHeaders(): AxiosHeaders {
  const headers = new AxiosHeaders()
  headers.delete('Content-Type')
  return headers
}

export async function uploadSingle(
  file: File,
  userId: string,
  periodMonth: number,
  periodYear: number,
): Promise<Payslip> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('userId', userId)
  formData.append('periodMonth', String(periodMonth))
  formData.append('periodYear', String(periodYear))
  const { data } = await api.post<Payslip>('/payslips/upload', formData, {
    headers: multipartHeaders(),
  })
  return data
}

export async function uploadBulk(
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<BulkUploadReport> {
  const formData = new FormData()
  for (const f of files) {
    formData.append('files', f)
  }
  const { data } = await api.post<BulkUploadReport>(
    '/payslips/upload-bulk',
    formData,
    {
      headers: multipartHeaders(),
      onUploadProgress: (evt) => {
        if (evt.total != null && evt.total > 0 && onProgress) {
          onProgress(Math.round((evt.loaded * 100) / evt.total))
        }
      },
    },
  )
  return data
}

export async function analyzeBulkPayslips(
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<BulkAnalyzeResponse> {
  const formData = new FormData()
  for (const f of files) {
    formData.append('files', f)
  }
  const { data } = await api.post<BulkAnalyzeResponse>(
    '/payslips/analyze-bulk',
    formData,
    {
      headers: multipartHeaders(),
      timeout: 300_000,
      onUploadProgress: (evt) => {
        if (evt.total != null && evt.total > 0 && onProgress) {
          onProgress(Math.round((evt.loaded * 100) / evt.total))
        }
      },
    },
  )
  return data
}

export async function confirmBulkPayslips(
  body: ConfirmBulkPayload,
): Promise<BulkUploadReport> {
  const { data } = await api.post<BulkUploadReport>(
    '/payslips/confirm-bulk',
    body,
    { timeout: 300_000 },
  )
  return data
}

export async function getPayslips(
  params: QueryPayslipsParams,
): Promise<PaginatedPayslipsResponse> {
  const { data } = await api.get<PaginatedPayslipsResponse>('/payslips', {
    params: payslipQueryToParams(params),
  })
  return data
}

/** Indique si un bulletin existe déjà pour ce collaborateur et cette période. */
export async function payslipExistsForUserPeriod(
  userId: string,
  periodMonth: number,
  periodYear: number,
): Promise<boolean> {
  const res = await getPayslips({
    userId,
    month: periodMonth,
    year: periodYear,
    page: 1,
    limit: 1,
  })
  return res.meta.total > 0
}

export async function getPayslipById(id: string): Promise<PayslipDetail> {
  const { data } = await api.get<PayslipDetail>(`/payslips/${id}`)
  return data
}

export async function deletePayslip(id: string): Promise<void> {
  await api.delete(`/payslips/${id}`)
}

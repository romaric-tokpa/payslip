import { AxiosHeaders } from 'axios'
import { api } from './api'
import type {
  BulkUploadReport,
  PaginatedPayslipsResponse,
  Payslip,
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

export async function getPayslips(
  params: QueryPayslipsParams,
): Promise<PaginatedPayslipsResponse> {
  const { data } = await api.get<PaginatedPayslipsResponse>('/payslips', {
    params: payslipQueryToParams(params),
  })
  return data
}

export async function deletePayslip(id: string): Promise<void> {
  await api.delete(`/payslips/${id}`)
}

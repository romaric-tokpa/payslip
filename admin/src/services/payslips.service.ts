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
import type {
  PayslipSignatureStatsResponse,
  PayslipUnsignedRow,
  VerifySignatureResponse,
} from '../types/payslip-signatures'

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

export async function getPayslipSignatureStats(
  month: number,
  year: number,
): Promise<PayslipSignatureStatsResponse> {
  const { data } = await api.get<PayslipSignatureStatsResponse>(
    '/payslips/signatures/stats',
    { params: { month, year } },
  )
  return data
}

export async function getUnsignedPayslipsForPeriod(
  month: number,
  year: number,
): Promise<PayslipUnsignedRow[]> {
  const { data } = await api.get<PayslipUnsignedRow[]>(
    '/payslips/signatures/unsigned',
    { params: { month, year } },
  )
  return data
}

export async function remindPayslipSignatures(body: {
  month: number
  year: number
  message?: string
  userIds?: string[]
}): Promise<{ reminded: number }> {
  const { data } = await api.post<{ reminded: number }>(
    '/payslips/signatures/remind',
    body,
  )
  return data
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function downloadSignatureCertificate(
  signatureId: string,
): Promise<void> {
  const res = await api.get<Blob>(
    `/payslips/signatures/${signatureId}/certificate`,
    { responseType: 'blob' },
  )
  triggerDownload(res.data, 'certificat-signature.pdf')
}

export async function downloadSignatureComplianceReport(
  month: number,
  year: number,
): Promise<void> {
  const res = await api.get<Blob>('/payslips/signatures/export', {
    params: { month, year },
    responseType: 'blob',
  })
  const fn = `rapport-signatures-${year}-${String(month).padStart(2, '0')}.csv`
  triggerDownload(res.data, fn)
}

export async function verifyPayslipSignaturePublic(
  code: string,
): Promise<VerifySignatureResponse> {
  const c = code.trim().toUpperCase()
  const { data } = await api.get<VerifySignatureResponse>(
    `/payslips/signatures/verify/${encodeURIComponent(c)}`,
  )
  return data
}

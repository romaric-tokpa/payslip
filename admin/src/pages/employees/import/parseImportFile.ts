import Papa from 'papaparse'
import * as XLSX from 'xlsx'

import type { RawImportRow } from './importTransform'

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024

function stripBom(s: string): string {
  if (s.charCodeAt(0) === 0xfeff) return s.slice(1)
  return s
}

function parseCsvText(text: string): { headers: string[]; rows: RawImportRow[] } {
  const result = Papa.parse<Record<string, unknown>>(stripBom(text), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })
  if (result.errors.length > 0 && !(result.data?.length ?? 0)) {
    throw new Error(result.errors.map((e) => e.message).join('; '))
  }
  const data = result.data ?? []
  if (data.length === 0) {
    return { headers: [], rows: [] }
  }
  const headers = Object.keys(data[0] as object).filter(
    (k) => k !== '' && !k.startsWith('__'),
  )
  const rows: RawImportRow[] = data.map((r) => {
    const out: RawImportRow = {}
    for (const h of headers) {
      const v = (r as Record<string, unknown>)[h]
      out[h] =
        v === null || v === undefined
          ? ''
          : typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
            ? String(v).trim()
            : ''
    }
    return out
  })
  return { headers, rows }
}

function parseXlsxArrayBuffer(buf: ArrayBuffer): {
  headers: string[]
  rows: RawImportRow[]
} {
  const wb = XLSX.read(buf, { type: 'array', cellDates: false })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [] }
  const sheet = wb.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })
  if (raw.length === 0) return { headers: [], rows: [] }
  const headers = Object.keys(raw[0] as object).map((k) => k.trim())
  const rows: RawImportRow[] = raw.map((row) => {
    const out: RawImportRow = {}
    for (const [k, v] of Object.entries(row)) {
      const key = k.trim()
      out[key] =
        v === null || v === undefined
          ? ''
          : typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
            ? String(v).trim()
            : ''
    }
    return out
  })
  return { headers, rows }
}

export async function parseEmployeeImportFile(
  file: File,
): Promise<{ headers: string[]; rows: RawImportRow[] }> {
  if (file.size > IMPORT_MAX_BYTES) {
    throw new Error('Fichier trop volumineux (max 5 Mo)')
  }
  const n = file.name.trim().toLowerCase()
  if (n.endsWith('.csv')) {
    const text = await file.text()
    return parseCsvText(text)
  }
  if (n.endsWith('.xlsx') || n.endsWith('.xls')) {
    const buf = await file.arrayBuffer()
    return parseXlsxArrayBuffer(buf)
  }
  throw new Error('Utilisez un fichier .csv, .xlsx ou .xls')
}

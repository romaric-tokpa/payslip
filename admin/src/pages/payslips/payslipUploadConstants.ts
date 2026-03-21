/** Aligné sur la spec UI (forme compacte …MMYYYY.pdf). */
export const BULK_FILENAME_RE = /^(.+)(\d{2})(\d{4})\.pdf$/i

export const MAX_PDF_BYTES = 10 * 1024 * 1024

export const MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const

export function yearOptions(): number[] {
  const end = new Date().getFullYear() + 1
  const out: number[] = []
  for (let y = 2024; y <= end; y += 1) {
    out.push(y)
  }
  return out
}

export function formatEmployeeOption(u: {
  employeeId: string | null
  lastName: string
  firstName: string
}): string {
  const m = u.employeeId?.trim() || '—'
  return `${m} — ${u.lastName} ${u.firstName}`.trim()
}

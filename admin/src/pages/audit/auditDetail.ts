import type { AuditLog } from '../../types/audit'
import { MONTHS_FR } from '../payslips/payslipUploadConstants'

function periodPhrase(meta: unknown): string | null {
  if (meta == null || typeof meta !== 'object') {
    return null
  }
  const m = meta as Record<string, unknown>
  const pm =
    typeof m.periodMonth === 'number'
      ? m.periodMonth
      : typeof m.periodMonth === 'string'
        ? Number(m.periodMonth)
        : undefined
  const py =
    typeof m.periodYear === 'number'
      ? m.periodYear
      : typeof m.periodYear === 'string'
        ? Number(m.periodYear)
        : undefined
  if (
    pm == null ||
    py == null ||
    pm < 1 ||
    pm > 12 ||
    Number.isNaN(py)
  ) {
    return null
  }
  const label = MONTHS_FR[pm - 1]
  return `${label.toLowerCase()} ${py}`
}

/** Libellé court aligné sur le backend (export CSV). */
export function formatAuditDetail(row: AuditLog): string {
  const pp = periodPhrase(row.metadata)
  switch (row.action) {
    case 'LOGIN_SUCCESS':
      return 'Connexion réussie'
    case 'LOGIN_FAILED':
      return 'Échec de connexion'
    case 'PASSWORD_CHANGED':
      return 'Mot de passe modifié'
    case 'USER_DEACTIVATED':
      return 'Collaborateur désactivé'
    case 'USER_REACTIVATED':
      return 'Collaborateur réactivé'
    case 'PAYSLIP_UPLOADED':
      return pp ? `Bulletin téléversé — ${pp}` : 'Bulletin téléversé'
    case 'PAYSLIP_READ':
      return pp ? `Bulletin consulté — ${pp}` : 'Bulletin consulté (marqué lu)'
    case 'PAYSLIP_DELETED':
      return pp ? `Bulletin supprimé — ${pp}` : 'Bulletin supprimé'
    case 'COMPANY_LEGAL_INFO_UPDATED':
      return 'Informations légales de l’entreprise mises à jour'
    case 'SUPER_ADMIN_IMPERSONATE':
      return 'Connexion en tant qu’admin entreprise (impersonation)'
    default:
      return row.entityType
        ? `${row.action} (${row.entityType})`
        : row.action
  }
}

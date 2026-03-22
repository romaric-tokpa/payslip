import { ADMIN_BASE } from '../constants/adminRoutes'
import {
  PAYSLIP_IMPERSONATION_HANDOFF_TTL_MS,
  PAYSLIP_IMPERSONATION_MESSAGE,
  PAYSLIP_IMPERSONATION_QUERY_PARAM,
  PAYSLIP_IMPERSONATION_STORAGE_PREFIX,
} from '../constants/impersonation'
import type { AuthSessionPayload } from '../types/auth'

/**
 * Ouvre le dashboard RH dans un nouvel onglet.
 * 1) Dépose la session dans `localStorage` + URL `?impersonate=` (consommée dans
 *    `AuthContext` **avant** le refresh JWT — évite le 401 si le stockage partagé
 *    contenait encore la session super-admin).
 * 2) Envoie aussi `postMessage` en secours (login / timing navigateur).
 */
export function openAdminTabWithImpersonationSession(
  payload: AuthSessionPayload,
): boolean {
  const nonce = crypto.randomUUID()
  const key = `${PAYSLIP_IMPERSONATION_STORAGE_PREFIX}${nonce}`
  const record = {
    payload,
    exp: Date.now() + PAYSLIP_IMPERSONATION_HANDOFF_TTL_MS,
  }
  try {
    localStorage.setItem(key, JSON.stringify(record))
  } catch {
    /* quota / mode privé : on s’appuie sur postMessage uniquement */
  }

  const url = `${window.location.origin}${ADMIN_BASE}?${PAYSLIP_IMPERSONATION_QUERY_PARAM}=${encodeURIComponent(nonce)}`
  const child = window.open(url, '_blank')
  if (!child) {
    return false
  }
  try {
    child.focus()
  } catch {
    /* certains navigateurs restreignent focus cross-fenêtre */
  }
  let sent = 0
  const max = 60
  const interval = window.setInterval(() => {
    try {
      child.postMessage(
        { type: PAYSLIP_IMPERSONATION_MESSAGE, payload },
        window.location.origin,
      )
    } catch {
      window.clearInterval(interval)
      return
    }
    sent += 1
    if (sent >= max) {
      window.clearInterval(interval)
    }
  }, 150)
  return true
}

import {
  PAYSLIP_IMPERSONATION_QUERY_PARAM,
  PAYSLIP_IMPERSONATION_STORAGE_PREFIX,
} from '../constants/impersonation'
import type { AuthSessionPayload } from '../types/auth'

type HandoffRecord = {
  payload: AuthSessionPayload
  exp: number
}

function isUuidLike(s: string): boolean {
  return (
    s.length >= 32 &&
    s.length <= 40 &&
    /^[0-9a-f-]+$/i.test(s) &&
    (s.match(/-/g) ?? []).length === 4
  )
}

function stripHandoffQueryFromUrl(): void {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(PAYSLIP_IMPERSONATION_QUERY_PARAM)) {
    return
  }
  url.searchParams.delete(PAYSLIP_IMPERSONATION_QUERY_PARAM)
  const next = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState({}, '', next)
}

/**
 * Au premier chargement : si l’URL contient `?impersonate=<nonce>`, lit la session
 * déposée dans `localStorage` par l’onglet super-admin (avant tout refresh JWT).
 * Évite d’appliquer la session SUPER_ADMIN partagée puis d’envoyer un mauvais Bearer.
 */
export function tryConsumeImpersonationHandoffFromUrl(): AuthSessionPayload | null {
  if (typeof window === 'undefined') {
    return null
  }
  const params = new URLSearchParams(window.location.search)
  const nonce = params.get(PAYSLIP_IMPERSONATION_QUERY_PARAM)?.trim()
  if (!nonce || !isUuidLike(nonce)) {
    return null
  }

  const key = `${PAYSLIP_IMPERSONATION_STORAGE_PREFIX}${nonce}`
  const raw = localStorage.getItem(key)
  localStorage.removeItem(key)

  if (!raw) {
    stripHandoffQueryFromUrl()
    return null
  }

  try {
    const parsed = JSON.parse(raw) as HandoffRecord
    const p = parsed?.payload
    if (
      typeof parsed?.exp !== 'number' ||
      Date.now() > parsed.exp ||
      !p?.user ||
      typeof p.accessToken !== 'string' ||
      typeof p.refreshToken !== 'string'
    ) {
      stripHandoffQueryFromUrl()
      return null
    }
    stripHandoffQueryFromUrl()
    return p
  } catch {
    stripHandoffQueryFromUrl()
    return null
  }
}

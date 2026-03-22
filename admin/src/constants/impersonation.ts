/** `postMessage` entre l’onglet super-admin et l’onglet cible (dashboard RH). */
export const PAYSLIP_IMPERSONATION_MESSAGE = 'PAYSLIP_IMPERSONATION' as const

/** Query sur `/dashboard` : jeton unique pour retrouver la session dans `localStorage`. */
export const PAYSLIP_IMPERSONATION_QUERY_PARAM = 'impersonate' as const

export const PAYSLIP_IMPERSONATION_STORAGE_PREFIX =
  'payslip_impersonation_handoff_' as const

/** Durée de validité du paquet (évite d’appliquer une vieille session). */
export const PAYSLIP_IMPERSONATION_HANDOFF_TTL_MS = 120_000

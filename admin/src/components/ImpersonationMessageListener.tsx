import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ADMIN_BASE } from '../constants/adminRoutes'
import { PAYSLIP_IMPERSONATION_MESSAGE } from '../constants/impersonation'
import { useAuth } from '../contexts/AuthContext'
import type { AuthSessionPayload } from '../types/auth'

/**
 * Écoute `postMessage` pour la session RH après « Se connecter en tant que »
 * (super-admin). Doit rester monté sur toutes les routes (y compris /login) :
 * l’onglet ouvert n’atteint pas AdminLayout tant qu’il n’est pas authentifié.
 */
export function ImpersonationMessageListener() {
  const navigate = useNavigate()
  const { signInWithPayload } = useAuth()
  const signInRef = useRef(signInWithPayload)
  const navigateRef = useRef(navigate)
  signInRef.current = signInWithPayload
  navigateRef.current = navigate

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (ev.origin !== window.location.origin) {
        return
      }
      if (ev.data?.type !== PAYSLIP_IMPERSONATION_MESSAGE) {
        return
      }
      const payload = ev.data.payload as AuthSessionPayload
      if (
        !payload?.user ||
        typeof payload.accessToken !== 'string' ||
        typeof payload.refreshToken !== 'string'
      ) {
        return
      }
      signInRef.current(payload)
      navigateRef.current(ADMIN_BASE, { replace: true })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return null
}

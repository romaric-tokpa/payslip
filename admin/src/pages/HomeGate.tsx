import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ADMIN_BASE, SUPER_ADMIN_BASE } from '../constants/adminRoutes'
import { LandingPage } from './landing/LandingPage'

/**
 * `/` : landing si invité, redirection vers l’app admin si session valide.
 */
export function HomeGate() {
  const { isLoading, isAuthenticated, user } = useAuth()

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8f9fa',
        }}
      >
        <span style={{ color: '#7f8c8d', fontSize: 14 }}>Chargement…</span>
      </div>
    )
  }

  if (isAuthenticated && user) {
    if (user.mustChangePassword) {
      return <Navigate to="/password-required" replace />
    }
    if (user.role === 'SUPER_ADMIN') {
      return <Navigate to={SUPER_ADMIN_BASE} replace />
    }
    return <Navigate to={ADMIN_BASE} replace />
  }

  return <LandingPage />
}

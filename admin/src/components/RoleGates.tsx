import { Spin } from 'antd'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ADMIN_BASE, SUPER_ADMIN_BASE } from '../constants/adminRoutes'
import { useAuth } from '../contexts/AuthContext'

const PASSWORD_REQUIRED_PATH = '/password-required'

/** Tant que `mustChangePassword` est vrai, seul `/password-required` est accessible. */
export function RequirePasswordChangeGate() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '40vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  if (user?.mustChangePassword && location.pathname !== PASSWORD_REQUIRED_PATH) {
    return <Navigate to={PASSWORD_REQUIRED_PATH} replace />
  }

  return <Outlet />
}

/** Bloque les SUPER_ADMIN hors espace console (redirige vers `/super-admin`). */
export function RequireNotSuperAdmin() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '40vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  if (user?.role === 'SUPER_ADMIN') {
    return <Navigate to={SUPER_ADMIN_BASE} replace />
  }

  return <Outlet />
}

/** Réservé au rôle SUPER_ADMIN. */
export function RequireSuperAdmin() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '40vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return <Navigate to={ADMIN_BASE} replace />
  }

  return <Outlet />
}

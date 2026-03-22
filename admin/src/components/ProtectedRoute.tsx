import { Spin } from 'antd'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const PUBLIC_HOME_PATHS = new Set(['/', '/landing'])

export function ProtectedRoute() {
  const { isLoading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  if (!isAuthenticated) {
    const returnPath = `${location.pathname}${location.search}`
    const qs =
      returnPath && !PUBLIC_HOME_PATHS.has(location.pathname)
        ? `?returnUrl=${encodeURIComponent(returnPath)}`
        : ''
    return <Navigate to={`/login${qs}`} replace />
  }

  return <Outlet />
}

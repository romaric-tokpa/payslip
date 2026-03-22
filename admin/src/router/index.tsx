import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { AdminLayout } from '../layouts/AdminLayout'
import { ADMIN_BASE } from '../constants/adminRoutes'
import { AuditPage } from '../pages/audit/AuditPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { EmployeesPage } from '../pages/employees/EmployeesPage'
import { ImportPage } from '../pages/employees/ImportPage'
import { HomeGate } from '../pages/HomeGate'
import { LandingPage } from '../pages/landing/LandingPage'
import { OrgChartPage } from '../pages/orgchart/OrgChartPage'
import { PayslipUploadPage } from '../pages/payslips/PayslipUploadPage'
import { PayslipsPage } from '../pages/PayslipsPage'
import { SettingsPage } from '../pages/settings/SettingsPage'
import { AuthRoutesShell } from '../components/transitions/RouteTransitions'
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage'
import { LoginPage } from '../pages/auth/LoginPage'
import { RegisterPage } from '../pages/auth/RegisterPage'
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage'

export function RouterConfig() {
  return (
    <Routes>
      <Route path="/" element={<HomeGate />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route element={<AuthRoutesShell />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path={ADMIN_BASE} element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="employees/import" element={<ImportPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="payslips/upload" element={<PayslipUploadPage />} />
          <Route path="payslips" element={<PayslipsPage />} />
          <Route path="orgchart" element={<OrgChartPage />} />
          <Route
            path="organization"
            element={<Navigate to={`${ADMIN_BASE}/orgchart`} replace />}
          />
          <Route path="audit" element={<AuditPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

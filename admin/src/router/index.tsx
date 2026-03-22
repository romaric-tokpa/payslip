import { Navigate, Route, Routes } from 'react-router-dom'
import {
  RequireNotSuperAdmin,
  RequirePasswordChangeGate,
  RequireSuperAdmin,
} from '../components/RoleGates'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { AdminLayout } from '../layouts/AdminLayout'
import { SuperAdminLayout } from '../layouts/SuperAdminLayout'
import { ADMIN_BASE, SUPER_ADMIN_BASE } from '../constants/adminRoutes'
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
import { PasswordRequiredPage } from '../pages/auth/PasswordRequiredPage'
import { RegisterPage } from '../pages/auth/RegisterPage'
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage'
import { CompaniesListPage } from '../pages/super-admin/CompaniesListPage'
import { CompanyDetailPage } from '../pages/super-admin/CompanyDetailPage'
import { GlobalAuditPage } from '../pages/super-admin/GlobalAuditPage'
import { GrowthPage } from '../pages/super-admin/GrowthPage'
import { SuperAdminDashboard } from '../pages/super-admin/SuperAdminDashboard'
import { SuperAdminSecurityPage } from '../pages/super-admin/SuperAdminSecurityPage'
import { VerifySignaturePage } from '../pages/VerifySignaturePage'

export function RouterConfig() {
  return (
    <Routes>
      <Route path="/" element={<HomeGate />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/verify" element={<VerifySignaturePage />} />
      <Route element={<AuthRoutesShell />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/password-required" element={<PasswordRequiredPage />} />
        <Route element={<RequirePasswordChangeGate />}>
          <Route element={<RequireSuperAdmin />}>
            <Route path={SUPER_ADMIN_BASE} element={<SuperAdminLayout />}>
              <Route index element={<SuperAdminDashboard />} />
              <Route path="companies" element={<CompaniesListPage />} />
              <Route path="companies/:id" element={<CompanyDetailPage />} />
              <Route path="audit" element={<GlobalAuditPage />} />
              <Route path="growth" element={<GrowthPage />} />
              <Route path="security" element={<SuperAdminSecurityPage />} />
            </Route>
          </Route>
          <Route element={<RequireNotSuperAdmin />}>
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
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

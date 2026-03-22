import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { AdminLayout } from '../layouts/AdminLayout'
import { AuditPage } from '../pages/audit/AuditPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { EmployeesPage } from '../pages/employees/EmployeesPage'
import { ImportPage } from '../pages/employees/ImportPage'
import { OrgChartPage } from '../pages/orgchart/OrgChartPage'
import { PayslipUploadPage } from '../pages/payslips/PayslipUploadPage'
import { PayslipsPage } from '../pages/PayslipsPage'
import { SettingsPage } from '../pages/settings/SettingsPage'
import { LoginPage } from '../pages/auth/LoginPage'

export function RouterConfig() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<AdminLayout />}>
          {/* / → Dashboard */}
          <Route index element={<DashboardPage />} />
          {/* /employees, /employees/import */}
          <Route path="employees/import" element={<ImportPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          {/* /payslips/upload avant /payslips (segment le plus spécifique) */}
          <Route path="payslips/upload" element={<PayslipUploadPage />} />
          <Route path="payslips" element={<PayslipsPage />} />
          {/* /orgchart */}
          <Route path="orgchart" element={<OrgChartPage />} />
          <Route
            path="organization"
            element={<Navigate to="/orgchart" replace />}
          />
          {/* /audit */}
          <Route path="audit" element={<AuditPage />} />
          {/* /settings */}
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

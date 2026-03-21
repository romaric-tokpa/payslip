import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { AdminLayout } from '../layouts/AdminLayout'
import { AuditPage } from '../pages/AuditPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { EmployeesPage } from '../pages/employees/EmployeesPage'
import { PayslipUploadPage } from '../pages/payslips/PayslipUploadPage'
import { PayslipsPage } from '../pages/PayslipsPage'
import { SettingsPage } from '../pages/SettingsPage'
import { LoginPage } from '../pages/auth/LoginPage'

export function RouterConfig() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="payslips/upload" element={<PayslipUploadPage />} />
          <Route path="payslips" element={<PayslipsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

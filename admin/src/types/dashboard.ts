export type MonthlyUploadStat = {
  month: number
  year: number
  count: number
}

export type TopUnreadRow = {
  userId: string
  firstName: string
  lastName: string
  employeeId: string | null
  department: string | null
  lastPayslipPeriod: string
  isRead: boolean
}

export type ExpiringContractDashboardRow = {
  userId: string
  firstName: string
  lastName: string
  employeeId: string | null
  departmentLabel: string | null
  contractEndDate: string
  daysRemaining: number
}

export type DashboardStats = {
  totalEmployees: number
  activeEmployees: number
  newEmployeesThisMonth: number
  payslipsThisMonth: number
  consultationRate: number
  consultationRatePreviousMonth: number
  consultationRateDelta: number
  unreadPayslips: number
  monthlyUploads: MonthlyUploadStat[]
  topUnread: TopUnreadRow[]
  expiringContracts: ExpiringContractDashboardRow[]
  departedThisMonth: number
}

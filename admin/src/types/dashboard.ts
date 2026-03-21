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

export type DashboardStats = {
  totalEmployees: number
  activeEmployees: number
  payslipsThisMonth: number
  consultationRate: number
  unreadPayslips: number
  monthlyUploads: MonthlyUploadStat[]
  topUnread: TopUnreadRow[]
}

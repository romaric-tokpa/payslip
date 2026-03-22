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

export type ConsultationByMonthRow = {
  month: string
  total: number
  read: number
  rate: number
}

export type ConsultationByDepartmentRow = {
  departmentId: string
  departmentName: string
  total: number
  read: number
  rate: number
}

export type PayslipsByMonthChartRow = {
  month: string
  count: number
}

export type UnreadEmployeeMonthRow = {
  payslipId: string
  userId: string
  name: string
  employeeId: string | null
  department: string | null
  distributedAt: string
}

export type RecentPayslipDashboardRow = {
  id: string
  periodMonth: number
  periodYear: number
  uploadedAt: string
  isRead: boolean
  isSigned: boolean
  user: {
    firstName: string
    lastName: string
    employeeId: string | null
  }
}

export type DashboardKpiBlock = {
  totalEmployees: number
  activeEmployeesStrict: number
  departedEmployees: number
  onNoticeEmployees: number
  pendingEmployees: number
  totalPayslips: number
  totalDirections: number
  totalDepartments: number
  totalServices: number
}

export type DashboardStats = {
  totalEmployees: number
  activeEmployees: number
  totalDepartments: number
  totalPayslips: number
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
  requireSignature: boolean
  signatureRateCurrentMonth: number | null
  signaturePeriodMonth: number
  signaturePeriodYear: number
  signaturePeriodSigned: number
  signaturePeriodTotal: number
  kpi: DashboardKpiBlock
  currentMonth: {
    month: number
    year: number
    payslipsDistributed: number
    payslipsRead: number
    consultationRate: number
    newEmployees: number
  }
  trends: {
    consultationRateDelta: number
    payslipsDelta: number
    employeesDelta: number
  }
  charts: {
    consultationByMonth: ConsultationByMonthRow[]
    consultationByDepartment: ConsultationByDepartmentRow[]
    payslipsByMonth: PayslipsByMonthChartRow[]
  }
  unreadEmployeesThisMonth: UnreadEmployeeMonthRow[]
  recentPayslips: RecentPayslipDashboardRow[]
}

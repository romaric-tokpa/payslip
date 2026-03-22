import { ApiProperty } from '@nestjs/swagger';

export class DashboardKpiDto {
  @ApiProperty()
  totalEmployees: number;

  @ApiProperty()
  activeEmployeesStrict: number;

  @ApiProperty()
  departedEmployees: number;

  @ApiProperty()
  onNoticeEmployees: number;

  @ApiProperty()
  pendingEmployees: number;

  @ApiProperty()
  totalPayslips: number;

  @ApiProperty()
  totalDirections: number;

  @ApiProperty()
  totalDepartments: number;

  @ApiProperty()
  totalServices: number;
}

export class DashboardCurrentMonthDto {
  @ApiProperty({
    description:
      'Mois de paie 1–12 ; 0 si agrégat annuel (viewGranularity YEAR)',
  })
  month: number;

  @ApiProperty()
  year: number;

  @ApiProperty({ description: 'Bulletins sur la période de paie du mois civil (UTC)' })
  payslipsDistributed: number;

  @ApiProperty()
  payslipsRead: number;

  @ApiProperty()
  consultationRate: number;

  @ApiProperty()
  newEmployees: number;
}

export class DashboardTrendsDto {
  @ApiProperty({ description: 'Points de % vs mois précédent' })
  consultationRateDelta: number;

  @ApiProperty()
  payslipsDelta: number;

  @ApiProperty()
  employeesDelta: number;
}

export class ConsultationByMonthChartRowDto {
  @ApiProperty({ example: '2025-03' })
  month: string;

  @ApiProperty()
  total: number;

  @ApiProperty()
  read: number;

  @ApiProperty()
  rate: number;
}

export class ConsultationByDepartmentChartRowDto {
  @ApiProperty()
  departmentId: string;

  @ApiProperty()
  departmentName: string;

  @ApiProperty()
  total: number;

  @ApiProperty()
  read: number;

  @ApiProperty()
  rate: number;
}

export class PayslipsByMonthChartRowDto {
  @ApiProperty({ example: '2025-03' })
  month: string;

  @ApiProperty()
  count: number;
}

export class DashboardChartsDto {
  @ApiProperty({ type: [ConsultationByMonthChartRowDto] })
  consultationByMonth: ConsultationByMonthChartRowDto[];

  @ApiProperty({ type: [ConsultationByDepartmentChartRowDto] })
  consultationByDepartment: ConsultationByDepartmentChartRowDto[];

  @ApiProperty({ type: [PayslipsByMonthChartRowDto] })
  payslipsByMonth: PayslipsByMonthChartRowDto[];
}

export class UnreadEmployeeMonthRowDto {
  @ApiProperty()
  payslipId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  employeeId: string | null;

  @ApiProperty({ nullable: true })
  department: string | null;

  @ApiProperty()
  distributedAt: string;

  @ApiProperty({ nullable: true, description: 'URL présignée (S3), TTL court' })
  profilePhotoUrl: string | null;
}

export class RecentPayslipUserDto {
  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ nullable: true })
  employeeId: string | null;

  @ApiProperty({ nullable: true, description: 'URL présignée (S3), TTL court' })
  profilePhotoUrl: string | null;
}

export class RecentPayslipRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  periodMonth: number;

  @ApiProperty()
  periodYear: number;

  @ApiProperty()
  uploadedAt: string;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty()
  isSigned: boolean;

  @ApiProperty({ type: RecentPayslipUserDto })
  user: RecentPayslipUserDto;
}

export class ExpiringContractRowDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ nullable: true })
  employeeId: string | null;

  @ApiProperty({ nullable: true })
  departmentLabel: string | null;

  @ApiProperty()
  contractEndDate: string;

  @ApiProperty()
  daysRemaining: number;
}

export class RemindUnreadResponseDto {
  @ApiProperty()
  reminded: number;
}

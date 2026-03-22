import { ApiProperty } from '@nestjs/swagger';
import {
  DashboardChartsDto,
  DashboardCurrentMonthDto,
  DashboardKpiDto,
  DashboardTrendsDto,
  ExpiringContractRowDto,
  RecentPayslipRowDto,
  UnreadEmployeeMonthRowDto,
} from './enhanced-dashboard.dto';

export class MonthlyUploadStatDto {
  @ApiProperty({ example: 3 })
  month: number;

  @ApiProperty({ example: 2025 })
  year: number;

  @ApiProperty({ example: 12 })
  count: number;
}

export class TopUnreadRowDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ nullable: true })
  employeeId: string | null;

  @ApiProperty({ nullable: true })
  department: string | null;

  @ApiProperty({ example: '03/2025' })
  lastPayslipPeriod: string;

  @ApiProperty()
  isRead: boolean;
}

export class DashboardStatsResponseDto {
  @ApiProperty()
  totalEmployees: number;

  @ApiProperty()
  activeEmployees: number;

  @ApiProperty({ description: 'Nombre de départements' })
  totalDepartments: number;

  @ApiProperty({ description: 'Nombre total de bulletins enregistrés' })
  totalPayslips: number;

  @ApiProperty({
    description: 'Nouveaux comptes collaborateurs créés ce mois (UTC)',
  })
  newEmployeesThisMonth: number;

  @ApiProperty()
  payslipsThisMonth: number;

  @ApiProperty({
    description: 'Pourcentage de bulletins lus (période = mois civil courant)',
  })
  consultationRate: number;

  @ApiProperty({
    description: 'Taux de lecture sur le mois civil précédent (UTC)',
  })
  consultationRatePreviousMonth: number;

  @ApiProperty({
    description: 'Écart en points de pourcentage vs mois précédent',
  })
  consultationRateDelta: number;

  @ApiProperty()
  unreadPayslips: number;

  @ApiProperty({ type: [MonthlyUploadStatDto] })
  monthlyUploads: MonthlyUploadStatDto[];

  @ApiProperty({ type: [TopUnreadRowDto] })
  topUnread: TopUnreadRowDto[];

  @ApiProperty({
    description: 'Signature électronique exigée pour les bulletins',
  })
  requireSignature: boolean;

  @ApiProperty({
    nullable: true,
    description:
      'Taux de signature (%) sur la période de paie du mois civil courant, si option activée et bulletins présents',
  })
  signatureRateCurrentMonth: number | null;

  @ApiProperty({ description: 'Mois de paie (1–12) pour les compteurs signature' })
  signaturePeriodMonth: number;

  @ApiProperty()
  signaturePeriodYear: number;

  @ApiProperty({ description: 'Bulletins signés sur cette période' })
  signaturePeriodSigned: number;

  @ApiProperty({ description: 'Bulletins total sur cette période' })
  signaturePeriodTotal: number;

  @ApiProperty()
  departedThisMonth: number;

  @ApiProperty({ type: [ExpiringContractRowDto] })
  expiringContracts: ExpiringContractRowDto[];

  @ApiProperty({ type: DashboardKpiDto })
  kpi: DashboardKpiDto;

  @ApiProperty({ type: DashboardCurrentMonthDto })
  currentMonth: DashboardCurrentMonthDto;

  @ApiProperty({ type: DashboardTrendsDto })
  trends: DashboardTrendsDto;

  @ApiProperty({ type: DashboardChartsDto })
  charts: DashboardChartsDto;

  @ApiProperty({ type: [UnreadEmployeeMonthRowDto] })
  unreadEmployeesThisMonth: UnreadEmployeeMonthRowDto[];

  @ApiProperty({ type: [RecentPayslipRowDto] })
  recentPayslips: RecentPayslipRowDto[];

  @ApiProperty({ enum: ['MONTH', 'YEAR'] })
  viewGranularity: 'MONTH' | 'YEAR';
}

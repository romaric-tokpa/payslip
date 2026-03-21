import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty()
  payslipsThisMonth: number;

  @ApiProperty({
    description: 'Pourcentage de bulletins lus (période = mois civil courant)',
  })
  consultationRate: number;

  @ApiProperty()
  unreadPayslips: number;

  @ApiProperty({ type: [MonthlyUploadStatDto] })
  monthlyUploads: MonthlyUploadStatDto[];

  @ApiProperty({ type: [TopUnreadRowDto] })
  topUnread: TopUnreadRowDto[];
}

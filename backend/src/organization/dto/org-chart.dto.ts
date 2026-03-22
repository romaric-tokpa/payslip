import { ApiProperty } from '@nestjs/swagger';

export class OrgChartEmployeeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ nullable: true })
  position!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Service structuré du collaborateur (libellé)',
  })
  serviceName!: string | null;
}

export class OrgChartServiceNodeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: [OrgChartEmployeeDto] })
  employees!: OrgChartEmployeeDto[];
}

export class OrgChartDepartmentNodeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: [OrgChartServiceNodeDto] })
  services!: OrgChartServiceNodeDto[];

  @ApiProperty({
    type: [OrgChartEmployeeDto],
    description:
      'Collaborateurs rattachés au département sans service lié à ce département, ou avec service « hors » département',
  })
  employees!: OrgChartEmployeeDto[];
}

export class OrgChartDirectionNodeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: [OrgChartDepartmentNodeDto] })
  departments!: OrgChartDepartmentNodeDto[];
}

export class OrgChartResponseDto {
  @ApiProperty()
  companyName!: string;

  @ApiProperty({ type: [OrgChartDirectionNodeDto] })
  directions!: OrgChartDirectionNodeDto[];

  @ApiProperty({ type: [OrgChartDepartmentNodeDto] })
  departmentsWithoutDirection!: OrgChartDepartmentNodeDto[];

  @ApiProperty({ type: [OrgChartServiceNodeDto] })
  orphanServices!: OrgChartServiceNodeDto[];
}

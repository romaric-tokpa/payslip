import { ApiProperty } from '@nestjs/swagger';

export class OrgTreeCompanyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Collaborateurs actifs (rôle EMPLOYEE)' })
  totalEmployees!: number;
}

export class OrgTreeServiceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  employeeCount!: number;

  @ApiProperty({ format: 'uuid', nullable: true })
  departmentId!: string | null;
}

export class OrgTreeDepartmentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  employeeCount!: number;

  @ApiProperty({ format: 'uuid', nullable: true })
  directionId!: string | null;

  @ApiProperty({ type: [OrgTreeServiceDto] })
  services!: OrgTreeServiceDto[];
}

export class OrgTreeDirectionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    description:
      'Somme des collaborateurs des départements rattachés (via affectation `departmentId`)',
  })
  employeeCount!: number;

  @ApiProperty({ type: [OrgTreeDepartmentDto] })
  departments!: OrgTreeDepartmentDto[];
}

export class OrgTreeResponseDto {
  @ApiProperty({ type: OrgTreeCompanyDto })
  company!: OrgTreeCompanyDto;

  @ApiProperty({
    type: [OrgTreeDirectionDto],
    description:
      'Peut inclure en fin de liste une entrée virtuelle « Sans direction » (id fixe documenté).',
  })
  directions!: OrgTreeDirectionDto[];
}

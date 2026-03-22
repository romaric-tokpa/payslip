import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginEmployeeDto {
  @ApiProperty({
    example: 'EMP-001',
    description: 'Matricule du collaborateur (identifiant unique par entreprise)',
  })
  @IsString()
  @MinLength(1)
  employeeId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password: string;
}

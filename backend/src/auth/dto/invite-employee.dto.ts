import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class InviteEmployeeDto {
  @ApiProperty({ example: 'collab@entreprise.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Fatou' })
  @IsString()
  @MaxLength(120)
  firstName: string;

  @ApiProperty({ example: 'Koné' })
  @IsString()
  @MaxLength(120)
  lastName: string;

  @ApiProperty({ example: 'EMP-1024' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  employeeId: string;

  @ApiPropertyOptional({ example: 'Finance' })
  @IsString()
  @MaxLength(120)
  department?: string;

  @ApiPropertyOptional({ example: 'Comptable' })
  @IsString()
  @MaxLength(120)
  position?: string;

  @ApiPropertyOptional({ description: 'Département (réf. organisation)' })
  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Service (réf. organisation)' })
  @IsOptional()
  @IsUUID('4')
  serviceId?: string;
}

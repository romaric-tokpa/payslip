import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SuperAdminCompaniesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: ['name', 'createdAt', 'employeeCount', 'payslipCount'] })
  @IsOptional()
  @IsIn(['name', 'createdAt', 'employeeCount', 'payslipCount'])
  sortBy?: 'name' | 'createdAt' | 'employeeCount' | 'payslipCount';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /** Plafond relevé pour les listes admin (ex. filtres audit : chargement des entreprises). */
  @ApiPropertyOptional({ minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({ description: 'trial | starter | business | enterprise' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  plan?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'trial'] })
  @IsOptional()
  @IsIn(['active', 'inactive', 'trial'])
  status?: 'active' | 'inactive' | 'trial';
}

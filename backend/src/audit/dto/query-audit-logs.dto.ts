import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class QueryAuditLogsDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filtre action exacte (ex. LOGIN_SUCCESS)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string;

  @ApiPropertyOptional({ description: 'Filtre type d’entité exact (ex. User, Payslip)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @ApiPropertyOptional({
    description: 'Date/heure de début (ISO 8601), inclus',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  from?: string;

  @ApiPropertyOptional({
    description: 'Date/heure de fin (ISO 8601), inclus',
    example: '2025-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  to?: string;

  @ApiPropertyOptional({
    description: 'Recherche libre : e-mail, prénom, nom, action, type, id entité',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

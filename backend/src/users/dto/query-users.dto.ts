import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QueryUsersDto {
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

  @ApiPropertyOptional({ description: 'Recherche prénom, nom ou matricule' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Filtre libellé département (texte historique, égalité exacte)',
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    description: 'Filtre par département (UUID structure)',
  })
  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Filtre par direction (UUID) via le département',
  })
  @IsOptional()
  @IsUUID('4')
  directionId?: string;

  @ApiPropertyOptional({
    enum: ['all', 'active', 'inactive', 'pending_password'],
    description:
      'Statut d’activation : actifs (compte actif et MDP définitif), inactifs, en attente de changement de MDP',
  })
  @IsOptional()
  @IsIn(['all', 'active', 'inactive', 'pending_password'])
  activationStatus?: 'all' | 'active' | 'inactive' | 'pending_password';

  @ApiPropertyOptional({
    enum: [
      'all',
      'active',
      'on_notice',
      'departed',
      'pending',
      'archived',
    ],
    description:
      'Filtre cycle de vie : actifs (ACTIVE+ON_NOTICE), préavis, sortis, attente activation, archivés',
  })
  @IsOptional()
  @IsIn([
    'all',
    'active',
    'on_notice',
    'departed',
    'pending',
    'archived',
  ])
  employmentFilter?:
    | 'all'
    | 'active'
    | 'on_notice'
    | 'departed'
    | 'pending'
    | 'archived';

  @ApiPropertyOptional({
    enum: ['all', 'CDI', 'CDD', 'INTERIM', 'STAGE'],
  })
  @IsOptional()
  @IsIn(['all', 'CDI', 'CDD', 'INTERIM', 'STAGE'])
  contractType?: 'all' | 'CDI' | 'CDD' | 'INTERIM' | 'STAGE';

  @ApiPropertyOptional({
    description:
      'Si true : CDD / intérim / stage dont la fin de contrat est dans les 30 prochains jours',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  expiringContracts30d?: boolean;
}

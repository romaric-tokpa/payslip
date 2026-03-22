import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrgRowForResolveDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  direction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  service?: string;
}

/** Agrégats calculés côté client (évite d’envoyer une ligne par collaborateur — limite 413). */
export class OrgServiceDepartmentEdgeDto {
  @ApiProperty({ description: 'normalizeString du libellé service (ligne)' })
  @IsString()
  serviceNorm!: string;

  @ApiProperty({ description: 'Libellé département brut (affichage / match parent)' })
  @IsString()
  departmentRaw!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  count!: number;
}

export class OrgDepartmentDirectionEdgeDto {
  @ApiProperty({ description: 'normalizeString du libellé département (ligne)' })
  @IsString()
  departmentNorm!: string;

  @ApiProperty()
  @IsString()
  directionRaw!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  count!: number;
}

export class OrgResolveAggregatesDto {
  @ApiProperty({
    description: 'Nombre de lignes par direction (clé = normalizeString du libellé)',
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  @IsObject()
  directionCounts!: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  @IsObject()
  departmentCounts!: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  @IsObject()
  serviceCounts!: Record<string, number>;

  @ApiProperty({ type: [OrgServiceDepartmentEdgeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrgServiceDepartmentEdgeDto)
  serviceDepartmentEdges!: OrgServiceDepartmentEdgeDto[];

  @ApiProperty({ type: [OrgDepartmentDirectionEdgeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrgDepartmentDirectionEdgeDto)
  departmentDirectionEdges!: OrgDepartmentDirectionEdgeDto[];
}

function toStringArray(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? (value as unknown[]).map((v) => String(v)) : [];
}

export class ResolveOrgDto {
  @ApiProperty({ type: [String], default: [] })
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  directions: string[] = [];

  @ApiProperty({ type: [String], default: [] })
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  departments: string[] = [];

  @ApiProperty({ type: [String], default: [] })
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  services: string[] = [];

  @ApiPropertyOptional({
    type: [OrgRowForResolveDto],
    description:
      'Lignes du fichier (direction / département / service) pour comptages et suggestions de parent à 80 %',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrgRowForResolveDto)
  orgRows?: OrgRowForResolveDto[];

  @ApiPropertyOptional({
    type: OrgResolveAggregatesDto,
    description:
      'Préféré à orgRows : comptages et cooccurrences (fichiers volumineux)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrgResolveAggregatesDto)
  orgAggregates?: OrgResolveAggregatesDto;
}

export type OrgResolutionStatus = 'existing' | 'similar' | 'new';

export class OrgResolutionItemDto {
  @ApiProperty()
  value!: string;

  @ApiProperty()
  normalizedValue!: string;

  @ApiProperty({ enum: ['existing', 'similar', 'new'] })
  status!: OrgResolutionStatus;

  @ApiPropertyOptional()
  existingId?: string;

  @ApiPropertyOptional()
  existingName?: string;

  @ApiPropertyOptional()
  suggestedId?: string;

  @ApiPropertyOptional()
  suggestedName?: string;

  @ApiPropertyOptional()
  suggestedParentId?: string;

  @ApiPropertyOptional()
  suggestedParentName?: string;

  @ApiProperty()
  lineCount!: number;
}

export class ResolveOrgResponseDto {
  @ApiProperty({ type: [OrgResolutionItemDto] })
  directions!: OrgResolutionItemDto[];

  @ApiProperty({ type: [OrgResolutionItemDto] })
  departments!: OrgResolutionItemDto[];

  @ApiProperty({ type: [OrgResolutionItemDto] })
  services!: OrgResolutionItemDto[];
}

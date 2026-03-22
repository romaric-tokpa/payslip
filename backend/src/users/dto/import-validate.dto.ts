import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ImportRowDto {
  @ApiProperty({ description: 'Indice 0-based de la ligne dans le fichier' })
  @IsInt()
  @Min(0)
  rowIndex!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  employeeId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  lastName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  departmentName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  serviceName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  directionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  directionName?: string;
}

export class ValidateImportBodyDto {
  @ApiProperty({ type: [ImportRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows!: ImportRowDto[];
}

export class CommitImportBodyDto {
  @ApiProperty({ type: [ImportRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows!: ImportRowDto[];
}

export class ValidationErrorDto {
  @ApiProperty()
  field!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  code!: string;

  @ApiPropertyOptional()
  suggestion?: string;
}

export class ValidationWarningDto {
  @ApiProperty()
  field!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  code!: string;
}

export class ExistingUserSnapshotDto {
  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  position?: string | null;

  @ApiPropertyOptional({ description: 'Libellé département (structuré ou texte libre)' })
  department?: string | null;

  @ApiPropertyOptional()
  service?: string | null;
}

export class ValidatedRowDto {
  @ApiProperty()
  rowIndex!: number;

  @ApiProperty({ enum: ['ready', 'update', 'error', 'warning'] })
  status!: 'ready' | 'update' | 'error' | 'warning';

  @ApiProperty({ type: ImportRowDto })
  data!: ImportRowDto;

  @ApiPropertyOptional()
  existingUserId?: string;

  @ApiPropertyOptional()
  existingEmployeeId?: string;

  @ApiPropertyOptional({
    type: ExistingUserSnapshotDto,
    description: 'Présent si status = update : valeurs actuelles en base pour comparaison',
  })
  existingSnapshot?: ExistingUserSnapshotDto;

  @ApiProperty({ type: [ValidationErrorDto] })
  errors!: ValidationErrorDto[];

  @ApiProperty({ type: [ValidationWarningDto] })
  warnings!: ValidationWarningDto[];
}

export class ValidateImportResponseDto {
  @ApiProperty()
  summary!: {
    total: number;
    ready: number;
    updates: number;
    errors: number;
    warnings: number;
  };

  @ApiProperty({ type: [ValidatedRowDto] })
  rows!: ValidatedRowDto[];
}

export class ImportResultDetailDto {
  @ApiProperty()
  rowIndex!: number;

  @ApiPropertyOptional({ format: 'uuid' })
  userId?: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  employeeId?: string;

  @ApiProperty({ enum: ['created', 'updated', 'skipped', 'error'] })
  status!: 'created' | 'updated' | 'skipped' | 'error';

  @ApiPropertyOptional()
  errorMessage?: string;

  @ApiPropertyOptional()
  errorField?: string;
}

export class ImportResultDto {
  @ApiProperty()
  summary!: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  };

  @ApiProperty({ type: [ImportResultDetailDto] })
  details!: ImportResultDetailDto[];
}

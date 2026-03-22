import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class BulkActivateDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  userIds!: string[];

  @ApiProperty({ enum: ['email', 'pdf', 'none'] })
  @IsIn(['email', 'pdf', 'none'])
  sendMethod!: 'email' | 'pdf' | 'none';

  @ApiProperty()
  @IsBoolean()
  generateWhatsappLinks!: boolean;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customMessage?: string;

  @ApiPropertyOptional({
    description: 'Durée de validité du mot de passe temporaire (heures)',
    default: 72,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 30)
  tempPasswordExpiresInHours?: number;
}

export class ActivatedCredentialDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiPropertyOptional()
  department?: string;

  @ApiPropertyOptional()
  service?: string;

  @ApiProperty()
  tempPassword!: string;

  @ApiPropertyOptional()
  whatsappLink?: string;

  @ApiProperty({ enum: ['activated', 'already_active', 'error'] })
  status!: 'activated' | 'already_active' | 'error';

  @ApiPropertyOptional()
  errorMessage?: string;
}

export class BulkActivateSummaryDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  activated!: number;

  @ApiProperty()
  emailsSent!: number;

  @ApiProperty()
  emailsFailed!: number;

  @ApiProperty()
  alreadyActive!: number;
}

export class BulkActivateResponseDto {
  @ApiProperty({ type: BulkActivateSummaryDto })
  summary!: BulkActivateSummaryDto;

  @ApiProperty({ type: [ActivatedCredentialDto] })
  credentials!: ActivatedCredentialDto[];

  @ApiPropertyOptional({
    description: 'URL présignée (24 h) si sendMethod === pdf',
  })
  pdfDownloadUrl?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Utilisateurs pour lesquels l’envoi SMTP a échoué (réessai possible)',
  })
  emailFailedUserIds?: string[];
}

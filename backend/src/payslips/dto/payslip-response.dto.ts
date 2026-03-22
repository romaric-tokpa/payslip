import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PayslipSignatureSummaryDto {
  @ApiProperty({ description: 'Identifiant de la ligne signature (certificat PDF)' })
  id: string;

  @ApiProperty()
  verificationCode: string;

  @ApiProperty()
  signedAt: Date;
}

export class PayslipUserSummaryDto {
  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiPropertyOptional({ nullable: true })
  employeeId: string | null;

  @ApiPropertyOptional({ nullable: true })
  department: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'URL présignée pour afficher la photo de profil du collaborateur',
  })
  profilePhotoUrl?: string | null;
}

export class PayslipResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  companyId: string;

  @ApiProperty()
  periodMonth: number;

  @ApiProperty()
  periodYear: number;

  @ApiProperty({ description: 'Clé S3' })
  fileUrl: string;

  @ApiProperty()
  fileSize: number;

  @ApiProperty()
  uploadedById: string;

  @ApiProperty()
  uploadedAt: Date;

  @ApiProperty()
  isRead: boolean;

  @ApiPropertyOptional({ nullable: true })
  readAt: Date | null;

  @ApiProperty()
  isSigned: boolean;

  @ApiPropertyOptional({ nullable: true })
  signedAt: Date | null;

  @ApiPropertyOptional({
    type: PayslipSignatureSummaryDto,
    nullable: true,
    description: 'Présent si une signature existe',
  })
  signature?: PayslipSignatureSummaryDto | null;

  @ApiProperty({ type: PayslipUserSummaryDto })
  user: PayslipUserSummaryDto;
}

export class PayslipDetailResponseDto extends PayslipResponseDto {
  @ApiProperty({
    description: 'URL de téléchargement temporaire (S3 présignée)',
  })
  presignedUrl: string;
}

export class PaginatedPayslipsMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class PaginatedPayslipsResponseDto {
  @ApiProperty({ type: [PayslipResponseDto] })
  data: PayslipResponseDto[];

  @ApiProperty({ type: PaginatedPayslipsMetaDto })
  meta: PaginatedPayslipsMetaDto;
}

export class BulkUploadDetailDto {
  @ApiProperty()
  filename: string;

  @ApiProperty()
  matricule: string;

  @ApiProperty({ enum: ['OK', 'ERROR'] })
  status: 'OK' | 'ERROR';

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Index dans le lot analysé (pour réessai ciblé)',
  })
  fileIndex?: number;

  @ApiPropertyOptional({
    description: 'Échec stockage / persistance — peut être rejoué depuis l’admin',
  })
  retryable?: boolean;
}

export class BulkUploadReportDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  success: number;

  @ApiProperty()
  failed: number;

  @ApiPropertyOptional({
    description:
      'Fichiers retirés par le RH à l’étape de vérification (côté client)',
  })
  ignored?: number;

  @ApiProperty({ type: [BulkUploadDetailDto] })
  details: BulkUploadDetailDto[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkAnalyzeExtractedDto {
  @ApiPropertyOptional()
  matricule?: string;

  @ApiPropertyOptional()
  firstName?: string;

  @ApiPropertyOptional()
  lastName?: string;

  @ApiPropertyOptional()
  fullName?: string;

  @ApiPropertyOptional()
  periodMonth?: number;

  @ApiPropertyOptional()
  periodYear?: number;

  @ApiProperty()
  confidence: number;
}

export class BulkAnalyzeMatchDto {
  @ApiPropertyOptional()
  userId?: string;

  @ApiPropertyOptional()
  employeeName?: string;

  @ApiPropertyOptional({ nullable: true })
  employeeId?: string | null;

  @ApiPropertyOptional()
  periodMonth?: number;

  @ApiPropertyOptional()
  periodYear?: number;

  @ApiProperty({
    enum: ['matricule', 'name', 'filename', 'unmatched'],
  })
  matchMethod: 'matricule' | 'name' | 'filename' | 'unmatched';

  @ApiProperty()
  confidence: number;
}

export class BulkAnalyzeRowDto {
  @ApiProperty()
  filename: string;

  @ApiProperty()
  fileIndex: number;

  @ApiProperty({ type: BulkAnalyzeExtractedDto })
  extracted: BulkAnalyzeExtractedDto;

  @ApiProperty({ type: BulkAnalyzeMatchDto })
  match: BulkAnalyzeMatchDto;

  @ApiProperty({
    enum: ['auto_matched', 'needs_review', 'unmatched'],
  })
  status: 'auto_matched' | 'needs_review' | 'unmatched';

  @ApiProperty()
  duplicate: boolean;

  @ApiPropertyOptional({ enum: ['database', 'batch'] })
  duplicateReason?: 'database' | 'batch';

  @ApiPropertyOptional({
    description:
      'Message détaillé (doublon base, conflit dans le lot) pour affichage RH',
  })
  duplicateMessage?: string;

  @ApiPropertyOptional({
    description:
      'Erreur bloquante (PDF illisible, format, taille) — ligne non distribuable',
  })
  blockingError?: string;
}

export class BulkAnalyzeResponseDto {
  @ApiProperty()
  batchId: string;

  @ApiProperty({ type: [BulkAnalyzeRowDto] })
  analyses: BulkAnalyzeRowDto[];
}

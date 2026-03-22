import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { OrgLabelMapsDto } from './org-label-maps.dto';

export class UserImportMappingsDto {
  @ApiProperty({ example: 'N° Employé' })
  @IsString()
  matricule: string;

  @ApiPropertyOptional({ example: 'Prénom' })
  @IsOptional()
  @IsString()
  prenom?: string;

  @ApiPropertyOptional({ example: 'NOM' })
  @IsOptional()
  @IsString()
  nom?: string;

  @ApiProperty({ example: 'MAIL' })
  @IsString()
  email: string;

  @ApiPropertyOptional({ example: 'Direction RH' })
  @IsOptional()
  @IsString()
  departement?: string;

  @ApiPropertyOptional({
    example: 'Comptabilité générale',
    description:
      'Nom du service (réf. organisation) ; doit exister dans l’entreprise',
  })
  @IsOptional()
  @IsString()
  service?: string;

  @ApiPropertyOptional({
    example: 'Direction générale',
    description:
      'Direction (structure) ; optionnelle, pour analyse org et rattachement des départements',
  })
  @IsOptional()
  @IsString()
  direction?: string;

  @ApiPropertyOptional({ example: 'Fonction' })
  @IsOptional()
  @IsString()
  poste?: string;

  @ApiPropertyOptional({ example: 'Type contrat' })
  @IsOptional()
  @IsString()
  contractType?: string;

  @ApiPropertyOptional({ example: 'Fin contrat' })
  @IsOptional()
  @IsString()
  contractEndDate?: string;

  @ApiPropertyOptional({ example: "Date d'entrée" })
  @IsOptional()
  @IsString()
  entryDate?: string;
}

export class SplitFullNameDto {
  @ApiProperty({ example: 'Nom complet' })
  @IsString()
  column: string;

  @ApiProperty({ enum: [' ', ',', '-'], example: ' ' })
  @IsIn([' ', ',', '-'])
  separator: ' ' | ',' | '-';
}

export class UserImportConfigDto {
  @ApiProperty({ type: UserImportMappingsDto })
  @IsObject()
  @ValidateNested()
  @Type(() => UserImportMappingsDto)
  mappings: UserImportMappingsDto;

  @ApiPropertyOptional({ type: SplitFullNameDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SplitFullNameDto)
  splitFullName?: SplitFullNameDto;

  @ApiPropertyOptional({
    description:
      'Indices 0-based des lignes de données à importer (sinon toutes les lignes)',
    example: [0, 1, 2],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  rowIndices?: number[];

  @ApiPropertyOptional({
    type: OrgLabelMapsDto,
    description:
      'Résolution organisationnelle : libellés fichier → UUID (et listes ignorées)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrgLabelMapsDto)
  orgLabelMaps?: OrgLabelMapsDto;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DepartureType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  Equals,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class InitiateDepartureDto {
  @ApiProperty({ enum: DepartureType })
  @IsEnum(DepartureType)
  departureType!: DepartureType;

  @ApiProperty({ description: 'Date effective de sortie (ISO 8601)' })
  @IsDateString()
  departureDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Fin du préavis (ISO) — si renseignée et future, statut ON_NOTICE',
  })
  @IsOptional()
  @IsDateString()
  noticeEndDate?: string;
}

export class BulkDepartureDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds!: string[];

  @ApiProperty({ enum: DepartureType })
  @IsEnum(DepartureType)
  departureType!: DepartureType;

  @ApiProperty()
  @IsDateString()
  departureDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ReinstateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  newContractEndDate?: string;
}

/** Confirmation explicite pour archivage légal (purge compte, bulletins conservés). */
export class ArchiveDepartedUserDto {
  @ApiProperty({ example: 'ARCHIVER' })
  @Equals('ARCHIVER')
  confirm!: string;
}

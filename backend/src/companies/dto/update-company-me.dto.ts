import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

function trimOrUndef(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  const t = value.trim();
  return t;
}

export class UpdateCompanyMeDto {
  @ApiPropertyOptional({ example: 'Ma Société SARL' })
  @IsOptional()
  @Transform(({ value }) => trimOrUndef(value))
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description:
      'RCCM (registre du commerce). Chaîne vide pour effacer la valeur.',
    example: 'CI-ABJ-2018-B-12345',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null
      ? undefined
      : typeof value === 'string'
        ? value.trim()
        : undefined,
  )
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(64)
  rccm?: string;

  @ApiPropertyOptional({
    description: 'Téléphone de l’entreprise. Chaîne vide pour effacer.',
    example: '+225 07 12 34 56 78',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null
      ? undefined
      : typeof value === 'string'
        ? value.trim()
        : undefined,
  )
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Adresse. Chaîne vide pour effacer.',
    example: 'Abidjan, Plateau…',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null
      ? undefined
      : typeof value === 'string'
        ? value.trim()
        : undefined,
  )
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({
    description:
      'Exiger l’accusé de réception électronique sur les bulletins (app mobile).',
  })
  @IsOptional()
  @IsBoolean()
  requireSignature?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Awa' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  firstName: string;

  @ApiProperty({ example: 'Diallo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  lastName: string;

  @ApiProperty({
    example: 'Responsable des ressources humaines',
    description: 'Fonction du référent RH dans l’entreprise',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  referentJobTitle: string;

  @ApiProperty({ example: 'rh@entreprise.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, example: 'SecretP@ss1' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Ma Société SARL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  companyName: string;

  @ApiPropertyOptional({
    description: 'Numéro RCCM (registre du commerce, Côte d’Ivoire)',
    example: 'CI-ABJ-2018-B-12345',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  rccm?: string;

  @ApiProperty({
    description: 'Téléphone de l’entreprise',
    example: '+225 07 12 34 56 78',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  companyPhone: string;
}

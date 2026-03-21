import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'rh@entreprise.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, example: 'SecretP@ss1' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Awa' })
  @IsString()
  @MaxLength(120)
  firstName: string;

  @ApiProperty({ example: 'Diallo' })
  @IsString()
  @MaxLength(120)
  lastName: string;

  @ApiProperty({ example: 'Ma Société SARL' })
  @IsString()
  @MaxLength(255)
  companyName: string;

  @ApiPropertyOptional({
    description: 'Numéro RCCM (registre du commerce, Côte d’Ivoire)',
    example: 'CI-ABJ-2018-B-12345',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  companyRccm?: string;
}

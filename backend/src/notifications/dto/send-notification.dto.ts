import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class SendNotificationDto {
  @ApiPropertyOptional({
    description:
      'Destinataires (UUID). Si absent ou vide : tous les collaborateurs (EMPLOYEE) de l’entreprise.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  userIds?: string[];

  @ApiProperty({ example: 'Information RH' })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({ example: 'Réunion demain à 10h.' })
  @IsString()
  @MinLength(1)
  message: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({
    description: 'Jeton FCM du terminal',
    example: 'dGhpcy1pcy1hLWZha2UtdG9rZW4',
  })
  @IsString()
  @MinLength(1)
  fcmToken: string;

  @ApiPropertyOptional({
    description:
      'Libellé optionnel du terminal (non persisté si schéma limité)',
    example: 'iPhone 15',
  })
  @IsOptional()
  @IsString()
  deviceInfo?: string;
}

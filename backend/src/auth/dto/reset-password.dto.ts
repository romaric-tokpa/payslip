import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Jeton reçu après demande de réinitialisation',
  })
  @IsUUID('4')
  resetToken: string;

  @ApiProperty({ minLength: 8, example: 'NouveauMdp1!' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

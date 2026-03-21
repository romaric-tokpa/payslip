import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class ActivateInvitationDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Jeton reçu par le collaborateur (lien d’invitation)',
  })
  @IsUUID('4')
  invitationToken: string;

  @ApiProperty({ minLength: 8, example: 'NouveauMdp1!' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

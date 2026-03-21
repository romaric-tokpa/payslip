import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MinLength } from 'class-validator';

export class ActivateInvitationDto {
  @ApiProperty({
    example: '482913',
    description:
      'Code d’activation communiqué par le RH (1 à 6 chiffres ; les zéros de tête peuvent être omis)',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\s/g, '') : value,
  )
  @Matches(/^\d{1,6}$/, {
    message:
      'Le code d’activation doit contenir au plus 6 chiffres (sans espaces)',
  })
  activationCode: string;

  @ApiProperty({ minLength: 8, example: 'NouveauMdp1!' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

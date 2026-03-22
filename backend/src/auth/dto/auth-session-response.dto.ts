import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthSessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Souvent null pour les sessions refresh (navigateur / app)',
  })
  deviceInfo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ipAddress!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  expiresAt!: Date;
}

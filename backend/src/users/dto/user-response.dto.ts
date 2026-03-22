import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

/** Schéma API / Swagger (sans mot de passe). */
export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  companyId: string | null;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  employeeId: string | null;

  @ApiPropertyOptional()
  department: string | null;

  @ApiPropertyOptional()
  position: string | null;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({
    description:
      'Mot de passe temporaire : doit être changé à la prochaine connexion',
  })
  mustChangePassword: boolean;

  @ApiPropertyOptional()
  entryDate: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'URL présignée pour afficher la photo (GET /users, /users/me, etc.)',
  })
  profilePhotoUrl?: string | null;
}

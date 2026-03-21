import { UserRole } from '@prisma/client';

/** Claims du JWT d’accès (signés par AuthService). */
export type JwtAccessPayload = {
  sub: string;
  email: string;
  role: UserRole;
  companyId?: string | null;
};

/**
 * Utilisateur authentifié sur `request.user` après validation Passport JWT.
 * Pour l’entité Prisma complète, charger via `UsersService.findById(user.id)`.
 */
export type RequestUser = {
  id: string;
  email: string;
  role: UserRole;
  companyId: string | null;
};

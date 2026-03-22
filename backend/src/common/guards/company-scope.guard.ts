import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

type ScopedRequest = {
  user?: { companyId?: string | null };
  companyId?: string | null;
};

/**
 * N’applique aucun refus : copie le `companyId` du JWT sur la requête pour un accès cohérent côté services.
 */
@Injectable()
export class CompanyScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ScopedRequest>();
    const user = request.user;

    if (user?.companyId) {
      request.companyId = user.companyId;
    }

    return true;
  }
}

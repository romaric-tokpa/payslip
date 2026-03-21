import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { RequestUser } from '../auth.types';

/**
 * Injecte `request.user` (sous-ensemble issu du JWT).
 * Ex. `@CurrentUser() user` ou `@CurrentUser('id') id`.
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof RequestUser | undefined,
    ctx: ExecutionContext,
  ): RequestUser | RequestUser[keyof RequestUser] => {
    const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return data != null ? user[data] : user;
  },
);

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

function mockContext(user?: {
  id: string;
  email: string;
  role: 'RH_ADMIN' | 'EMPLOYEE' | 'SUPER_ADMIN';
}): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('autorise si aucun @Roles (liste vide / absente)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = mockContext({ id: '1', email: 'a@b.com', role: 'EMPLOYEE' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('autorise si le rôle du user est dans la liste', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) =>
        key === ROLES_KEY ? ['RH_ADMIN', 'SUPER_ADMIN'] : undefined,
      );
    const ctx = mockContext({ id: '1', email: 'rh@b.com', role: 'RH_ADMIN' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('refuse si le rôle ne correspond pas (403)', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) =>
        key === ROLES_KEY ? ['RH_ADMIN'] : undefined,
      );
    const ctx = mockContext({ id: '1', email: 'e@b.com', role: 'EMPLOYEE' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('refuse si user absent sur une route @Roles (403)', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) =>
        key === ROLES_KEY ? ['RH_ADMIN'] : undefined,
      );
    const ctx = mockContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

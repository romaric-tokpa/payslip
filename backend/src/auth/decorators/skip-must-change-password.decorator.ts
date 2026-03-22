import { SetMetadata } from '@nestjs/common';

export const SKIP_MUST_CHANGE_PASSWORD_KEY = 'skipMustChangePassword';

/** Autorise l’accès alors que `mustChangePassword` est vrai (ex. POST /auth/change-password). */
export const SkipMustChangePassword = () =>
  SetMetadata(SKIP_MUST_CHANGE_PASSWORD_KEY, true);

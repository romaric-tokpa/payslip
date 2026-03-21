/** Actions journalisées pour la politique de verrouillage (schéma sans colonnes dédiées). */
export const AUDIT = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
} as const;

export const MAX_LOGIN_ATTEMPTS = 5;

/**
 * Valeurs de `Session.deviceInfo` (pas de colonne `type` dans le schéma).
 * `null` = session refresh JWT.
 */
export const SESSION_DEVICE = {
  INVITATION: 'INVITATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;

import * as crypto from 'node:crypto';

export function hashRefreshToken(plain: string, pepper: string): string {
  return crypto.createHmac('sha256', pepper).update(plain).digest('hex');
}

/** HMAC pour tokens opaques (invitation / reset), avec préfixe de type pour éviter les collisions. */
export function hashOpaqueToken(
  kind: string,
  plain: string,
  pepper: string,
): string {
  return crypto
    .createHmac('sha256', pepper)
    .update(`${kind}:${plain}`)
    .digest('hex');
}

export function newRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

import type { Request } from 'express';

/** IP et User-Agent pour enrichir les journaux d’audit (proxy : X-Forwarded-For). */
export function getRequestClientMeta(req: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const xf = req.headers['x-forwarded-for'];
  const fromXf =
    typeof xf === 'string' ? (xf.split(',')[0]?.trim() ?? null) : null;
  const ip =
    fromXf ??
    req.ip ??
    (typeof req.socket?.remoteAddress === 'string'
      ? req.socket.remoteAddress
      : null);
  const ua = req.headers['user-agent'];
  return {
    ipAddress: ip,
    userAgent: typeof ua === 'string' ? ua : null,
  };
}

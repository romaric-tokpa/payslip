import * as crypto from 'node:crypto';

export function hashFcmToken(fcmToken: string): string {
  return crypto.createHash('sha256').update(fcmToken, 'utf8').digest('hex');
}

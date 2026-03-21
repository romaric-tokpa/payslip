import { Throttle as NestThrottle } from '@nestjs/throttler';

/**
 * Limite de débit pour le throttler nommé `default`.
 * @param limit nombre max de requêtes dans la fenêtre
 * @param ttl durée de la fenêtre en secondes
 */
export function Throttle(
  limit: number,
  ttl: number,
): MethodDecorator & ClassDecorator {
  return NestThrottle({ default: { limit, ttl: ttl * 1000 } });
}

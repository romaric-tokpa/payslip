import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtAccessPayload, RequestUser } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Payload décodé du JWT ; la valeur de retour est assignée à `request.user`.
   */
  validate(payload: JwtAccessPayload): RequestUser {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      companyId: payload.companyId ?? null,
      ...(payload.impersonatedBy
        ? { impersonatedBy: payload.impersonatedBy }
        : {}),
    };
  }
}

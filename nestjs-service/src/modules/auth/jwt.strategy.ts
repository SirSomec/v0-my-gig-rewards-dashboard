import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Envs } from '../../shared/env.validation-schema';

export interface JwtPayload {
  sub: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService<Envs, true>) {
    const secret =
      configService.get<string>('JWT_SECRET') ?? 'dev-secret-change-in-production';
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload & { sub?: number | string }): { userId: number } {
    const sub = payload?.sub;
    if (sub == null) {
      throw new UnauthorizedException('Invalid token payload');
    }
    const userId = typeof sub === 'number' ? sub : parseInt(String(sub), 10);
    if (Number.isNaN(userId)) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return { userId };
  }
}

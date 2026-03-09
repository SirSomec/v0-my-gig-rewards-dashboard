import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Envs } from '../../shared/env.validation-schema';

const HEADER_NAME = 'x-internal-secret';

/**
 * Проверяет заголовок X-Internal-Secret для вызовов ensure-user из Next.js.
 * Секрет задаётся в REWARDS_INTERNAL_SECRET.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Envs, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = this.config.get<string>('REWARDS_INTERNAL_SECRET');
    if (!secret?.trim()) {
      throw new UnauthorizedException(
        'REWARDS_INTERNAL_SECRET not configured. Set it in env for ensure-user.',
      );
    }
    const provided =
      request.headers?.[HEADER_NAME] ?? request.headers?.['X-Internal-Secret'];
    if (provided !== secret) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    return true;
  }
}

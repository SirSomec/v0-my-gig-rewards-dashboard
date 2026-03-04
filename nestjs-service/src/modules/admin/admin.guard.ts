import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Envs } from '../../shared/env.validation-schema';

/**
 * Проверяет заголовок X-Admin-Key. Если задан ADMIN_SECRET — ключ обязателен и должен совпадать.
 * В development при отсутствии ADMIN_SECRET доступ разрешён (для локальной разработки).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Envs, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = request.headers?.['x-admin-key'];
    const secret = this.config.get<string>('ADMIN_SECRET');
    const nodeEnv = this.config.get<string>('NODE_ENV');
    if (secret) {
      if (key !== secret) {
        throw new ForbiddenException('Invalid or missing X-Admin-Key');
      }
      return true;
    }
    if (nodeEnv === 'production') {
      throw new ForbiddenException('Admin API requires ADMIN_SECRET in production');
    }
    return true;
  }
}

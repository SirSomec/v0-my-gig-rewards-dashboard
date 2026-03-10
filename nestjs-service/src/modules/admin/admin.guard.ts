import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Envs } from '../../shared/env.validation-schema';
import type { AdminSessionPayload, AdminUserInfo } from './admin-auth.service';
import * as schema from '../../infra/db/drizzle/schemas';

/**
 * Проверяет доступ к админ API:
 * 1) Authorization: Bearer <JWT> — верифицирует JWT и устанавливает req.adminUser (id, email, isSuper, permissions).
 * 2) X-Admin-Key — если совпадает с ADMIN_SECRET, разрешает доступ и устанавливает req.adminUser с полными правами.
 * В development при отсутствии обоих и без ADMIN_SECRET доступ разрешён (legacy).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<Envs, true>,
    private readonly jwt: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.['authorization'];
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;

    if (bearerToken) {
      try {
        const payload = this.jwt.verify(bearerToken) as AdminSessionPayload;
        if (payload?.sub != null && payload?.email) {
          const user: AdminUserInfo = {
            id: payload.sub,
            email: payload.email,
            name: null,
            isSuper: payload.isSuper === true,
            permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
          };
          request.adminUser = user;
          return true;
        }
      } catch {
        // invalid token — fall through to key check or 403
      }
    }

    const key = request.headers?.['x-admin-key'];
    const secret = this.config.get<string>('ADMIN_SECRET');
    const nodeEnv = this.config.get<string>('NODE_ENV');

    if (secret && key === secret) {
      request.adminUser = {
        id: 'super',
        email: '',
        name: null,
        isSuper: true,
        permissions: [...schema.ADMIN_PERMISSION_KEYS],
      } as AdminUserInfo;
      return true;
    }

    if (secret) {
      throw new ForbiddenException('Invalid or missing X-Admin-Key or Bearer token');
    }
    if (nodeEnv === 'production') {
      throw new ForbiddenException('Admin API requires ADMIN_SECRET or Bearer token in production');
    }
    // development без секрета — полный доступ без идентификации
    request.adminUser = {
      id: 'super',
      email: '',
      name: null,
      isSuper: true,
      permissions: [...schema.ADMIN_PERMISSION_KEYS],
    } as AdminUserInfo;
    return true;
  }
}

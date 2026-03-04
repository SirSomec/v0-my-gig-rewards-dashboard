import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * Опциональная JWT-авторизация: если в запросе есть Bearer-токен, проверяем его
 * и кладём req.user = { userId }. Если токена нет — запрос идёт дальше (для
 * совместимости с ?userId= и DEV_USER_ID).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;
    const hasBearer =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
    if (!hasBearer) {
      return true;
    }
    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest<TUser>(err: unknown, user: TUser): TUser {
    if (err) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }
    return user;
  }
}

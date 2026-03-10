import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AdminContextService } from './admin-context.service';

@Injectable()
export class AdminContextInterceptor implements NestInterceptor {
  constructor(private readonly adminContext: AdminContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request?.adminUser;
    const adminId =
      user?.id === 'super' ? null : (typeof user?.id === 'number' ? user.id : null);
    const adminDisplay =
      user?.email && user.email !== '' ? user.email : (adminId === null ? 'суперадмин' : null);

    return new Observable((subscriber) => {
      this.adminContext.run({ adminId, adminDisplay }, () => {
        next.handle().subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}

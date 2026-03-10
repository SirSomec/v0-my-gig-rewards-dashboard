import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface AdminContextStore {
  adminId: number | null;
  /** Для отображения в аудите: email суперадмина из .env или админа из БД */
  adminDisplay?: string;
}

/**
 * Контекст текущего администратора в рамках запроса.
 * Устанавливается AdminContextInterceptor из req.adminUser после AdminGuard.
 * Используется в AdminService.logAudit для записи admin_id и отображения в журнале.
 */
@Injectable()
export class AdminContextService {
  private readonly asyncLocal = new AsyncLocalStorage<AdminContextStore>();

  run<T>(store: AdminContextStore, fn: () => T): T {
    return this.asyncLocal.run(store, fn);
  }

  getAdminId(): number | null {
    return this.asyncLocal.getStore()?.adminId ?? null;
  }

  getAdminDisplay(): string | null {
    return this.asyncLocal.getStore()?.adminDisplay ?? null;
  }
}

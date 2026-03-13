import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../infra/db/drizzle/schemas';
import { drizzleProvider } from '../../infra/db/drizzle/drizzle.module';

export interface TojSyncUserRow {
  id: number;
  externalId: string;
  createdAt: Date;
  /** С какого момента учитывать смены (при предрегистрации — дата одобрения); иначе используется createdAt */
  loyaltyStartedAt: Date | null;
}

@Injectable()
export class TojSyncRepository {
  constructor(
    @Inject(drizzleProvider)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Получить строковое значение настройки system_settings по ключу.
   * Поддерживает как простые строки, так и объекты вида { value: string }; при отсутствии или неподходящем типе возвращает null.
   */
  async getSettingString(key: string): Promise<string | null> {
    const { systemSettings } = schema;
    const [row] = await this.db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);

    if (!row?.value) return null;
    const value = row.value;
    if (typeof value === 'string') return value;
    if (
      typeof value === 'object' &&
      value != null &&
      typeof (value as { value?: string }).value === 'string'
    ) {
      return (value as { value: string }).value;
    }
    return null;
  }

  /**
   * Сохранить строковое значение настройки system_settings по ключу.
   * При конфликте по key обновляет существующую запись и updatedAt.
   */
  async setSettingString(key: string, value: string): Promise<void> {
    const { systemSettings } = schema;
    const now = new Date();
    await this.db
      .insert(systemSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedAt: now },
      });
  }

  /**
   * Список пользователей, у которых заполнен external_id.
   * Используется для запроса смен из TOJ только по тем работникам, которые заведены в нашей системе.
   */
  async getUsersWithExternalId(): Promise<TojSyncUserRow[]> {
    const { users } = schema;
    const rows = await this.db
      .select({
        id: users.id,
        externalId: users.externalId,
        createdAt: users.createdAt,
        loyaltyStartedAt: users.loyaltyStartedAt,
      })
      .from(users)
      .where(sql`${users.externalId} IS NOT NULL AND ${users.externalId} != ''`);

    return rows
      .filter((row) => !!row.externalId)
      .map((row) => ({
        id: row.id,
        externalId: String(row.externalId).trim(),
        createdAt: row.createdAt as Date,
        loyaltyStartedAt: row.loyaltyStartedAt as Date | null,
      }));
  }

  /**
   * Проверка, есть ли уже транзакция type='shift' с заданным sourceRef (идемпотентность по внешнему ID смены).
   */
  async hasShiftTransaction(sourceRef: string): Promise<boolean> {
    const { transactions } = schema;
    const [existing] = await this.db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.type, 'shift'), eq(transactions.sourceRef, sourceRef)))
      .limit(1);
    return !!existing;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../infra/db/drizzle/schemas';
import { drizzleProvider } from '../../infra/db/drizzle/drizzle.module';

export interface TojSyncUserRow {
  id: number;
  externalId: string;
  createdAt: Date;
}

@Injectable()
export class TojSyncRepository {
  constructor(
    @Inject(drizzleProvider)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

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

  async getUsersWithExternalId(): Promise<TojSyncUserRow[]> {
    const { users } = schema;
    const rows = await this.db
      .select({ id: users.id, externalId: users.externalId, createdAt: users.createdAt })
      .from(users)
      .where(sql`${users.externalId} IS NOT NULL AND ${users.externalId} != ''`);

    return rows
      .filter((row) => !!row.externalId)
      .map((row) => ({
        id: row.id,
        externalId: String(row.externalId).trim(),
        createdAt: row.createdAt as Date,
      }));
  }

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

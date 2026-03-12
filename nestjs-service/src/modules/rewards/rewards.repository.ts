import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../infra/db/drizzle/schemas';
import { drizzleProvider } from '../../infra/db/drizzle/drizzle.module';

@Injectable()
export class RewardsRepository {
  constructor(
    @Inject(drizzleProvider)
    private readonly client: PostgresJsDatabase<typeof schema>,
  ) {}

  get db(): PostgresJsDatabase<typeof schema> {
    return this.client;
  }

  async getSystemSettingValue(key: string): Promise<unknown | null> {
    const { systemSettings } = schema;
    const [row] = await this.client
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);
    return row?.value ?? null;
  }

  async getUserById(id: number): Promise<typeof schema.users.$inferSelect | null> {
    const { users } = schema;
    const [row] = await this.client.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  async insertStrike(params: {
    userId: number;
    type: 'no_show' | 'late_cancel';
    shiftExternalId?: string;
    occurredAt: Date;
  }): Promise<number> {
    const { strikes } = schema;
    const [row] = await this.client
      .insert(strikes)
      .values({
        userId: params.userId,
        type: params.type,
        shiftExternalId: params.shiftExternalId ?? undefined,
        occurredAt: params.occurredAt,
      })
      .returning({ id: strikes.id });
    if (!row) throw new Error('Failed to create strike');
    return row.id;
  }

  async updateUserReliabilityRating(userId: number, reliabilityRating: number): Promise<void> {
    const { users } = schema;
    await this.client
      .update(users)
      .set({ reliabilityRating })
      .where(eq(users.id, userId));
  }

  async findUserIdByExternalId(externalId: string): Promise<number | null> {
    const { users } = schema;
    const [row] = await this.client
      .select({ id: users.id })
      .from(users)
      .where(eq(users.externalId, externalId))
      .limit(1);
    return row?.id ?? null;
  }

  async hasActiveStrikeByShiftExternalId(shiftExternalId: string): Promise<boolean> {
    const { strikes } = schema;
    const [row] = await this.client
      .select({ id: strikes.id })
      .from(strikes)
      .where(and(eq(strikes.shiftExternalId, shiftExternalId), isNull(strikes.removedAt)))
      .limit(1);
    return !!row;
  }

  async findActiveStrikeByShiftExternalId(
    shiftExternalId: string,
  ): Promise<(typeof schema.strikes.$inferSelect) | null> {
    const { strikes } = schema;
    const [row] = await this.client
      .select()
      .from(strikes)
      .where(and(eq(strikes.shiftExternalId, shiftExternalId), isNull(strikes.removedAt)))
      .limit(1);
    return row ?? null;
  }

  async markStrikeRemoved(strikeId: number, removalReason: string, removedAt: Date): Promise<void> {
    const { strikes } = schema;
    await this.client
      .update(strikes)
      .set({
        removedAt,
        removalReason,
      })
      .where(eq(strikes.id, strikeId));
  }

  async insertPageView(userId: number, path: string): Promise<void> {
    await this.client.insert(schema.pageViews).values({ userId, path });
  }

  async getUserWithLevel(userId: number): Promise<{
    user: typeof schema.users.$inferSelect;
    level: typeof schema.levels.$inferSelect;
  } | null> {
    const { users, levels } = schema;
    const [row] = await this.client
      .select({ user: users, level: levels })
      .from(users)
      .innerJoin(levels, eq(users.levelId, levels.id))
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? null;
  }

  async getNextLevelBySortOrder(sortOrder: number): Promise<(typeof schema.levels.$inferSelect) | null> {
    const { levels } = schema;
    const [row] = await this.client
      .select()
      .from(levels)
      .where(sql`${levels.sortOrder} = ${sortOrder + 1}`)
      .limit(1);
    return row ?? null;
  }

  async getUserMonthlyBonusTotal(userId: number, monthStart: Date, nextMonthStart: Date): Promise<number> {
    const { transactions } = schema;
    const [row] = await this.client
      .select({ sum: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          inArray(transactions.type, ['shift', 'quest']),
          gte(transactions.createdAt, monthStart),
          lt(transactions.createdAt, nextMonthStart),
        ),
      );
    return Number(row?.sum ?? 0);
  }

  async listUserStrikes(userId: number, limit: number): Promise<(typeof schema.strikes.$inferSelect)[]> {
    const { strikes } = schema;
    return this.client
      .select()
      .from(strikes)
      .where(eq(strikes.userId, userId))
      .orderBy(desc(strikes.occurredAt))
      .limit(limit);
  }

  async listUserTransactions(userId: number, limit: number): Promise<(typeof schema.transactions.$inferSelect)[]> {
    const { transactions } = schema;
    return this.client
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(sql`${transactions.createdAt} desc`)
      .limit(limit);
  }
}

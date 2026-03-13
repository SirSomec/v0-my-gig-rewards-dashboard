import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
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

  /**
   * Обновить рейтинг надёжности пользователя и при необходимости записать изменение в reliability_rating_log.
   */
  async updateUserReliabilityRating(
    userId: number,
    newRating: number,
    log?: { reason: string; referenceType?: string; referenceId?: string | number },
  ): Promise<void> {
    const { users, reliabilityRatingLog } = schema;
    const [row] = await this.client
      .select({ reliabilityRating: users.reliabilityRating })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const previousRating = row ? Number(row.reliabilityRating ?? 4) : 4;
    await this.client
      .update(users)
      .set({ reliabilityRating: newRating })
      .where(eq(users.id, userId));
    if (log?.reason) {
      await this.client.insert(reliabilityRatingLog).values({
        userId,
        previousRating,
        newRating,
        reason: log.reason,
        referenceType: log.referenceType ?? null,
        referenceId: log.referenceId != null ? String(log.referenceId) : null,
      });
    }
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

  /** Установить loyalty_requested_at (пользователь нажал «Зарегистрироваться»). Только для pending без даты. */
  async updateUserLoyaltyRequestedAt(userId: number): Promise<boolean> {
    const { users } = schema;
    const now = new Date();
    const result = await this.client
      .update(users)
      .set({ loyaltyRequestedAt: now })
      .where(
        and(
          eq(users.id, userId),
          eq(users.loyaltyStatus, 'pending'),
          isNull(users.loyaltyRequestedAt),
        ),
      )
      .returning({ id: users.id });
    return result.length > 0;
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

  async listUserGroupIds(userId: number): Promise<number[]> {
    const { userGroupMembers } = schema;
    const rows = await this.client
      .select({ groupId: userGroupMembers.groupId })
      .from(userGroupMembers)
      .where(and(eq(userGroupMembers.userId, userId), isNull(userGroupMembers.deletedAt)));
    return rows.map((row) => row.groupId);
  }

  async listActiveQuests(): Promise<(typeof schema.quests.$inferSelect)[]> {
    return this.client
      .select()
      .from(schema.quests)
      .where(eq(schema.quests.isActive, 1));
  }

  async getQuestProgress(
    userId: number,
    questId: number,
    periodKey: string,
  ): Promise<(typeof schema.questProgress.$inferSelect) | null> {
    const { questProgress } = schema;
    const [row] = await this.client
      .select()
      .from(questProgress)
      .where(
        and(
          eq(questProgress.userId, userId),
          eq(questProgress.questId, questId),
          eq(questProgress.periodKey, periodKey),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listActiveStoreItems(): Promise<(typeof schema.storeItems.$inferSelect)[]> {
    const { storeItems } = schema;
    return this.client
      .select()
      .from(storeItems)
      .where(and(eq(storeItems.isActive, 1), isNull(storeItems.deletedAt)))
      .orderBy(storeItems.sortOrder, storeItems.id);
  }

  async countActiveRedemptionsByStoreItemId(storeItemId: number): Promise<number> {
    const { redemptions } = schema;
    const [row] = await this.client
      .select({ count: sql<number>`count(*)::int` })
      .from(redemptions)
      .where(
        and(
          eq(redemptions.storeItemId, storeItemId),
          or(eq(redemptions.status, 'pending'), eq(redemptions.status, 'fulfilled')),
        ),
      );
    return row?.count ?? 0;
  }

  async listLevels(): Promise<(typeof schema.levels.$inferSelect)[]> {
    return this.client
      .select()
      .from(schema.levels)
      .orderBy(schema.levels.sortOrder);
  }

  async createRedemption(userId: number, storeItemId: number): Promise<{ redemptionId: number }> {
    const { users, storeItems, transactions, redemptions } = schema;
    return this.client.transaction(
      async (tx) => {
        const userRows = await tx
          .select({ id: users.id, balance: users.balance })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
          .for('update');
        const user = userRows[0];
        if (!user) {
          throw new Error('USER_NOT_FOUND');
        }

        const itemRows = await tx
          .select()
          .from(storeItems)
          .where(eq(storeItems.id, storeItemId))
          .limit(1)
          .for('update');
        const item = itemRows[0];
        if (!item || item.isActive !== 1 || item.deletedAt) {
          throw new Error('STORE_ITEM_NOT_FOUND_OR_INACTIVE');
        }
        if (user.balance < item.cost) {
          throw new Error('INSUFFICIENT_BALANCE');
        }
        if (item.stockLimit != null) {
          const countResult = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(redemptions)
            .where(
              and(
                eq(redemptions.storeItemId, storeItemId),
                or(eq(redemptions.status, 'pending'), eq(redemptions.status, 'fulfilled')),
              ),
            );
          const redeemed = countResult[0]?.count ?? 0;
          if (redeemed >= item.stockLimit) {
            throw new Error('OUT_OF_STOCK');
          }
        }

        const [redemption] = await tx
          .insert(redemptions)
          .values({
            userId,
            storeItemId,
            status: 'pending',
            coinsSpent: item.cost,
          })
          .returning({ id: redemptions.id });
        if (!redemption) {
          throw new Error('FAILED_TO_CREATE_REDEMPTION');
        }

        await tx
          .update(users)
          .set({ balance: sql`${users.balance} - ${item.cost}` })
          .where(eq(users.id, userId));
        await tx.insert(transactions).values({
          userId,
          amount: -item.cost,
          type: 'redemption',
          sourceRef: String(redemption.id),
          title: item.name,
        });
        return { redemptionId: redemption.id };
      },
      {
        isolationLevel: 'repeatable read',
        accessMode: 'read write',
      },
    );
  }

  async getUserWithCurrentLevel(userId: number): Promise<{
    user: typeof schema.users.$inferSelect;
    currentLevel: typeof schema.levels.$inferSelect;
  } | null> {
    const { users, levels } = schema;
    const [row] = await this.client
      .select({ user: users, currentLevel: levels })
      .from(users)
      .innerJoin(levels, eq(users.levelId, levels.id))
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? null;
  }

  async findLevelByShiftsRequired(shiftsCompleted: number): Promise<(typeof schema.levels.$inferSelect) | null> {
    const { levels } = schema;
    const [row] = await this.client
      .select()
      .from(levels)
      .where(lte(levels.shiftsRequired, shiftsCompleted))
      .orderBy(desc(levels.shiftsRequired))
      .limit(1);
    return row ?? null;
  }

  async getBaseLevel(): Promise<(typeof schema.levels.$inferSelect) | null> {
    const { levels } = schema;
    const [row] = await this.client
      .select()
      .from(levels)
      .orderBy(asc(levels.sortOrder))
      .limit(1);
    return row ?? null;
  }

  async updateUserLevelAndShifts(userId: number, levelId: number, shiftsCompleted: number): Promise<void> {
    const { users } = schema;
    await this.client
      .update(users)
      .set({
        levelId,
        shiftsCompleted,
      })
      .where(eq(users.id, userId));
  }
}

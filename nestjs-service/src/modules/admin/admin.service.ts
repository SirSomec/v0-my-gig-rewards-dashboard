import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, ilike, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../infra/db/drizzle/schemas';
import { drizzleProvider } from '../../infra/db/drizzle/drizzle.module';
import { Inject } from '@nestjs/common';

@Injectable()
export class AdminService {
  constructor(
    @Inject(drizzleProvider)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async listUsers(search?: string, limit = 50) {
    const { users, levels } = schema;
    let query = this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        balance: users.balance,
        shiftsCompleted: users.shiftsCompleted,
        levelId: users.levelId,
        levelName: levels.name,
      })
      .from(users)
      .leftJoin(levels, eq(users.levelId, levels.id))
      .limit(limit);
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query = query.where(
        or(
          sql`${users.id}::text LIKE ${term}`,
          ilike(users.name, term),
          ilike(users.email, term),
        ),
      ) as typeof query;
    }
    return query;
  }

  async getUserDetail(userId: number) {
    const { users, levels, strikes, transactions } = schema;
    const [userRow] = await this.db
      .select({ user: users, level: levels })
      .from(users)
      .innerJoin(levels, eq(users.levelId, levels.id))
      .where(eq(users.id, userId))
      .limit(1);
    if (!userRow) throw new NotFoundException('User not found');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const strikesList = await this.db
      .select()
      .from(strikes)
      .where(eq(strikes.userId, userId))
      .orderBy(sql`${strikes.occurredAt} desc`)
      .limit(20);
    const recentTx = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(sql`${transactions.createdAt} desc`)
      .limit(20);
    return {
      ...userRow.user,
      levelName: userRow.level.name,
      strikesCount30d: strikesList.filter((s) => (s.occurredAt as Date) >= thirtyDaysAgo).length,
      strikes: strikesList,
      recentTransactions: recentTx,
    };
  }

  async listRedemptions(status?: string, limit = 100) {
    const { redemptions, users, storeItems } = schema;
    let q = this.db
      .select({
        id: redemptions.id,
        userId: redemptions.userId,
        userName: users.name,
        storeItemId: redemptions.storeItemId,
        itemName: storeItems.name,
        status: redemptions.status,
        coinsSpent: redemptions.coinsSpent,
        createdAt: redemptions.createdAt,
        processedAt: redemptions.processedAt,
        notes: redemptions.notes,
      })
      .from(redemptions)
      .innerJoin(users, eq(redemptions.userId, users.id))
      .innerJoin(storeItems, eq(redemptions.storeItemId, storeItems.id))
      .orderBy(sql`${redemptions.createdAt} desc`)
      .limit(limit);
    if (status?.trim()) {
      q = q.where(eq(redemptions.status, status.trim())) as typeof q;
    }
    return q;
  }

  async updateRedemption(
    redemptionId: number,
    status: 'fulfilled' | 'cancelled',
    notes?: string,
    returnCoins = false,
  ) {
    const { redemptions, users } = schema;
    const [r] = await this.db.select().from(redemptions).where(eq(redemptions.id, redemptionId)).limit(1);
    if (!r) throw new NotFoundException('Redemption not found');
    if (r.status !== 'pending') throw new NotFoundException('Redemption already processed');
    const now = new Date();
    await this.db
      .update(redemptions)
      .set({ status, processedAt: now, notes: notes ?? null })
      .where(eq(redemptions.id, redemptionId));
    if (status === 'cancelled' && returnCoins) {
      const [u] = await this.db.select().from(users).where(eq(users.id, r.userId)).limit(1);
      if (u) {
        await this.db
          .update(users)
          .set({ balance: u.balance + r.coinsSpent })
          .where(eq(users.id, r.userId));
        await this.db.insert(schema.transactions).values({
          userId: r.userId,
          amount: r.coinsSpent,
          type: 'manual_credit',
          title: 'Возврат за отмену обмена',
          description: notes ?? undefined,
          sourceRef: String(redemptionId),
        });
      }
    }
    return { id: redemptionId, status };
  }

  async listStoreItems() {
    const { storeItems } = schema;
    return this.db.select().from(storeItems).orderBy(storeItems.sortOrder, storeItems.id);
  }

  async listLevels() {
    const { levels } = schema;
    return this.db.select().from(levels).orderBy(levels.sortOrder);
  }
}

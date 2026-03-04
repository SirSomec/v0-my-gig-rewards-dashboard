import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../infra/db/drizzle/schemas';
import { drizzleProvider } from '../../infra/db/drizzle/drizzle.module';
import { Inject } from '@nestjs/common';
import type { CreateStoreItemDto, UpdateLevelDto, UpdateStoreItemDto } from './dto/admin.dto';

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
    return this.db
      .select()
      .from(storeItems)
      .where(isNull(storeItems.deletedAt))
      .orderBy(storeItems.sortOrder, storeItems.id);
  }

  async createStoreItem(dto: CreateStoreItemDto) {
    const { storeItems } = schema;
    const [row] = await this.db
      .insert(storeItems)
      .values({
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category,
        cost: dto.cost,
        icon: dto.icon ?? 'gift',
        stockLimit: dto.stockLimit ?? null,
        visibleFrom: dto.visibleFrom ? new Date(dto.visibleFrom) : null,
        visibleUntil: dto.visibleUntil ? new Date(dto.visibleUntil) : null,
        isActive: dto.isActive ?? 1,
        sortOrder: dto.sortOrder ?? 0,
        visibilityRules: dto.visibilityRules ?? null,
      })
      .returning({ id: storeItems.id });
    if (!row) throw new Error('Insert failed');
    return { id: row.id };
  }

  async updateStoreItem(id: number, dto: UpdateStoreItemDto) {
    const { storeItems } = schema;
    const [existing] = await this.db.select().from(storeItems).where(eq(storeItems.id, id)).limit(1);
    if (!existing) throw new NotFoundException('Store item not found');
    const updates: Partial<typeof storeItems.$inferInsert> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.category !== undefined) updates.category = dto.category;
    if (dto.cost !== undefined) updates.cost = dto.cost;
    if (dto.icon !== undefined) updates.icon = dto.icon;
    if (dto.stockLimit !== undefined) updates.stockLimit = dto.stockLimit;
    if (dto.visibleFrom !== undefined) updates.visibleFrom = dto.visibleFrom ? new Date(dto.visibleFrom) : null;
    if (dto.visibleUntil !== undefined) updates.visibleUntil = dto.visibleUntil ? new Date(dto.visibleUntil) : null;
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) updates.sortOrder = dto.sortOrder;
    if (dto.visibilityRules !== undefined) updates.visibilityRules = dto.visibilityRules;
    if (Object.keys(updates).length === 0) return { id };
    await this.db.update(storeItems).set(updates).where(eq(storeItems.id, id));
    return { id };
  }

  async deleteStoreItem(id: number) {
    const { storeItems } = schema;
    const [existing] = await this.db.select().from(storeItems).where(eq(storeItems.id, id)).limit(1);
    if (!existing) throw new NotFoundException('Store item not found');
    const now = new Date();
    await this.db
      .update(storeItems)
      .set({ deletedAt: now, isActive: 0 })
      .where(eq(storeItems.id, id));
    return { id };
  }

  async listLevels() {
    const { levels } = schema;
    return this.db.select().from(levels).orderBy(levels.sortOrder);
  }

  async updateLevel(id: number, dto: UpdateLevelDto) {
    const { levels } = schema;
    const [existing] = await this.db.select().from(levels).where(eq(levels.id, id)).limit(1);
    if (!existing) throw new NotFoundException('Level not found');
    const updates: Partial<typeof levels.$inferInsert> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.shiftsRequired !== undefined) updates.shiftsRequired = dto.shiftsRequired;
    if (dto.strikeThreshold !== undefined) updates.strikeThreshold = dto.strikeThreshold;
    if (dto.perks !== undefined) updates.perks = dto.perks;
    if (dto.sortOrder !== undefined) updates.sortOrder = dto.sortOrder;
    if (Object.keys(updates).length === 0) return { id };
    await this.db.update(levels).set(updates).where(eq(levels.id, id));
    return { id };
  }
}

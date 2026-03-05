import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../infra/db/drizzle/schemas';
import { drizzleProvider } from '../../infra/db/drizzle/drizzle.module';
import { Inject } from '@nestjs/common';
import type { CreateQuestDto, CreateStoreItemDto, UpdateLevelDto, UpdateQuestDto, UpdateStoreItemDto } from './dto/admin.dto';

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

  async listRedemptions(
    opts: {
      status?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { redemptions, users, storeItems } = schema;
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, opts.pageSize ?? 50));

    const conditions: Parameters<typeof and>[0][] = [];
    if (opts.status?.trim()) {
      conditions.push(eq(redemptions.status, opts.status.trim()));
    }
    if (opts.dateFrom) {
      const d = new Date(opts.dateFrom);
      if (!Number.isNaN(d.getTime())) {
        conditions.push(sql`${redemptions.createdAt} >= ${d}`);
      }
    }
    if (opts.dateTo) {
      const d = new Date(opts.dateTo);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        conditions.push(sql`${redemptions.createdAt} <= ${d}`);
      }
    }
    if (opts.search?.trim()) {
      const term = `%${opts.search.trim()}%`;
      conditions.push(
        or(
          sql`${redemptions.userId}::text LIKE ${term}`,
          ilike(users.name, term),
          ilike(storeItems.name, term),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(redemptions)
      .innerJoin(users, eq(redemptions.userId, users.id))
      .innerJoin(storeItems, eq(redemptions.storeItemId, storeItems.id))
      .where(whereClause);
    const total = Number(countResult?.count ?? 0);

    const items = await this.db
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
      .where(whereClause)
      .orderBy(sql`${redemptions.createdAt} desc`)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { items, total, page, pageSize };
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

  async bulkUpdateRedemptions(
    ids: number[],
    status: 'fulfilled' | 'cancelled',
    notes?: string,
    returnCoins = false,
  ): Promise<{ updated: number; errors: Array<{ id: number; reason: string }> }> {
    if (!ids.length) return { updated: 0, errors: [] };
    const { redemptions, users } = schema;
    const errors: Array<{ id: number; reason: string }> = [];
    let updated = 0;
    const now = new Date();
    for (const redemptionId of ids) {
      const [r] = await this.db.select().from(redemptions).where(eq(redemptions.id, redemptionId)).limit(1);
      if (!r) {
        errors.push({ id: redemptionId, reason: 'not_found' });
        continue;
      }
      if (r.status !== 'pending') {
        errors.push({ id: redemptionId, reason: 'already_processed' });
        continue;
      }
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
      updated += 1;
    }
    return { updated, errors };
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

  async listQuests() {
    const { quests } = schema;
    return this.db.select().from(quests).orderBy(quests.id);
  }

  async createQuest(dto: CreateQuestDto) {
    const { quests } = schema;
    const [row] = await this.db
      .insert(quests)
      .values({
        name: dto.name,
        description: dto.description ?? null,
        period: dto.period,
        conditionType: dto.conditionType,
        conditionConfig: dto.conditionConfig ?? {},
        rewardCoins: dto.rewardCoins,
        icon: dto.icon ?? 'target',
        isActive: dto.isActive ?? 1,
        targetType: dto.targetType ?? 'all',
        targetGroupId: dto.targetGroupId ?? null,
      })
      .returning({ id: quests.id });
    if (!row) throw new Error('Insert failed');
    return { id: row.id };
  }

  async updateQuest(id: number, dto: UpdateQuestDto) {
    const { quests } = schema;
    const [existing] = await this.db.select().from(quests).where(eq(quests.id, id)).limit(1);
    if (!existing) throw new NotFoundException('Quest not found');
    const updates: Partial<typeof quests.$inferInsert> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.period !== undefined) updates.period = dto.period;
    if (dto.conditionType !== undefined) updates.conditionType = dto.conditionType;
    if (dto.conditionConfig !== undefined) updates.conditionConfig = dto.conditionConfig;
    if (dto.rewardCoins !== undefined) updates.rewardCoins = dto.rewardCoins;
    if (dto.icon !== undefined) updates.icon = dto.icon;
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;
    if (dto.targetType !== undefined) updates.targetType = dto.targetType;
    if (dto.targetGroupId !== undefined) updates.targetGroupId = dto.targetGroupId;
    if (Object.keys(updates).length === 0) return { id };
    await this.db.update(quests).set(updates).where(eq(quests.id, id));
    return { id };
  }

  async deleteQuest(id: number) {
    const { quests } = schema;
    const [existing] = await this.db.select().from(quests).where(eq(quests.id, id)).limit(1);
    if (!existing) throw new NotFoundException('Quest not found');
    await this.db.update(quests).set({ isActive: 0 }).where(eq(quests.id, id));
    return { id };
  }
}

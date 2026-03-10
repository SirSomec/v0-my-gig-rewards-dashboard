import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Envs } from '../../shared/env.validation-schema';
import * as schema from '../../infra/db/drizzle/schemas';
import { drizzleProvider } from '../../infra/db/drizzle/drizzle.module';
import { Inject } from '@nestjs/common';
import type { CreateQuestDto, CreateStoreItemDto, UpdateLevelDto, UpdateQuestDto, UpdateStoreItemDto } from './dto/admin.dto';
import { RewardsService } from '../rewards/rewards.service';
import { AdminContextService } from './admin-context.service';

@Injectable()
export class AdminService {
  constructor(
    @Inject(drizzleProvider)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly rewards: RewardsService,
    private readonly config: ConfigService<Envs, true>,
    private readonly adminContext: AdminContextService,
  ) {}

  async listUsers(search?: string, page = 1, pageSize = 20) {
    const { users, levels } = schema;
    const conditions: Parameters<typeof and>[0][] = [];
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(
        or(
          sql`${users.id}::text LIKE ${term}`,
          ilike(users.name, term),
          ilike(users.email, term),
          ilike(users.externalId, term),
        )!,
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .leftJoin(levels, eq(users.levelId, levels.id))
      .where(whereClause);
    const total = Number(countResult?.count ?? 0);

    const effectivePageSize = Math.min(100, Math.max(1, pageSize));
    const effectivePage = Math.max(1, page);
    const offset = (effectivePage - 1) * effectivePageSize;

    const items = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        externalId: users.externalId,
        balance: users.balance,
        shiftsCompleted: users.shiftsCompleted,
        levelId: users.levelId,
        levelName: levels.name,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .leftJoin(levels, eq(users.levelId, levels.id))
      .where(whereClause)
      .orderBy(users.id)
      .limit(effectivePageSize)
      .offset(offset);

    return { items, total, page: effectivePage, pageSize: effectivePageSize };
  }

  /** Создание пользователя по ID основной системы; имя отображается в личном кабинете (имя + фамилия из ETL). */
  async createUser(externalId: string, name: string): Promise<{ id: number }> {
    const { users, levels } = schema;
    const extId = externalId?.trim();
    const nameVal = name?.trim() || '';
    if (!extId) throw new BadRequestException('externalId is required');
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.externalId, extId)).limit(1);
    if (existing) throw new BadRequestException(`Пользователь с external_id "${extId}" уже существует (id=${existing.id})`);
    const [baseLevel] = await this.db
      .select({ id: levels.id })
      .from(levels)
      .orderBy(asc(levels.sortOrder))
      .limit(1);
    if (!baseLevel) throw new BadRequestException('В системе нет ни одного уровня. Создайте уровень в админке.');
    const [row] = await this.db
      .insert(users)
      .values({
        externalId: extId,
        name: nameVal || null,
        email: null,
        avatarUrl: null,
        balance: 0,
        levelId: baseLevel.id,
        shiftsCompleted: 0,
      })
      .returning({ id: users.id });
    if (!row) throw new Error('Insert user failed');
    return { id: row.id };
  }

  /**
   * Найти пользователя по external_id или создать нового (для первого входа через MyGig).
   * Возвращает id пользователя в нашей БД.
   */
  async ensureUserByExternalId(externalId: string, name: string): Promise<{ id: number }> {
    const { users, levels } = schema;
    const extId = externalId?.trim();
    const nameVal = name?.trim() || '';
    if (!extId) throw new BadRequestException('externalId is required');
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.externalId, extId)).limit(1);
    if (existing) return { id: existing.id };
    const [baseLevel] = await this.db
      .select({ id: levels.id })
      .from(levels)
      .orderBy(asc(levels.sortOrder))
      .limit(1);
    if (!baseLevel) throw new BadRequestException('В системе нет ни одного уровня. Создайте уровень в админке.');
    const [row] = await this.db
      .insert(users)
      .values({
        externalId: extId,
        name: nameVal || null,
        email: null,
        avatarUrl: null,
        balance: 0,
        levelId: baseLevel.id,
        shiftsCompleted: 0,
      })
      .returning({ id: users.id });
    if (!row) throw new Error('Insert user failed');
    return { id: row.id };
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
    const activeStrikesIn30d = strikesList.filter(
      (s) => !(s as { removedAt?: Date | null }).removedAt && (s.occurredAt as Date) >= thirtyDaysAgo,
    );
    return {
      ...userRow.user,
      levelName: userRow.level.name,
      strikesCount30d: activeStrikesIn30d.length,
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
        conditions.push(gte(redemptions.createdAt, d));
      }
    }
    if (opts.dateTo) {
      const d = new Date(opts.dateTo);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        conditions.push(lte(redemptions.createdAt, d));
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
    const now = new Date();
    const updated = await this.db
      .update(redemptions)
      .set({ status, processedAt: now, notes: notes ?? null })
      .where(
        and(eq(redemptions.id, redemptionId), eq(redemptions.status, 'pending')),
      )
      .returning();
    if (updated.length === 0) {
      const [r] = await this.db
        .select()
        .from(redemptions)
        .where(eq(redemptions.id, redemptionId))
        .limit(1);
      if (!r) throw new NotFoundException('Redemption not found');
      throw new NotFoundException('Redemption already processed');
    }
    const r = updated[0]!;
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
    await this.logAudit('redemption_update', 'redemption', String(redemptionId), undefined, {
      status,
      notes: notes ?? undefined,
      returnCoins,
    });
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
      const updatedRows = await this.db
        .update(redemptions)
        .set({ status, processedAt: now, notes: notes ?? null })
        .where(
          and(
            eq(redemptions.id, redemptionId),
            eq(redemptions.status, 'pending'),
          ),
        )
        .returning();
      if (updatedRows.length === 0) {
        const [existing] = await this.db
          .select()
          .from(redemptions)
          .where(eq(redemptions.id, redemptionId))
          .limit(1);
        if (!existing) {
          errors.push({ id: redemptionId, reason: 'not_found' });
        } else {
          errors.push({ id: redemptionId, reason: 'already_processed' });
        }
        continue;
      }
      const r = updatedRows[0]!;
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
    if (updated > 0) {
      await this.logAudit('redemption_bulk_update', 'redemption', ids.join(','), undefined, {
        status,
        count: updated,
        returnCoins,
        notes: notes ?? undefined,
      });
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
    await this.logAudit('store_item_create', 'store_item', String(row.id), undefined, {
      name: dto.name,
      category: dto.category,
      cost: dto.cost,
      isActive: dto.isActive ?? 1,
      sortOrder: dto.sortOrder ?? 0,
    });
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
    const oldSnapshot = {
      name: existing.name,
      category: existing.category,
      cost: existing.cost,
      isActive: existing.isActive,
      sortOrder: existing.sortOrder,
    };
    await this.logAudit('store_item_update', 'store_item', String(id), oldSnapshot, { ...oldSnapshot, ...updates });
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
    await this.logAudit('store_item_delete', 'store_item', String(id), {
      name: existing.name,
      category: existing.category,
      cost: existing.cost,
    }, undefined);
    return { id };
  }

  async listLevels() {
    const { levels } = schema;
    return this.db.select().from(levels).orderBy(levels.sortOrder);
  }

  /** Настройки бонусов: множитель по умолчанию (монет за 1 час смены) */
  async getBonusSettings(): Promise<{ shiftBonusDefaultMultiplier: number }> {
    const { systemSettings } = schema;
    const [row] = await this.db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'shift_bonus_default_multiplier'))
      .limit(1);
    let value = 10;
    if (row?.value != null) {
      const v = row.value;
      if (typeof v === 'number' && !Number.isNaN(v)) value = v;
      else if (typeof v === 'object' && typeof (v as { value?: number }).value === 'number') {
        value = (v as { value: number }).value;
      } else {
        const n = Number(v);
        if (!Number.isNaN(n)) value = n;
      }
    }
    return { shiftBonusDefaultMultiplier: value };
  }

  async updateBonusSettings(dto: { shiftBonusDefaultMultiplier: number }): Promise<void> {
    const { systemSettings } = schema;
    const value = Number(dto.shiftBonusDefaultMultiplier);
    if (Number.isNaN(value) || value < 0) throw new Error('shiftBonusDefaultMultiplier must be a non-negative number');
    const oldSettings = await this.getBonusSettings();
    const now = new Date();
    await this.db
      .insert(systemSettings)
      .values({
        key: 'shift_bonus_default_multiplier',
        value: value,
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: value, updatedAt: now },
      });
    await this.logAudit(
      'bonus_settings_update',
      'system_settings',
      'shift_bonus_default_multiplier',
      { shiftBonusDefaultMultiplier: oldSettings.shiftBonusDefaultMultiplier },
      { shiftBonusDefaultMultiplier: value },
    );
  }

  async updateLevel(id: number, dto: UpdateLevelDto) {
    const { levels } = schema;
    const [existing] = await this.db.select().from(levels).where(eq(levels.id, id)).limit(1);
    if (!existing) throw new NotFoundException('Level not found');
    if (dto.shiftsRequired !== undefined && dto.shiftsRequired !== 0) {
      const [firstLevel] = await this.db
        .select({ id: levels.id })
        .from(levels)
        .orderBy(asc(levels.sortOrder))
        .limit(1);
      if (firstLevel && firstLevel.id === id) {
        throw new BadRequestException(
          'У базового (первого) уровня лояльности порог смен должен быть 0 — он выдаётся изначально без условий.',
        );
      }
    }
    const updates: Partial<typeof levels.$inferInsert> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.shiftsRequired !== undefined) updates.shiftsRequired = dto.shiftsRequired;
    if (dto.strikeLimitPerWeek !== undefined) updates.strikeLimitPerWeek = dto.strikeLimitPerWeek;
    if (dto.strikeLimitPerMonth !== undefined) updates.strikeLimitPerMonth = dto.strikeLimitPerMonth;
    if (dto.perks !== undefined) updates.perks = dto.perks;
    if (dto.sortOrder !== undefined) updates.sortOrder = dto.sortOrder;
    if (dto.bonusMultiplier !== undefined) updates.bonusMultiplier = dto.bonusMultiplier;
    if (Object.keys(updates).length === 0) return { id };
    await this.db.update(levels).set(updates).where(eq(levels.id, id));
    const oldSnapshot = {
      name: existing.name,
      shiftsRequired: existing.shiftsRequired,
      strikeLimitPerWeek: existing.strikeLimitPerWeek,
      strikeLimitPerMonth: existing.strikeLimitPerMonth,
      sortOrder: existing.sortOrder,
      bonusMultiplier: existing.bonusMultiplier,
    };
    await this.logAudit('level_update', 'level', String(id), oldSnapshot, { ...oldSnapshot, ...updates });
    return { id };
  }

  async listQuests() {
    const { quests } = schema;
    return this.db.select().from(quests).orderBy(quests.id);
  }

  async createQuest(dto: CreateQuestDto) {
    const { quests } = schema;
    const now = new Date();
    let activeFrom: Date | null = dto.activeFrom ? new Date(dto.activeFrom) : null;
    let activeUntil: Date | null = dto.activeUntil ? new Date(dto.activeUntil) : null;
    if (dto.activeUntilEndOfPeriod && dto.period) {
      activeUntil = this.endOfPeriodUTC(now, dto.period);
    }
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
        isOneTime: dto.isOneTime ?? 0,
        activeFrom,
        activeUntil,
        targetType: dto.targetType ?? 'all',
        targetGroupId: dto.targetGroupId ?? null,
      })
      .returning({ id: quests.id });
    if (!row) throw new Error('Insert failed');
    await this.logAudit('quest_create', 'quest', String(row.id), undefined, {
      name: dto.name,
      period: dto.period,
      conditionType: dto.conditionType,
      rewardCoins: dto.rewardCoins,
      isActive: dto.isActive ?? 1,
      isOneTime: dto.isOneTime ?? 0,
    });
    return { id: row.id };
  }

  /** Конец текущего периода (последний момент включительно) в UTC */
  private endOfPeriodUTC(d: Date, period: 'daily' | 'weekly' | 'monthly'): Date {
    if (period === 'daily') {
      const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const next = new Date(dayStart.getTime() + 86400000);
      return new Date(next.getTime() - 1);
    }
    if (period === 'weekly') {
      const day = d.getUTCDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + mondayOffset));
      const weekEnd = new Date(monday.getTime() + 7 * 86400000);
      return new Date(weekEnd.getTime() - 1);
    }
    const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    return new Date(nextMonth.getTime() - 1);
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
    if (dto.isOneTime !== undefined) updates.isOneTime = dto.isOneTime;
    if (dto.activeFrom !== undefined) updates.activeFrom = dto.activeFrom ? new Date(dto.activeFrom) : null;
    if (dto.activeUntil !== undefined) updates.activeUntil = dto.activeUntil ? new Date(dto.activeUntil) : null;
    if (dto.targetType !== undefined) updates.targetType = dto.targetType;
    if (dto.targetGroupId !== undefined) updates.targetGroupId = dto.targetGroupId;
    if (Object.keys(updates).length === 0) return { id };
    await this.db.update(quests).set(updates).where(eq(quests.id, id));
    const oldSnapshot = {
      name: existing.name,
      period: existing.period,
      conditionType: existing.conditionType,
      rewardCoins: existing.rewardCoins,
      isActive: existing.isActive,
      isOneTime: existing.isOneTime,
    };
    await this.logAudit('quest_update', 'quest', String(id), oldSnapshot, { ...oldSnapshot, ...updates });
    return { id };
  }

  async deleteQuest(id: number) {
    const { quests } = schema;
    const [existing] = await this.db.select().from(quests).where(eq(quests.id, id)).limit(1);
    if (!existing) throw new NotFoundException('Quest not found');
    await this.db.update(quests).set({ isActive: 0 }).where(eq(quests.id, id));
    await this.logAudit('quest_delete', 'quest', String(id), {
      name: existing.name,
      conditionType: existing.conditionType,
      rewardCoins: existing.rewardCoins,
    }, undefined);
    return { id };
  }

  /** Группы пользователей (для квестов target_type=group) */
  async listUserGroups() {
    const { userGroups, userGroupMembers } = schema;
    const groups = await this.db
      .select()
      .from(userGroups)
      .where(isNull(userGroups.deletedAt))
      .orderBy(userGroups.id);
    const memberCounts = await this.db
      .select({ groupId: userGroupMembers.groupId, count: sql<number>`count(*)::int` })
      .from(userGroupMembers)
      .where(isNull(userGroupMembers.deletedAt))
      .groupBy(userGroupMembers.groupId);
    const countMap = new Map(memberCounts.map((r) => [r.groupId, r.count]));
    return groups.map((g) => ({ ...g, memberCount: countMap.get(g.id) ?? 0 }));
  }

  async getUserGroup(id: number) {
    const { userGroups } = schema;
    const [row] = await this.db
      .select()
      .from(userGroups)
      .where(and(eq(userGroups.id, id), isNull(userGroups.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException('User group not found');
    return row;
  }

  async createUserGroup(dto: { name: string; description?: string | null }) {
    const { userGroups } = schema;
    const name = (dto.name ?? '').trim();
    if (!name) throw new BadRequestException('name is required');
    const [row] = await this.db
      .insert(userGroups)
      .values({ name, description: dto.description?.trim() || null })
      .returning({ id: userGroups.id });
    if (!row) throw new Error('Insert user group failed');
    await this.logAudit('user_group_create', 'user_group', String(row.id), undefined, {
      name,
      description: dto.description?.trim() || undefined,
    });
    return { id: row.id };
  }

  async updateUserGroup(id: number, dto: { name?: string; description?: string | null }) {
    const { userGroups } = schema;
    const [existing] = await this.db
      .select()
      .from(userGroups)
      .where(and(eq(userGroups.id, id), isNull(userGroups.deletedAt)))
      .limit(1);
    if (!existing) throw new NotFoundException('User group not found');
    const updates: Partial<typeof userGroups.$inferInsert> = {};
    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.description !== undefined) updates.description = dto.description?.trim() || null;
    if (Object.keys(updates).length === 0) return { id };
    await this.db.update(userGroups).set(updates).where(eq(userGroups.id, id));
    const oldSnapshot = { name: existing.name, description: existing.description };
    await this.logAudit('user_group_update', 'user_group', String(id), oldSnapshot, { ...oldSnapshot, ...updates });
    return { id };
  }

  async deleteUserGroup(id: number) {
    const { userGroups } = schema;
    const [existing] = await this.db
      .select()
      .from(userGroups)
      .where(and(eq(userGroups.id, id), isNull(userGroups.deletedAt)))
      .limit(1);
    if (!existing) throw new NotFoundException('User group not found');
    const now = new Date();
    await this.db.update(userGroups).set({ deletedAt: now }).where(eq(userGroups.id, id));
    await this.logAudit('user_group_delete', 'user_group', String(id), {
      name: existing.name,
    }, undefined);
    return { id };
  }

  async listGroupMembers(groupId: number) {
    const { userGroupMembers, users } = schema;
    const [group] = await this.db
      .select()
      .from(schema.userGroups)
      .where(and(eq(schema.userGroups.id, groupId), isNull(schema.userGroups.deletedAt)))
      .limit(1);
    if (!group) throw new NotFoundException('User group not found');
    const rows = await this.db
      .select({
        userId: users.id,
        userName: users.name,
        email: users.email,
        externalId: users.externalId,
      })
      .from(userGroupMembers)
      .innerJoin(users, eq(userGroupMembers.userId, users.id))
      .where(and(eq(userGroupMembers.groupId, groupId), isNull(userGroupMembers.deletedAt)));
    return { group: { id: group.id, name: group.name, description: group.description }, items: rows };
  }

  async addGroupMember(groupId: number, userId: number) {
    const { userGroups, userGroupMembers, users } = schema;
    const [group] = await this.db
      .select()
      .from(userGroups)
      .where(and(eq(userGroups.id, groupId), isNull(userGroups.deletedAt)))
      .limit(1);
    if (!group) throw new NotFoundException('User group not found');
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new NotFoundException('User not found');
    const [existing] = await this.db
      .select()
      .from(userGroupMembers)
      .where(
        and(
          eq(userGroupMembers.groupId, groupId),
          eq(userGroupMembers.userId, userId),
          isNull(userGroupMembers.deletedAt),
        ),
      )
      .limit(1);
    if (existing) return { id: existing.id, added: false };
    const [row] = await this.db
      .insert(userGroupMembers)
      .values({ groupId, userId })
      .returning({ id: userGroupMembers.id });
    if (!row) throw new Error('Insert group member failed');
    await this.logAudit('group_member_add', 'user_group_member', String(row.id), undefined, {
      groupId,
      userId,
    });
    return { id: row.id, added: true };
  }

  async removeGroupMember(groupId: number, userId: number) {
    const { userGroupMembers } = schema;
    const [existing] = await this.db
      .select()
      .from(userGroupMembers)
      .where(
        and(
          eq(userGroupMembers.groupId, groupId),
          eq(userGroupMembers.userId, userId),
          isNull(userGroupMembers.deletedAt),
        ),
      )
      .limit(1);
    if (!existing) throw new NotFoundException('Group member not found');
    const now = new Date();
    await this.db
      .update(userGroupMembers)
      .set({ deletedAt: now })
      .where(eq(userGroupMembers.id, existing.id));
    await this.logAudit('group_member_remove', 'user_group_member', String(existing.id), {
      groupId,
      userId,
    }, undefined);
    return { id: existing.id };
  }

  /**
   * Импорт участников группы по списку идентификаторов.
   * Каждая строка — id (число), email или external_id. Дубликаты и несуществующие пользователи пропускаются.
   */
  async importGroupMembers(groupId: number, identifiers: string[]) {
    const { userGroups, users, userGroupMembers } = schema;
    const [group] = await this.db
      .select()
      .from(userGroups)
      .where(and(eq(userGroups.id, groupId), isNull(userGroups.deletedAt)))
      .limit(1);
    if (!group) throw new NotFoundException('User group not found');

    const userIds = new Set<number>();
    for (const raw of identifiers) {
      const s = (raw ?? '').toString().trim();
      if (!s) continue;
      const asId = /^\d+$/.test(s) ? parseInt(s, 10) : null;
      let found: { id: number } | undefined;
      if (asId != null && !Number.isNaN(asId)) {
        [found] = await this.db.select({ id: users.id }).from(users).where(eq(users.id, asId)).limit(1);
      }
      if (!found) {
        [found] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, s)).limit(1);
      }
      if (!found) {
        [found] = await this.db.select({ id: users.id }).from(users).where(eq(users.externalId, s)).limit(1);
      }
      if (found) userIds.add(found.id);
    }

    const existingMembers = await this.db
      .select({ userId: userGroupMembers.userId })
      .from(userGroupMembers)
      .where(and(eq(userGroupMembers.groupId, groupId), isNull(userGroupMembers.deletedAt)));
    const existingSet = new Set(existingMembers.map((r) => r.userId));
    const toAdd = [...userIds].filter((id) => !existingSet.has(id));

    let added = 0;
    for (const userId of toAdd) {
      await this.db.insert(userGroupMembers).values({ groupId, userId });
      added++;
      existingSet.add(userId);
    }
    if (added > 0) {
      await this.logAudit('group_member_import', 'user_group', String(groupId), undefined, {
        added,
        totalRequested: identifiers.filter((x) => (x ?? '').toString().trim()).length,
        resolved: userIds.size,
      });
    }
    return { added, totalRequested: identifiers.filter((x) => (x ?? '').toString().trim()).length, resolved: userIds.size };
  }

  /** Ручное изменение уровня пользователя (6.5) */
  async updateUserLevel(userId: number, levelId: number) {
    const { users, levels } = schema;
    const [levelRow] = await this.db.select().from(levels).where(eq(levels.id, levelId)).limit(1);
    if (!levelRow) throw new NotFoundException('Level not found');
    const [userRow] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!userRow) throw new NotFoundException('User not found');
    const oldLevelId = userRow.levelId;
    await this.db
      .update(users)
      .set({ levelId, shiftsCompleted: 0 })
      .where(eq(users.id, userId));
    await this.logAudit('user_level_change', 'user', String(userId), { levelId: oldLevelId }, { levelId });
    return { id: userId, levelId };
  }

  /** Ручное начисление или списание монет (6.6) */
  async manualCreditDebit(
    userId: number,
    amount: number,
    type: 'manual_credit' | 'manual_debit',
    title?: string,
    description?: string,
  ) {
    const { users, transactions } = schema;
    const [userRow] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!userRow) throw new NotFoundException('User not found');
    if (amount <= 0) throw new Error('amount must be positive');
    const txAmount = type === 'manual_debit' ? -amount : amount;
    const newBalance = userRow.balance + txAmount;
    if (newBalance < 0) throw new Error('Insufficient balance for debit');
    const defaultTitle = type === 'manual_credit' ? 'Ручное начисление' : 'Ручное списание';
    await this.db.update(users).set({ balance: newBalance }).where(eq(users.id, userId));
    const [inserted] = await this.db
      .insert(transactions)
      .values({
        userId,
        amount: txAmount,
        type,
        title: title?.trim() || defaultTitle,
        description: description?.trim() || null,
        createdBy: null,
      })
      .returning({ id: transactions.id });
    await this.logAudit('manual_transaction', 'transaction', String(inserted!.id), undefined, {
      userId,
      amount: txAmount,
      type,
      title: title?.trim() || defaultTitle,
      description: description?.trim() || undefined,
    });
    return { transactionId: inserted!.id, newBalance };
  }

  /** Снять штраф с причиной и пересчитать уровень (6.7) */
  async removeStrike(strikeId: number, reason: string) {
    const { strikes } = schema;
    const [strike] = await this.db.select().from(strikes).where(eq(strikes.id, strikeId)).limit(1);
    if (!strike) throw new NotFoundException('Strike not found');
    if ((strike as { removedAt?: Date | null }).removedAt) {
      throw new NotFoundException('Strike already removed');
    }
    const now = new Date();
    await this.db
      .update(strikes)
      .set({
        removedAt: now,
        removalReason: reason?.trim() || null,
      })
      .where(eq(strikes.id, strikeId));
    await this.rewards.recalcUserLevelConsideringStrikes(strike.userId);
    await this.rewards.recalcQuestProgressForUser(strike.userId);
    await this.logAudit('strike_removed', 'strike', String(strikeId), undefined, {
      userId: strike.userId,
      reason: reason?.trim() || undefined,
    });
    return { id: strikeId, userId: strike.userId };
  }

  /**
   * Обработка поздней отмены смены из TOJ: если meta.initiatorType=worker (или initiator=worker) и отмена
   * менее чем за 24 ч до начала — начисляется штраф «поздняя отмена» и запись в активностях (strikes) и аудите.
   */
  async processTojLateCancel(params: {
    jobId: string;
    workerId: string;
    jobStart: string;
    cancelledAt: string;
    /** meta.initiatorType из TOJ (job.update.command); при "worker" штраф применяется */
    initiatorType?: string;
    initiator?: string;
  }): Promise<{ applied: boolean; strikeId?: number; reason?: string }> {
    const payload: Parameters<RewardsService['processLateCancelIfEligible']>[0] = {
      jobId: params.jobId,
      workerId: params.workerId,
      jobStartIso: params.jobStart,
      cancelledAtIso: params.cancelledAt,
    };
    if (params.initiatorType != null && params.initiatorType !== '') payload.initiatorType = params.initiatorType;
    if (params.initiator != null && params.initiator !== '') payload.initiator = params.initiator;
    const result = await this.rewards.processLateCancelIfEligible(payload);
    if (result.applied && result.strikeId != null) {
      await this.logAudit('late_cancel_applied', 'strike', String(result.strikeId), undefined, {
        jobId: params.jobId,
        workerId: params.workerId,
        jobStart: params.jobStart,
        cancelledAt: params.cancelledAt,
        initiatorType: params.initiatorType,
        initiator: params.initiator,
      });
    }
    return result;
  }

  /** Запись в журнал аудита (6.9). adminId подставляется из контекста запроса (кто из админов выполнил действие). */
  async logAudit(
    action: string,
    entityType: string,
    entityId: string,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>,
    adminId?: number | null,
  ) {
    const { auditLog } = schema;
    const resolvedAdminId = adminId ?? this.adminContext.getAdminId() ?? null;
    await this.db.insert(auditLog).values({
      adminId: resolvedAdminId,
      action,
      entityType,
      entityId,
      oldValues: oldValues ?? null,
      newValues: newValues ?? null,
    });
  }

  /** Список записей аудита с пагинацией (6.9). Возвращает adminDisplay (кто выполнил) и entityExternalId (external_id пользователя при любом отношении к пользователю: user, transaction, strike, redemption, user_group_member). */
  async listAuditLog(opts: { page?: number; pageSize?: number; action?: string; entityType?: string } = {}) {
    const { auditLog, adminPanelUsers, users, transactions, strikes, redemptions, userGroupMembers } = schema;
    const usersViaTx = alias(users, 'users_via_tx');
    const usersViaStrike = alias(users, 'users_via_strike');
    const usersViaRedemption = alias(users, 'users_via_redemption');
    const usersViaMember = alias(users, 'users_via_member');

    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
    const conditions: Parameters<typeof and>[0][] = [];
    if (opts.action?.trim()) {
      conditions.push(eq(auditLog.action, opts.action.trim()));
    }
    if (opts.entityType?.trim()) {
      conditions.push(eq(auditLog.entityType, opts.entityType.trim()));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(whereClause);
    const total = Number(countResult?.count ?? 0);

    const superEmail = this.config.get<string>('ADMIN_SUPER_EMAIL')?.trim() ?? null;

    const rows = await this.db
      .select({
        id: auditLog.id,
        adminId: auditLog.adminId,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        oldValues: auditLog.oldValues,
        newValues: auditLog.newValues,
        createdAt: auditLog.createdAt,
        adminEmail: adminPanelUsers.email,
        entityExternalIdUser: users.externalId,
        entityExternalIdViaTx: usersViaTx.externalId,
        entityExternalIdViaStrike: usersViaStrike.externalId,
        entityExternalIdViaRedemption: usersViaRedemption.externalId,
        entityExternalIdViaMember: usersViaMember.externalId,
      })
      .from(auditLog)
      .leftJoin(adminPanelUsers, eq(auditLog.adminId, adminPanelUsers.id))
      .leftJoin(
        users,
        and(
          eq(auditLog.entityType, 'user'),
          sql`${auditLog.entityId} = (${users.id})::text`,
        ),
      )
      .leftJoin(
        transactions,
        and(
          eq(auditLog.entityType, 'transaction'),
          sql`${auditLog.entityId} = (${transactions.id})::text`,
        ),
      )
      .leftJoin(usersViaTx, eq(transactions.userId, usersViaTx.id))
      .leftJoin(
        strikes,
        and(
          eq(auditLog.entityType, 'strike'),
          sql`${auditLog.entityId} = (${strikes.id})::text`,
        ),
      )
      .leftJoin(usersViaStrike, eq(strikes.userId, usersViaStrike.id))
      .leftJoin(
        redemptions,
        and(
          eq(auditLog.entityType, 'redemption'),
          sql`${auditLog.entityId} = (${redemptions.id})::text`,
        ),
      )
      .leftJoin(usersViaRedemption, eq(redemptions.userId, usersViaRedemption.id))
      .leftJoin(
        userGroupMembers,
        and(
          eq(auditLog.entityType, 'user_group_member'),
          sql`${auditLog.entityId} = (${userGroupMembers.id})::text`,
        ),
      )
      .leftJoin(usersViaMember, eq(userGroupMembers.userId, usersViaMember.id))
      .where(whereClause)
      .orderBy(sql`${auditLog.createdAt} desc`)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const items = rows.map((r) => ({
      id: r.id,
      adminId: r.adminId,
      adminDisplay:
        r.adminId == null && superEmail ? `суперадмин (${superEmail})` : r.adminEmail ?? (r.adminId == null ? 'суперадмин' : null),
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      entityExternalId:
        r.entityExternalIdUser ??
        r.entityExternalIdViaTx ??
        r.entityExternalIdViaStrike ??
        r.entityExternalIdViaRedemption ??
        r.entityExternalIdViaMember ??
        null,
      oldValues: r.oldValues,
      newValues: r.newValues,
      createdAt: r.createdAt,
    }));

    return { items, total, page, pageSize };
  }

  /** Проверка: настроен ли мок TOJ (для отображения в админке). */
  getMockTojConfig(): { configured: boolean } {
    const url = this.config.get('MOCK_TOJ_URL', { infer: true });
    const key = this.config.get('MOCK_TOJ_ADMIN_KEY', { infer: true });
    return { configured: !!(url?.trim() && key?.trim()) };
  }

  /**
   * Запросить у мок-сервиса TOJ генерацию смен для выбранного пользователя (по external_id).
   * Требует MOCK_TOJ_URL и MOCK_TOJ_ADMIN_KEY в env.
   */
  async mockTojGenerate(params: {
    userId?: number;
    workerIds?: string[];
    count: number;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ generated: number }> {
    const baseUrl = this.config.get('MOCK_TOJ_URL', { infer: true })?.replace(/\/$/, '');
    const adminKey = this.config.get('MOCK_TOJ_ADMIN_KEY', { infer: true });
    if (!baseUrl || !adminKey) {
      throw new BadRequestException('Mock TOJ not configured (MOCK_TOJ_URL, MOCK_TOJ_ADMIN_KEY)');
    }
    let workerIds = params.workerIds;
    if (params.userId != null) {
      const [row] = await this.db
        .select({ externalId: schema.users.externalId })
        .from(schema.users)
        .where(eq(schema.users.id, params.userId))
        .limit(1);
      if (!row?.externalId?.trim()) {
        throw new BadRequestException(
          `User ${params.userId} has no external_id. Set external_id in admin to link to TOJ worker.`,
        );
      }
      workerIds = [row.externalId.trim()];
    }
    if (!workerIds?.length) {
      throw new BadRequestException('Provide userId or workerIds');
    }
    const count = Math.min(Math.max(Number(params.count) || 10, 1), 500);
    const url = `${baseUrl}/admin/generate-jobs`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey,
      },
      body: JSON.stringify({
        count,
        workerIds,
        dateFrom: params.dateFrom || undefined,
        dateTo: params.dateTo || undefined,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Mock TOJ: ${res.status} ${text || res.statusText}`);
    }
    const data = (await res.json()) as { data?: { generated?: number } };
    const generated = data?.data?.generated ?? 0;
    return { generated };
  }

  /**
   * Создать одну забронированную смену в моке TOJ (POST /admin/create-booked-job в моке).
   * workerId = external_id пользователя; дата старта смены — в body.start (ISO).
   */
  async mockTojCreateBookedJob(params: {
    workerId: string;
    start: string;
    finish?: string;
    customName?: string;
    spec?: string;
    clientId?: string;
    hours?: number;
  }): Promise<{ job: Record<string, unknown> }> {
    const baseUrl = this.config.get('MOCK_TOJ_URL', { infer: true })?.replace(/\/$/, '');
    const adminKey = this.config.get('MOCK_TOJ_ADMIN_KEY', { infer: true });
    if (!baseUrl || !adminKey) {
      throw new BadRequestException('Mock TOJ not configured (MOCK_TOJ_URL, MOCK_TOJ_ADMIN_KEY)');
    }
    const workerId = params.workerId?.trim();
    if (!workerId) throw new BadRequestException('workerId required');
    const start = params.start?.trim();
    if (!start) throw new BadRequestException('start required (ISO date-time)');
    const url = `${baseUrl}/admin/create-booked-job`;
    const body: Record<string, unknown> = { workerId, start };
    if (params.finish?.trim()) body.finish = params.finish.trim();
    if (params.customName?.trim()) body.customName = params.customName.trim();
    if (params.spec?.trim()) body.spec = params.spec.trim();
    if (params.clientId?.trim()) body.clientId = params.clientId.trim();
    if (params.hours != null && params.hours > 0) body.hours = params.hours;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Mock TOJ: ${res.status} ${text || res.statusText}`);
    }
    const data = (await res.json()) as { data?: Record<string, unknown> };
    const job = data?.data ?? {};
    return { job };
  }
  async mockTojListJobs(params?: { limit?: number; skip?: number }): Promise<{ items: unknown[]; total: number }> {
    const baseUrl = this.config.get('MOCK_TOJ_URL', { infer: true })?.replace(/\/$/, '');
    const adminKey = this.config.get('MOCK_TOJ_ADMIN_KEY', { infer: true });
    if (!baseUrl || !adminKey) {
      throw new BadRequestException('Mock TOJ not configured (MOCK_TOJ_URL, MOCK_TOJ_ADMIN_KEY)');
    }
    const limit = Math.min(Math.max(Number(params?.limit) || 100, 1), 500);
    const skip = Math.max(Number(params?.skip) || 0, 0);
    const url = `${baseUrl}/admin/jobs?limit=${limit}&skip=${skip}`;
    const res = await fetch(url, {
      headers: { 'X-Admin-Key': adminKey },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Mock TOJ: ${res.status} ${text || res.statusText}`);
    }
    const data = (await res.json()) as { data?: { items?: unknown[]; total?: number } };
    return {
      items: data?.data?.items ?? [],
      total: data?.data?.total ?? 0,
    };
  }

  /**
   * Изменить статус смены в моке TOJ с указанием инициатора (PATCH /admin/jobs/:id в моке).
   */
  async mockTojUpdateJobStatus(
    jobId: string,
    body: { status: string; initiatorType?: string; initiator?: string },
  ): Promise<Record<string, unknown>> {
    const baseUrl = this.config.get('MOCK_TOJ_URL', { infer: true })?.replace(/\/$/, '');
    const adminKey = this.config.get('MOCK_TOJ_ADMIN_KEY', { infer: true });
    if (!baseUrl || !adminKey) {
      throw new BadRequestException('Mock TOJ not configured (MOCK_TOJ_URL, MOCK_TOJ_ADMIN_KEY)');
    }
    const id = jobId?.trim();
    if (!id) throw new BadRequestException('jobId required');
    const url = `${baseUrl}/admin/jobs/${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey,
      },
      body: JSON.stringify({
        status: body.status?.trim(),
        initiatorType: body.initiatorType?.trim(),
        initiator: body.initiator?.trim(),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Mock TOJ: ${res.status} ${text || res.statusText}`);
    }
    const data = (await res.json()) as { data?: Record<string, unknown> };
    return data?.data ?? {};
  }
}

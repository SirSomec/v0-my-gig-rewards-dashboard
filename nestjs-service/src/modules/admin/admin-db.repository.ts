import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../infra/db/drizzle/schemas';
import { drizzleProvider } from '../../infra/db/drizzle/drizzle.module';
import type { AdminPermissionKey } from '../../infra/db/drizzle/schemas';

@Injectable()
export class AdminDbRepository {
  constructor(
    @Inject(drizzleProvider)
    private readonly client: PostgresJsDatabase<typeof schema>,
  ) {}

  get db(): PostgresJsDatabase<typeof schema> {
    return this.client;
  }

  async findActiveAdminByEmail(email: string): Promise<(typeof schema.adminPanelUsers.$inferSelect) | null> {
    const [row] = await this.client
      .select()
      .from(schema.adminPanelUsers)
      .where(
        and(
          eq(schema.adminPanelUsers.email, email),
          eq(schema.adminPanelUsers.isActive, 1),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listAdminUsers(): Promise<
    { id: number; email: string; name: string | null; isActive: number; permissions: AdminPermissionKey[] }[]
  > {
    const rows = await this.client
      .select({
        id: schema.adminPanelUsers.id,
        email: schema.adminPanelUsers.email,
        name: schema.adminPanelUsers.name,
        isActive: schema.adminPanelUsers.isActive,
        permissions: schema.adminPanelUsers.permissions,
      })
      .from(schema.adminPanelUsers)
      .orderBy(schema.adminPanelUsers.id);

    return rows.map((row) => ({
      ...row,
      permissions: (row.permissions ?? []) as AdminPermissionKey[],
    }));
  }

  async findAdminUserByEmail(email: string): Promise<{ id: number } | null> {
    const [row] = await this.client
      .select({ id: schema.adminPanelUsers.id })
      .from(schema.adminPanelUsers)
      .where(eq(schema.adminPanelUsers.email, email))
      .limit(1);
    return row ?? null;
  }

  async insertAdminUser(params: {
    email: string;
    passwordHash: string;
    name: string | null;
    permissions: AdminPermissionKey[];
  }): Promise<number> {
    const [row] = await this.client
      .insert(schema.adminPanelUsers)
      .values({
        email: params.email,
        passwordHash: params.passwordHash,
        name: params.name,
        isActive: 1,
        permissions: params.permissions,
      })
      .returning({ id: schema.adminPanelUsers.id });
    if (!row) throw new Error('Insert admin user failed');
    return row.id;
  }

  async findAdminUserById(id: number): Promise<(typeof schema.adminPanelUsers.$inferSelect) | null> {
    const [row] = await this.client
      .select()
      .from(schema.adminPanelUsers)
      .where(eq(schema.adminPanelUsers.id, id))
      .limit(1);
    return row ?? null;
  }

  async updateAdminUser(id: number, updates: Partial<typeof schema.adminPanelUsers.$inferInsert>): Promise<void> {
    await this.client
      .update(schema.adminPanelUsers)
      .set(updates)
      .where(eq(schema.adminPanelUsers.id, id));
  }

  async deleteAdminUser(id: number): Promise<void> {
    await this.client
      .delete(schema.adminPanelUsers)
      .where(eq(schema.adminPanelUsers.id, id));
  }

  async insertAuditLog(params: {
    adminId: number | null;
    action: string;
    entityType: string;
    entityId: string;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.client.insert(schema.auditLog).values({
      adminId: params.adminId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValues: params.oldValues ?? null,
      newValues: params.newValues ?? null,
    });
  }

  async getSystemSettingValue(key: string): Promise<unknown | null> {
    const [row] = await this.client
      .select({ value: schema.systemSettings.value })
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, key))
      .limit(1);
    return row?.value ?? null;
  }

  async upsertSystemSettingValue(key: string, value: number, updatedAt: Date): Promise<void> {
    await this.client
      .insert(schema.systemSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: schema.systemSettings.key,
        set: { value, updatedAt },
      });
  }

  /** Установить значение настройки (любой JSON-тип, например boolean для loyalty_pre_registration_enabled). */
  async setSystemSetting(key: string, value: unknown): Promise<void> {
    const now = new Date();
    await this.client
      .insert(schema.systemSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: schema.systemSettings.key,
        set: { value, updatedAt: now },
      });
  }

  /** Включена ли предварительная регистрация в программе лояльности. */
  async getLoyaltyPreRegistrationEnabled(): Promise<boolean> {
    const v = await this.getSystemSettingValue('loyalty_pre_registration_enabled');
    if (v === true || v === 'true' || v === 1) return true;
    if (typeof v === 'object' && v != null && (v as { value?: boolean }).value === true) return true;
    return false;
  }

  /** Установить loyalty_requested_at для пользователя (нажал «Зарегистрироваться»). Возвращает true, если обновлено. */
  async setUserLoyaltyRequestedAt(userId: number): Promise<boolean> {
    const now = new Date();
    const result = await this.client
      .update(schema.users)
      .set({ loyaltyRequestedAt: now })
      .where(
        and(
          eq(schema.users.id, userId),
          eq(schema.users.loyaltyStatus, 'pending'),
          sql`${schema.users.loyaltyRequestedAt} IS NULL`,
        ),
      )
      .returning({ id: schema.users.id });
    return result.length > 0;
  }

  /** Одобрить заявку на участие: active, loyalty_approved_at, loyalty_started_at. adminId может быть null (X-Admin-Key). */
  async approveUserLoyalty(userId: number, adminId: number | null): Promise<boolean> {
    const now = new Date();
    const result = await this.client
      .update(schema.users)
      .set({
        loyaltyStatus: 'active',
        loyaltyApprovedAt: now,
        loyaltyApprovedByAdminId: adminId,
        loyaltyStartedAt: now,
      })
      .where(and(eq(schema.users.id, userId), eq(schema.users.loyaltyStatus, 'pending')))
      .returning({ id: schema.users.id });
    return result.length > 0;
  }

  /** При выключении предрегистрации: перевести всех pending в active, loyalty_started_at = COALESCE(approved_at, created_at). */
  async setAllPendingUsersActive(): Promise<number> {
    const result = await this.client
      .update(schema.users)
      .set({
        loyaltyStatus: 'active',
        loyaltyStartedAt: sql`COALESCE(${schema.users.loyaltyApprovedAt}, ${schema.users.createdAt})`,
      })
      .where(eq(schema.users.loyaltyStatus, 'pending'))
      .returning({ id: schema.users.id });
    return result.length;
  }

  async findUserExternalIdById(userId: number): Promise<string | null> {
    const [row] = await this.client
      .select({ externalId: schema.users.externalId })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    return row?.externalId?.trim() ? row.externalId.trim() : null;
  }

  async findUserIdByExternalId(externalId: string): Promise<number | null> {
    const [row] = await this.client
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.externalId, externalId))
      .limit(1);
    return row?.id ?? null;
  }

  async getBaseLevelId(): Promise<number | null> {
    const [row] = await this.client
      .select({ id: schema.levels.id })
      .from(schema.levels)
      .orderBy(schema.levels.sortOrder)
      .limit(1);
    return row?.id ?? null;
  }

  async insertUser(params: {
    externalId: string;
    name: string | null;
    levelId: number;
    loyaltyStatus?: 'active' | 'pending';
  }): Promise<number> {
    const [row] = await this.client
      .insert(schema.users)
      .values({
        externalId: params.externalId,
        name: params.name,
        email: null,
        avatarUrl: null,
        balance: 0,
        levelId: params.levelId,
        shiftsCompleted: 0,
        loyaltyStatus: params.loyaltyStatus ?? 'active',
      })
      .returning({ id: schema.users.id });
    if (!row) throw new Error('Insert user failed');
    return row.id;
  }

  async findLevelById(levelId: number): Promise<(typeof schema.levels.$inferSelect) | null> {
    const [row] = await this.client
      .select()
      .from(schema.levels)
      .where(eq(schema.levels.id, levelId))
      .limit(1);
    return row ?? null;
  }

  async getUserById(userId: number): Promise<(typeof schema.users.$inferSelect) | null> {
    const [row] = await this.client
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    return row ?? null;
  }

  async updateUserLevelAndResetShifts(userId: number, levelId: number): Promise<void> {
    await this.client
      .update(schema.users)
      .set({ levelId, shiftsCompleted: 0 })
      .where(eq(schema.users.id, userId));
  }

  async updateUserBalance(userId: number, balance: number): Promise<void> {
    await this.client
      .update(schema.users)
      .set({ balance })
      .where(eq(schema.users.id, userId));
  }

  async insertTransaction(params: {
    userId: number;
    amount: number;
    type: 'manual_credit' | 'manual_debit';
    title: string;
    description?: string | null;
    createdBy?: number | null;
  }): Promise<number> {
    const [row] = await this.client
      .insert(schema.transactions)
      .values({
        userId: params.userId,
        amount: params.amount,
        type: params.type,
        title: params.title,
        description: params.description ?? null,
        createdBy: params.createdBy ?? null,
      })
      .returning({ id: schema.transactions.id });
    if (!row) throw new Error('Insert transaction failed');
    return row.id;
  }

  async getStrikeById(strikeId: number): Promise<(typeof schema.strikes.$inferSelect) | null> {
    const [row] = await this.client
      .select()
      .from(schema.strikes)
      .where(eq(schema.strikes.id, strikeId))
      .limit(1);
    return row ?? null;
  }

  async markStrikeRemoved(strikeId: number, removedAt: Date, removalReason: string | null): Promise<void> {
    await this.client
      .update(schema.strikes)
      .set({
        removedAt,
        removalReason,
      })
      .where(eq(schema.strikes.id, strikeId));
  }

  async listUsers(
    search: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<{
    items: Array<{
      id: number;
      name: string | null;
      email: string | null;
      externalId: string | null;
      balance: number;
      shiftsCompleted: number;
      levelId: number;
      levelName: string | null;
      createdAt: Date;
      updatedAt: Date;
      loyaltyStatus: string | null;
      loyaltyRequestedAt: Date | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
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
    const effectivePageSize = Math.min(100, Math.max(1, pageSize));
    const effectivePage = Math.max(1, page);
    const offset = (effectivePage - 1) * effectivePageSize;

    const [countResult] = await this.client
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .leftJoin(levels, eq(users.levelId, levels.id))
      .where(whereClause);
    const total = Number(countResult?.count ?? 0);

    const items = await this.client
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
        loyaltyStatus: users.loyaltyStatus,
        loyaltyRequestedAt: users.loyaltyRequestedAt,
      })
      .from(users)
      .leftJoin(levels, eq(users.levelId, levels.id))
      .where(whereClause)
      .orderBy(users.id)
      .limit(effectivePageSize)
      .offset(offset);

    return { items, total, page: effectivePage, pageSize: effectivePageSize };
  }

  async getUserDetailData(userId: number): Promise<{
    user: (typeof schema.users.$inferSelect) | null;
    levelName: string | null;
    strikes: (typeof schema.strikes.$inferSelect)[];
    recentTransactions: (typeof schema.transactions.$inferSelect)[];
  }> {
    const { users, levels, strikes, transactions } = schema;
    const [userRow] = await this.client
      .select({ user: users, levelName: levels.name })
      .from(users)
      .innerJoin(levels, eq(users.levelId, levels.id))
      .where(eq(users.id, userId))
      .limit(1);
    if (!userRow) {
      return {
        user: null,
        levelName: null,
        strikes: [],
        recentTransactions: [],
      };
    }
    const strikesList = await this.client
      .select()
      .from(strikes)
      .where(eq(strikes.userId, userId))
      .orderBy(sql`${strikes.occurredAt} desc`)
      .limit(20);
    const recentTransactions = await this.client
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(sql`${transactions.createdAt} desc`)
      .limit(20);
    return {
      user: userRow.user,
      levelName: userRow.levelName,
      strikes: strikesList,
      recentTransactions,
    };
  }

  async listRedemptions(opts: {
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: Array<{
      id: number;
      userId: number;
      userName: string | null;
      storeItemId: number;
      itemName: string;
      status: string;
      coinsSpent: number;
      createdAt: Date;
      processedAt: Date | null;
      notes: string | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { redemptions, users, storeItems } = schema;
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, opts.pageSize ?? 50));
    const conditions: Parameters<typeof and>[0][] = [];
    if (opts.status?.trim()) {
      conditions.push(eq(redemptions.status, opts.status.trim()));
    }
    if (opts.dateFrom) {
      const d = new Date(opts.dateFrom);
      if (!Number.isNaN(d.getTime())) conditions.push(gte(redemptions.createdAt, d));
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

    const [countResult] = await this.client
      .select({ count: sql<number>`count(*)::int` })
      .from(redemptions)
      .innerJoin(users, eq(redemptions.userId, users.id))
      .innerJoin(storeItems, eq(redemptions.storeItemId, storeItems.id))
      .where(whereClause);
    const total = Number(countResult?.count ?? 0);

    const items = await this.client
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

  async tryUpdatePendingRedemption(
    redemptionId: number,
    status: 'fulfilled' | 'cancelled',
    notes: string | undefined,
    processedAt: Date,
  ): Promise<(typeof schema.redemptions.$inferSelect) | null> {
    const { redemptions } = schema;
    const updated = await this.client
      .update(redemptions)
      .set({ status, processedAt, notes: notes ?? null })
      .where(and(eq(redemptions.id, redemptionId), eq(redemptions.status, 'pending')))
      .returning();
    return updated[0] ?? null;
  }

  async getRedemptionById(redemptionId: number): Promise<(typeof schema.redemptions.$inferSelect) | null> {
    const [row] = await this.client
      .select()
      .from(schema.redemptions)
      .where(eq(schema.redemptions.id, redemptionId))
      .limit(1);
    return row ?? null;
  }

  async refundRedemption(
    userId: number,
    coinsSpent: number,
    redemptionId: number,
    notes: string | undefined,
  ): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) return;
    await this.updateUserBalance(userId, user.balance + coinsSpent);
    await this.client.insert(schema.transactions).values({
      userId,
      amount: coinsSpent,
      type: 'manual_credit',
      title: 'Возврат за отмену обмена',
      description: notes ?? undefined,
      sourceRef: String(redemptionId),
    });
  }

  async listStoreItems(): Promise<(typeof schema.storeItems.$inferSelect)[]> {
    const { storeItems } = schema;
    return this.client
      .select()
      .from(storeItems)
      .where(isNull(storeItems.deletedAt))
      .orderBy(storeItems.sortOrder, storeItems.id);
  }

  async insertStoreItem(
    values: typeof schema.storeItems.$inferInsert,
  ): Promise<number> {
    const [row] = await this.client
      .insert(schema.storeItems)
      .values(values)
      .returning({ id: schema.storeItems.id });
    if (!row) throw new Error('Insert failed');
    return row.id;
  }

  async getStoreItemById(id: number): Promise<(typeof schema.storeItems.$inferSelect) | null> {
    const [row] = await this.client
      .select()
      .from(schema.storeItems)
      .where(eq(schema.storeItems.id, id))
      .limit(1);
    return row ?? null;
  }

  async updateStoreItem(id: number, updates: Partial<typeof schema.storeItems.$inferInsert>): Promise<void> {
    await this.client
      .update(schema.storeItems)
      .set(updates)
      .where(eq(schema.storeItems.id, id));
  }

  async softDeleteStoreItem(id: number, deletedAt: Date): Promise<void> {
    await this.client
      .update(schema.storeItems)
      .set({ deletedAt, isActive: 0 })
      .where(eq(schema.storeItems.id, id));
  }

  async listLevels(): Promise<(typeof schema.levels.$inferSelect)[]> {
    return this.client.select().from(schema.levels).orderBy(schema.levels.sortOrder);
  }

  async listQuests(): Promise<(typeof schema.quests.$inferSelect)[]> {
    return this.client.select().from(schema.quests).orderBy(schema.quests.id);
  }

  async insertQuest(values: typeof schema.quests.$inferInsert): Promise<number> {
    const [row] = await this.client
      .insert(schema.quests)
      .values(values)
      .returning({ id: schema.quests.id });
    if (!row) throw new Error('Insert failed');
    return row.id;
  }

  async getQuestById(id: number): Promise<(typeof schema.quests.$inferSelect) | null> {
    const [row] = await this.client
      .select()
      .from(schema.quests)
      .where(eq(schema.quests.id, id))
      .limit(1);
    return row ?? null;
  }

  async updateQuest(id: number, updates: Partial<typeof schema.quests.$inferInsert>): Promise<void> {
    await this.client
      .update(schema.quests)
      .set(updates)
      .where(eq(schema.quests.id, id));
  }

  async deactivateQuest(id: number): Promise<void> {
    await this.client
      .update(schema.quests)
      .set({ isActive: 0 })
      .where(eq(schema.quests.id, id));
  }

  async listUserGroupsWithMemberCount(): Promise<
    Array<(typeof schema.userGroups.$inferSelect) & { memberCount: number }>
  > {
    const { userGroups, userGroupMembers } = schema;
    const groups = await this.client
      .select()
      .from(userGroups)
      .where(isNull(userGroups.deletedAt))
      .orderBy(userGroups.id);
    const memberCounts = await this.client
      .select({ groupId: userGroupMembers.groupId, count: sql<number>`count(*)::int` })
      .from(userGroupMembers)
      .where(isNull(userGroupMembers.deletedAt))
      .groupBy(userGroupMembers.groupId);
    const countMap = new Map(memberCounts.map((r) => [r.groupId, r.count]));
    return groups.map((group) => ({ ...group, memberCount: countMap.get(group.id) ?? 0 }));
  }

  async getActiveUserGroupById(id: number): Promise<(typeof schema.userGroups.$inferSelect) | null> {
    const { userGroups } = schema;
    const [row] = await this.client
      .select()
      .from(userGroups)
      .where(and(eq(userGroups.id, id), isNull(userGroups.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async insertUserGroup(values: typeof schema.userGroups.$inferInsert): Promise<number> {
    const [row] = await this.client
      .insert(schema.userGroups)
      .values(values)
      .returning({ id: schema.userGroups.id });
    if (!row) throw new Error('Insert user group failed');
    return row.id;
  }

  async updateUserGroup(id: number, updates: Partial<typeof schema.userGroups.$inferInsert>): Promise<void> {
    await this.client
      .update(schema.userGroups)
      .set(updates)
      .where(eq(schema.userGroups.id, id));
  }

  async softDeleteUserGroup(id: number, deletedAt: Date): Promise<void> {
    await this.client
      .update(schema.userGroups)
      .set({ deletedAt })
      .where(eq(schema.userGroups.id, id));
  }

  async listGroupMembers(groupId: number): Promise<
    Array<{ userId: number; userName: string | null; email: string | null; externalId: string | null }>
  > {
    const { userGroupMembers, users } = schema;
    return this.client
      .select({
        userId: users.id,
        userName: users.name,
        email: users.email,
        externalId: users.externalId,
      })
      .from(userGroupMembers)
      .innerJoin(users, eq(userGroupMembers.userId, users.id))
      .where(and(eq(userGroupMembers.groupId, groupId), isNull(userGroupMembers.deletedAt)));
  }

  async getActiveGroupMember(groupId: number, userId: number): Promise<(typeof schema.userGroupMembers.$inferSelect) | null> {
    const { userGroupMembers } = schema;
    const [row] = await this.client
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
    return row ?? null;
  }

  async insertGroupMember(groupId: number, userId: number): Promise<number> {
    const [row] = await this.client
      .insert(schema.userGroupMembers)
      .values({ groupId, userId })
      .returning({ id: schema.userGroupMembers.id });
    if (!row) throw new Error('Insert group member failed');
    return row.id;
  }

  async softDeleteGroupMemberById(id: number, deletedAt: Date): Promise<void> {
    await this.client
      .update(schema.userGroupMembers)
      .set({ deletedAt })
      .where(eq(schema.userGroupMembers.id, id));
  }

  async resolveUserIdByIdentifier(identifier: string): Promise<number | null> {
    const { users } = schema;
    const trimmed = identifier.trim();
    const asId = /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : null;
    if (asId != null && !Number.isNaN(asId)) {
      const [byId] = await this.client
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, asId))
        .limit(1);
      if (byId) return byId.id;
    }
    const [byEmail] = await this.client
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, trimmed))
      .limit(1);
    if (byEmail) return byEmail.id;
    const [byExternalId] = await this.client
      .select({ id: users.id })
      .from(users)
      .where(eq(users.externalId, trimmed))
      .limit(1);
    return byExternalId?.id ?? null;
  }

  async listActiveGroupMemberUserIds(groupId: number): Promise<number[]> {
    const { userGroupMembers } = schema;
    const rows = await this.client
      .select({ userId: userGroupMembers.userId })
      .from(userGroupMembers)
      .where(and(eq(userGroupMembers.groupId, groupId), isNull(userGroupMembers.deletedAt)));
    return rows.map((row) => row.userId);
  }

  async getPageViewsOverviewData(startDate: Date): Promise<{
    byDayRows: Array<{ date: string; views: number; uniqueUsers: number }>;
    byPathRows: Array<{ path: string; views: number }>;
    totals: { totalViews: number; totalUniqueUsers: number };
  }> {
    const { pageViews } = schema;
    const byDayRows = await this.client
      .select({
        date: sql<string>`(${pageViews.createdAt} at time zone 'UTC')::date::text`,
        views: sql<number>`count(*)::int`,
        uniqueUsers: sql<number>`count(distinct ${pageViews.userId})::int`,
      })
      .from(pageViews)
      .where(gte(pageViews.createdAt, startDate))
      .groupBy(sql`(${pageViews.createdAt} at time zone 'UTC')::date`);
    const byPathRows = await this.client
      .select({
        path: pageViews.path,
        views: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(gte(pageViews.createdAt, startDate))
      .groupBy(pageViews.path)
      .orderBy(sql`count(*) desc`)
      .limit(20);
    const [totals] = await this.client
      .select({
        totalViews: sql<number>`count(*)::int`,
        totalUniqueUsers: sql<number>`count(distinct ${pageViews.userId})::int`,
      })
      .from(pageViews)
      .where(gte(pageViews.createdAt, startDate));
    return {
      byDayRows,
      byPathRows,
      totals: {
        totalViews: Number(totals?.totalViews ?? 0),
        totalUniqueUsers: Number(totals?.totalUniqueUsers ?? 0),
      },
    };
  }

  async getCoinsOverviewData(startDate: Date): Promise<{
    totalBalanceToday: number;
    txRows: Array<{ date: string; delta: number }>;
    redemptionRows: Array<{ date: string; spent: number }>;
  }> {
    const { users, transactions, redemptions } = schema;
    const [sumRow] = await this.client
      .select({ total: sql<number>`coalesce(sum(${users.balance}), 0)::bigint` })
      .from(users);
    const txRows = await this.client
      .select({
        date: sql<string>`(${transactions.createdAt} at time zone 'UTC')::date::text`,
        delta: sql<number>`coalesce(sum(${transactions.amount}), 0)::bigint`,
      })
      .from(transactions)
      .where(gte(transactions.createdAt, startDate))
      .groupBy(sql`(${transactions.createdAt} at time zone 'UTC')::date`);
    const redemptionRows = await this.client
      .select({
        date: sql<string>`(${redemptions.createdAt} at time zone 'UTC')::date::text`,
        spent: sql<number>`coalesce(sum(${redemptions.coinsSpent}), 0)::bigint`,
      })
      .from(redemptions)
      .where(gte(redemptions.createdAt, startDate))
      .groupBy(sql`(${redemptions.createdAt} at time zone 'UTC')::date`);
    return {
      totalBalanceToday: Number(sumRow?.total ?? 0),
      txRows,
      redemptionRows,
    };
  }

  async getLevelById(id: number): Promise<(typeof schema.levels.$inferSelect) | null> {
    const [row] = await this.client
      .select()
      .from(schema.levels)
      .where(eq(schema.levels.id, id))
      .limit(1);
    return row ?? null;
  }

  async getFirstLevelId(): Promise<number | null> {
    const [row] = await this.client
      .select({ id: schema.levels.id })
      .from(schema.levels)
      .orderBy(schema.levels.sortOrder)
      .limit(1);
    return row?.id ?? null;
  }

  async updateLevel(id: number, updates: Partial<typeof schema.levels.$inferInsert>): Promise<void> {
    await this.client
      .update(schema.levels)
      .set(updates)
      .where(eq(schema.levels.id, id));
  }

  async listAuditLog(opts: {
    page?: number;
    pageSize?: number;
    action?: string;
    entityType?: string;
  }): Promise<{
    rows: Array<{
      id: number;
      adminId: number | null;
      action: string;
      entityType: string | null;
      entityId: string | null;
      oldValues: unknown;
      newValues: unknown;
      createdAt: Date;
      adminEmail: string | null;
      entityExternalIdUser: string | null;
      entityExternalIdViaTx: string | null;
      entityExternalIdViaStrike: string | null;
      entityExternalIdViaRedemption: string | null;
      entityExternalIdViaMember: string | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { auditLog, adminPanelUsers, users, transactions, strikes, redemptions, userGroupMembers } = schema;
    const usersViaTx = alias(users, 'users_via_tx');
    const usersViaStrike = alias(users, 'users_via_strike');
    const usersViaRedemption = alias(users, 'users_via_redemption');
    const usersViaMember = alias(users, 'users_via_member');

    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
    const conditions: Parameters<typeof and>[0][] = [];
    if (opts.action?.trim()) conditions.push(eq(auditLog.action, opts.action.trim()));
    if (opts.entityType?.trim()) conditions.push(eq(auditLog.entityType, opts.entityType.trim()));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.client
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(whereClause);
    const total = Number(countResult?.count ?? 0);

    const rows = await this.client
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
        and(eq(auditLog.entityType, 'user'), sql`${auditLog.entityId} = (${users.id})::text`),
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
        and(eq(auditLog.entityType, 'strike'), sql`${auditLog.entityId} = (${strikes.id})::text`),
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

    return { rows, total, page, pageSize };
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Envs } from '../../shared/env.validation-schema';
import * as schema from '../../infra/db/drizzle/schemas';
import type { CreateQuestDto, CreateStoreItemDto, UpdateLevelDto, UpdateQuestDto, UpdateStoreItemDto } from './dto/admin.dto';
import { RewardsService } from '../rewards/rewards.service';
import { AdminContextService } from './admin-context.service';
import { AdminDbRepository } from './admin-db.repository';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminDbRepository: AdminDbRepository,
    private readonly rewards: RewardsService,
    private readonly config: ConfigService<Envs, true>,
    private readonly adminContext: AdminContextService,
  ) {}

  async listUsers(search?: string, page = 1, pageSize = 20) {
    return this.adminDbRepository.listUsers(search, page, pageSize);
  }

  /** Создание пользователя по ID основной системы; имя отображается в личном кабинете (имя + фамилия из ETL). */
  async createUser(externalId: string, name: string): Promise<{ id: number }> {
    const extId = externalId?.trim();
    const nameVal = name?.trim() || '';
    if (!extId) throw new BadRequestException('externalId is required');
    const existingId = await this.adminDbRepository.findUserIdByExternalId(extId);
    if (existingId != null) {
      throw new BadRequestException(
        `Пользователь с external_id "${extId}" уже существует (id=${existingId})`,
      );
    }
    const baseLevelId = await this.adminDbRepository.getBaseLevelId();
    if (baseLevelId == null) {
      throw new BadRequestException('В системе нет ни одного уровня. Создайте уровень в админке.');
    }
    const id = await this.adminDbRepository.insertUser({
      externalId: extId,
      name: nameVal || null,
      levelId: baseLevelId,
    });
    return { id };
  }

  /**
   * Найти пользователя по external_id или создать нового (для первого входа через MyGig).
   * Возвращает id пользователя в нашей БД.
   */
  async ensureUserByExternalId(externalId: string, name: string): Promise<{ id: number }> {
    const extId = externalId?.trim();
    const nameVal = name?.trim() || '';
    if (!extId) throw new BadRequestException('externalId is required');
    const existingId = await this.adminDbRepository.findUserIdByExternalId(extId);
    if (existingId != null) return { id: existingId };
    const baseLevelId = await this.adminDbRepository.getBaseLevelId();
    if (baseLevelId == null) {
      throw new BadRequestException('В системе нет ни одного уровня. Создайте уровень в админке.');
    }
    const id = await this.adminDbRepository.insertUser({
      externalId: extId,
      name: nameVal || null,
      levelId: baseLevelId,
    });
    return { id };
  }

  async getUserDetail(userId: number) {
    const details = await this.adminDbRepository.getUserDetailData(userId);
    if (!details.user) throw new NotFoundException('User not found');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeStrikesIn30d = details.strikes.filter(
      (s) => !(s as { removedAt?: Date | null }).removedAt && (s.occurredAt as Date) >= thirtyDaysAgo,
    );
    return {
      ...details.user,
      levelName: details.levelName,
      strikesCount30d: activeStrikesIn30d.length,
      strikes: details.strikes,
      recentTransactions: details.recentTransactions,
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
    return this.adminDbRepository.listRedemptions(opts);
  }

  async updateRedemption(
    redemptionId: number,
    status: 'fulfilled' | 'cancelled',
    notes?: string,
    returnCoins = false,
  ) {
    const now = new Date();
    const updated = await this.adminDbRepository.tryUpdatePendingRedemption(
      redemptionId,
      status,
      notes,
      now,
    );
    if (!updated) {
      const r = await this.adminDbRepository.getRedemptionById(redemptionId);
      if (!r) throw new NotFoundException('Redemption not found');
      throw new NotFoundException('Redemption already processed');
    }
    if (status === 'cancelled' && returnCoins) {
      await this.adminDbRepository.refundRedemption(
        updated.userId,
        updated.coinsSpent,
        redemptionId,
        notes,
      );
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
    const errors: Array<{ id: number; reason: string }> = [];
    let updated = 0;
    const now = new Date();
    for (const redemptionId of ids) {
      const row = await this.adminDbRepository.tryUpdatePendingRedemption(
        redemptionId,
        status,
        notes,
        now,
      );
      if (!row) {
        const existing = await this.adminDbRepository.getRedemptionById(redemptionId);
        if (!existing) {
          errors.push({ id: redemptionId, reason: 'not_found' });
        } else {
          errors.push({ id: redemptionId, reason: 'already_processed' });
        }
        continue;
      }
      if (status === 'cancelled' && returnCoins) {
        await this.adminDbRepository.refundRedemption(
          row.userId,
          row.coinsSpent,
          redemptionId,
          notes,
        );
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
    return this.adminDbRepository.listStoreItems();
  }

  /** Обзор посещаемости: просмотры вкладок по дням и по путям (последние N дней). */
  async getPageViewsOverview(days = 14): Promise<{
    byDay: Array<{ date: string; views: number; uniqueUsers: number }>;
    byPath: Array<{ path: string; views: number }>;
    totalViews: number;
    totalUniqueUsers: number;
  }> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setUTCDate(today.getUTCDate() - days);
    const { byDayRows, byPathRows, totals } = await this.adminDbRepository.getPageViewsOverviewData(
      startDate,
    );
    const byDayMap = new Map<string, { views: number; uniqueUsers: number }>();
    for (const r of byDayRows) {
      byDayMap.set(r.date, { views: Number(r.views), uniqueUsers: Number(r.uniqueUsers) });
    }
    const dateStrings: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - (days - 1 - i));
      dateStrings.push(d.toISOString().slice(0, 10));
    }
    const byDay = dateStrings.map((date) => {
      const v = byDayMap.get(date) ?? { views: 0, uniqueUsers: 0 };
      return { date, views: v.views, uniqueUsers: v.uniqueUsers };
    });
    const byPath = byPathRows.map((r) => ({ path: r.path, views: Number(r.views) }));
    return {
      byDay,
      byPath,
      totalViews: Number(totals.totalViews ?? 0),
      totalUniqueUsers: Number(totals.totalUniqueUsers ?? 0),
    };
  }

  /** Для обзора: суммарный баланс и динамика по дням (баланс на счетах и потрачено за день). */
  async getCoinsOverview(days = 14): Promise<{
    totalBalanceToday: number;
    byDay: Array<{ date: string; balanceAtEndOfDay: number; spentThatDay: number }>;
  }> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setUTCDate(today.getUTCDate() - days);
    const { totalBalanceToday, txRows, redemptionRows } =
      await this.adminDbRepository.getCoinsOverviewData(startDate);
    const deltaByDate = new Map<string, number>();
    for (const r of txRows) deltaByDate.set(r.date, Number(r.delta));
    const spentByDate = new Map<string, number>();
    for (const r of redemptionRows) spentByDate.set(r.date, Number(r.spent));

    const byDay: Array<{ date: string; balanceAtEndOfDay: number; spentThatDay: number }> = [];
    let runningBalance = totalBalanceToday;
    const dateStrings: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - (days - 1 - i));
      dateStrings.push(d.toISOString().slice(0, 10));
    }
    for (let i = dateStrings.length - 1; i >= 0; i--) {
      const dateStr = dateStrings[i]!;
      const delta = deltaByDate.get(dateStr) ?? 0;
      runningBalance -= delta;
      byDay.push({
        date: dateStr,
        balanceAtEndOfDay: runningBalance,
        spentThatDay: spentByDate.get(dateStr) ?? 0,
      });
    }
    byDay.reverse();
    return { totalBalanceToday, byDay };
  }

  async createStoreItem(dto: CreateStoreItemDto) {
    const id = await this.adminDbRepository.insertStoreItem({
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
      });
    await this.logAudit('store_item_create', 'store_item', String(id), undefined, {
      name: dto.name,
      category: dto.category,
      cost: dto.cost,
      isActive: dto.isActive ?? 1,
      sortOrder: dto.sortOrder ?? 0,
    });
    return { id };
  }

  async updateStoreItem(id: number, dto: UpdateStoreItemDto) {
    const existing = await this.adminDbRepository.getStoreItemById(id);
    if (!existing) throw new NotFoundException('Store item not found');
    const { storeItems } = schema;
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
    await this.adminDbRepository.updateStoreItem(id, updates);
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
    const existing = await this.adminDbRepository.getStoreItemById(id);
    if (!existing) throw new NotFoundException('Store item not found');
    const now = new Date();
    await this.adminDbRepository.softDeleteStoreItem(id, now);
    await this.logAudit('store_item_delete', 'store_item', String(id), {
      name: existing.name,
      category: existing.category,
      cost: existing.cost,
    }, undefined);
    return { id };
  }

  async listLevels() {
    return this.adminDbRepository.listLevels();
  }

  /** Настройки бонусов: множитель по умолчанию (монет за 1 час смены), порог бонусов за месяц для ограничения квестов */
  async getBonusSettings(): Promise<{
    shiftBonusDefaultMultiplier: number;
    questMonthlyBonusCap: number;
  }> {
    const valueRaw = await this.adminDbRepository.getSystemSettingValue('shift_bonus_default_multiplier');
    let value = 10;
    if (valueRaw != null) {
      const v = valueRaw;
      if (typeof v === 'number' && !Number.isNaN(v)) value = v;
      else if (typeof v === 'object' && typeof (v as { value?: number }).value === 'number') {
        value = (v as { value: number }).value;
      } else {
        const n = Number(v);
        if (!Number.isNaN(n)) value = n;
      }
    }
    const capRaw = await this.adminDbRepository.getSystemSettingValue('quest_monthly_bonus_cap');
    let cap = 0;
    if (capRaw != null) {
      const v = capRaw;
      if (typeof v === 'number' && !Number.isNaN(v) && v >= 0) cap = v;
      else if (typeof v === 'object' && typeof (v as { value?: number }).value === 'number') {
        const val = (v as { value: number }).value;
        cap = val >= 0 ? val : 0;
      } else {
        const n = Number(v);
        if (!Number.isNaN(n) && n >= 0) cap = n;
      }
    }
    return { shiftBonusDefaultMultiplier: value, questMonthlyBonusCap: cap };
  }

  async updateBonusSettings(dto: {
    shiftBonusDefaultMultiplier: number;
    questMonthlyBonusCap?: number;
  }): Promise<void> {
    const value = Number(dto.shiftBonusDefaultMultiplier);
    if (Number.isNaN(value) || value < 0) throw new Error('shiftBonusDefaultMultiplier must be a non-negative number');
    const cap =
      dto.questMonthlyBonusCap !== undefined
        ? Math.max(0, Math.floor(Number(dto.questMonthlyBonusCap)) || 0)
        : undefined;
    const oldSettings = await this.getBonusSettings();
    const now = new Date();
    await this.adminDbRepository.upsertSystemSettingValue(
      'shift_bonus_default_multiplier',
      value,
      now,
    );
    if (cap !== undefined) {
      await this.adminDbRepository.upsertSystemSettingValue('quest_monthly_bonus_cap', cap, now);
    }
    await this.logAudit(
      'bonus_settings_update',
      'system_settings',
      'bonus_settings',
      {
        shiftBonusDefaultMultiplier: oldSettings.shiftBonusDefaultMultiplier,
        questMonthlyBonusCap: oldSettings.questMonthlyBonusCap,
      },
      {
        shiftBonusDefaultMultiplier: value,
        questMonthlyBonusCap: cap !== undefined ? cap : oldSettings.questMonthlyBonusCap,
      },
    );
  }

  /** Настройки рейтинга надёжности: прирост за смену, снижение за прогул и за позднюю отмену */
  async getReliabilityRatingSettings(): Promise<{
    reliabilityRatingIncreasePerShift: number;
    reliabilityRatingDecreaseNoShow: number;
    reliabilityRatingDecreaseLateCancel: number;
    reliabilityMinRatingToCountShiftForLevel: number;
    reliabilityMinRatingToUpgradeLevel: number;
  }> {
    const keys: string[] = [
      'reliability_rating_increase_per_shift',
      'reliability_rating_decrease_no_show',
      'reliability_rating_decrease_late_cancel',
      'reliability_min_rating_to_count_shift_for_level',
      'reliability_min_rating_to_upgrade_level',
    ];
    const defaults: number[] = [0.1, 0.2, 0.2, 0, 0];
    const result: {
      reliabilityRatingIncreasePerShift: number;
      reliabilityRatingDecreaseNoShow: number;
      reliabilityRatingDecreaseLateCancel: number;
      reliabilityMinRatingToCountShiftForLevel: number;
      reliabilityMinRatingToUpgradeLevel: number;
    } = {
      reliabilityRatingIncreasePerShift: defaults[0]!,
      reliabilityRatingDecreaseNoShow: defaults[1]!,
      reliabilityRatingDecreaseLateCancel: defaults[2]!,
      reliabilityMinRatingToCountShiftForLevel: defaults[3]!,
      reliabilityMinRatingToUpgradeLevel: defaults[4]!,
    };
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      const raw = await this.adminDbRepository.getSystemSettingValue(key);
      if (raw != null) {
        const v = raw;
        let num: number = defaults[i] ?? 0;
        if (typeof v === 'number' && !Number.isNaN(v)) num = v;
        else if (typeof v === 'object' && v != null && typeof (v as { value?: number }).value === 'number') {
          num = (v as { value: number }).value;
        } else {
          const p = Number(v);
          if (!Number.isNaN(p)) num = p;
        }
        if (i === 0) result.reliabilityRatingIncreasePerShift = num;
        else if (i === 1) result.reliabilityRatingDecreaseNoShow = num;
        else if (i === 2) result.reliabilityRatingDecreaseLateCancel = num;
        else if (i === 3) result.reliabilityMinRatingToCountShiftForLevel = num;
        else result.reliabilityMinRatingToUpgradeLevel = num;
      }
    }
    return result;
  }

  async updateReliabilityRatingSettings(dto: {
    reliabilityRatingIncreasePerShift?: number;
    reliabilityRatingDecreaseNoShow?: number;
    reliabilityRatingDecreaseLateCancel?: number;
    reliabilityMinRatingToCountShiftForLevel?: number;
    reliabilityMinRatingToUpgradeLevel?: number;
  }): Promise<void> {
    const oldSettings = await this.getReliabilityRatingSettings();
    const now = new Date();
    const updates: Array<{ key: string; value: number }> = [];
    if (dto.reliabilityRatingIncreasePerShift !== undefined) {
      const v = Number(dto.reliabilityRatingIncreasePerShift);
      if (Number.isNaN(v) || v < 0) throw new Error('reliabilityRatingIncreasePerShift must be a non-negative number');
      updates.push({ key: 'reliability_rating_increase_per_shift', value: v });
    }
    if (dto.reliabilityRatingDecreaseNoShow !== undefined) {
      const v = Number(dto.reliabilityRatingDecreaseNoShow);
      if (Number.isNaN(v) || v < 0) throw new Error('reliabilityRatingDecreaseNoShow must be a non-negative number');
      updates.push({ key: 'reliability_rating_decrease_no_show', value: v });
    }
    if (dto.reliabilityRatingDecreaseLateCancel !== undefined) {
      const v = Number(dto.reliabilityRatingDecreaseLateCancel);
      if (Number.isNaN(v) || v < 0) throw new Error('reliabilityRatingDecreaseLateCancel must be a non-negative number');
      updates.push({ key: 'reliability_rating_decrease_late_cancel', value: v });
    }
    if (dto.reliabilityMinRatingToCountShiftForLevel !== undefined) {
      const v = Number(dto.reliabilityMinRatingToCountShiftForLevel);
      if (Number.isNaN(v) || v < 0) {
        throw new Error('reliabilityMinRatingToCountShiftForLevel must be a non-negative number');
      }
      updates.push({ key: 'reliability_min_rating_to_count_shift_for_level', value: v });
    }
    if (dto.reliabilityMinRatingToUpgradeLevel !== undefined) {
      const v = Number(dto.reliabilityMinRatingToUpgradeLevel);
      if (Number.isNaN(v) || v < 0) {
        throw new Error('reliabilityMinRatingToUpgradeLevel must be a non-negative number');
      }
      updates.push({ key: 'reliability_min_rating_to_upgrade_level', value: v });
    }
    for (const { key, value } of updates) {
      await this.adminDbRepository.upsertSystemSettingValue(key, value, now);
    }
    if (updates.length > 0) {
      const newSettings = await this.getReliabilityRatingSettings();
      await this.logAudit(
        'reliability_rating_settings_update',
        'system_settings',
        'reliability_rating',
        oldSettings,
        newSettings,
      );
    }
  }

  async updateLevel(id: number, dto: UpdateLevelDto) {
    const { levels } = schema;
    const existing = await this.adminDbRepository.getLevelById(id);
    if (!existing) throw new NotFoundException('Level not found');
    if (dto.shiftsRequired !== undefined && dto.shiftsRequired !== 0) {
      const firstLevelId = await this.adminDbRepository.getFirstLevelId();
      if (firstLevelId != null && firstLevelId === id) {
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
    await this.adminDbRepository.updateLevel(id, updates);
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
    return this.adminDbRepository.listQuests();
  }

  async createQuest(dto: CreateQuestDto) {
    const now = new Date();
    let activeFrom: Date | null = dto.activeFrom ? new Date(dto.activeFrom) : null;
    let activeUntil: Date | null = dto.activeUntil ? new Date(dto.activeUntil) : null;
    if (dto.activeUntilEndOfPeriod && dto.period) {
      activeUntil = this.endOfPeriodUTC(now, dto.period);
    }
    const id = await this.adminDbRepository.insertQuest({
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
    });
    await this.logAudit('quest_create', 'quest', String(id), undefined, {
      name: dto.name,
      period: dto.period,
      conditionType: dto.conditionType,
      rewardCoins: dto.rewardCoins,
      isActive: dto.isActive ?? 1,
      isOneTime: dto.isOneTime ?? 0,
    });
    return { id };
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
    const existing = await this.adminDbRepository.getQuestById(id);
    if (!existing) throw new NotFoundException('Quest not found');
    const { quests } = schema;
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
    await this.adminDbRepository.updateQuest(id, updates);
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
    const existing = await this.adminDbRepository.getQuestById(id);
    if (!existing) throw new NotFoundException('Quest not found');
    await this.adminDbRepository.deactivateQuest(id);
    await this.logAudit('quest_delete', 'quest', String(id), {
      name: existing.name,
      conditionType: existing.conditionType,
      rewardCoins: existing.rewardCoins,
    }, undefined);
    return { id };
  }

  /** Группы пользователей (для квестов target_type=group) */
  async listUserGroups() {
    return this.adminDbRepository.listUserGroupsWithMemberCount();
  }

  async getUserGroup(id: number) {
    const row = await this.adminDbRepository.getActiveUserGroupById(id);
    if (!row) throw new NotFoundException('User group not found');
    return row;
  }

  async createUserGroup(dto: { name: string; description?: string | null }) {
    const name = (dto.name ?? '').trim();
    if (!name) throw new BadRequestException('name is required');
    const id = await this.adminDbRepository.insertUserGroup({
      name,
      description: dto.description?.trim() || null,
    });
    await this.logAudit('user_group_create', 'user_group', String(id), undefined, {
      name,
      description: dto.description?.trim() || undefined,
    });
    return { id };
  }

  async updateUserGroup(id: number, dto: { name?: string; description?: string | null }) {
    const existing = await this.adminDbRepository.getActiveUserGroupById(id);
    if (!existing) throw new NotFoundException('User group not found');
    const { userGroups } = schema;
    const updates: Partial<typeof userGroups.$inferInsert> = {};
    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.description !== undefined) updates.description = dto.description?.trim() || null;
    if (Object.keys(updates).length === 0) return { id };
    await this.adminDbRepository.updateUserGroup(id, updates);
    const oldSnapshot = { name: existing.name, description: existing.description };
    await this.logAudit('user_group_update', 'user_group', String(id), oldSnapshot, { ...oldSnapshot, ...updates });
    return { id };
  }

  async deleteUserGroup(id: number) {
    const existing = await this.adminDbRepository.getActiveUserGroupById(id);
    if (!existing) throw new NotFoundException('User group not found');
    const now = new Date();
    await this.adminDbRepository.softDeleteUserGroup(id, now);
    await this.logAudit('user_group_delete', 'user_group', String(id), {
      name: existing.name,
    }, undefined);
    return { id };
  }

  async listGroupMembers(groupId: number) {
    const group = await this.adminDbRepository.getActiveUserGroupById(groupId);
    if (!group) throw new NotFoundException('User group not found');
    const rows = await this.adminDbRepository.listGroupMembers(groupId);
    return { group: { id: group.id, name: group.name, description: group.description }, items: rows };
  }

  async addGroupMember(groupId: number, userId: number) {
    const group = await this.adminDbRepository.getActiveUserGroupById(groupId);
    if (!group) throw new NotFoundException('User group not found');
    const user = await this.adminDbRepository.getUserById(userId);
    if (!user) throw new NotFoundException('User not found');
    const existing = await this.adminDbRepository.getActiveGroupMember(groupId, userId);
    if (existing) return { id: existing.id, added: false };
    const id = await this.adminDbRepository.insertGroupMember(groupId, userId);
    await this.logAudit('group_member_add', 'user_group_member', String(id), undefined, {
      groupId,
      userId,
    });
    return { id, added: true };
  }

  async removeGroupMember(groupId: number, userId: number) {
    const existing = await this.adminDbRepository.getActiveGroupMember(groupId, userId);
    if (!existing) throw new NotFoundException('Group member not found');
    const now = new Date();
    await this.adminDbRepository.softDeleteGroupMemberById(existing.id, now);
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
    const group = await this.adminDbRepository.getActiveUserGroupById(groupId);
    if (!group) throw new NotFoundException('User group not found');

    const userIds = new Set<number>();
    for (const raw of identifiers) {
      const s = (raw ?? '').toString().trim();
      if (!s) continue;
      const foundUserId = await this.adminDbRepository.resolveUserIdByIdentifier(s);
      if (foundUserId != null) userIds.add(foundUserId);
    }

    const existingSet = new Set(await this.adminDbRepository.listActiveGroupMemberUserIds(groupId));
    const toAdd = [...userIds].filter((id) => !existingSet.has(id));

    let added = 0;
    for (const userId of toAdd) {
      await this.adminDbRepository.insertGroupMember(groupId, userId);
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
    const levelRow = await this.adminDbRepository.findLevelById(levelId);
    if (!levelRow) throw new NotFoundException('Level not found');
    const userRow = await this.adminDbRepository.getUserById(userId);
    if (!userRow) throw new NotFoundException('User not found');
    const oldLevelId = userRow.levelId;
    await this.adminDbRepository.updateUserLevelAndResetShifts(userId, levelId);
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
    const userRow = await this.adminDbRepository.getUserById(userId);
    if (!userRow) throw new NotFoundException('User not found');
    if (amount <= 0) throw new Error('amount must be positive');
    const txAmount = type === 'manual_debit' ? -amount : amount;
    const newBalance = userRow.balance + txAmount;
    if (newBalance < 0) throw new Error('Insufficient balance for debit');
    const defaultTitle = type === 'manual_credit' ? 'Ручное начисление' : 'Ручное списание';
    await this.adminDbRepository.updateUserBalance(userId, newBalance);
    const transactionId = await this.adminDbRepository.insertTransaction({
      userId,
      amount: txAmount,
      type,
      title: title?.trim() || defaultTitle,
      description: description?.trim() || null,
      createdBy: null,
    });
    await this.logAudit('manual_transaction', 'transaction', String(transactionId), undefined, {
      userId,
      amount: txAmount,
      type,
      title: title?.trim() || defaultTitle,
      description: description?.trim() || undefined,
    });
    return { transactionId, newBalance };
  }

  /** Снять штраф с причиной и пересчитать уровень (6.7) */
  async removeStrike(strikeId: number, reason: string) {
    const strike = await this.adminDbRepository.getStrikeById(strikeId);
    if (!strike) throw new NotFoundException('Strike not found');
    if ((strike as { removedAt?: Date | null }).removedAt) {
      throw new NotFoundException('Strike already removed');
    }
    const now = new Date();
    await this.adminDbRepository.markStrikeRemoved(strikeId, now, reason?.trim() || null);
    await this.rewards.restoreReliabilityRatingForStrikeRemoval(
      strike.userId,
      strike.type as 'no_show' | 'late_cancel',
    );
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
    const resolvedAdminId = adminId ?? this.adminContext.getAdminId() ?? null;
    await this.adminDbRepository.insertAuditLog({
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
    const { rows, total, page, pageSize } = await this.adminDbRepository.listAuditLog(opts);
    const superEmail = this.config.get<string>('ADMIN_SUPER_EMAIL')?.trim() ?? null;

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
      const externalId = await this.adminDbRepository.findUserExternalIdById(params.userId);
      if (!externalId) {
        throw new BadRequestException(
          `User ${params.userId} has no external_id. Set external_id in admin to link to TOJ worker.`,
        );
      }
      workerIds = [externalId];
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

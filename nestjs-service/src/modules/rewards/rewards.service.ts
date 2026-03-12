import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../infra/db/drizzle/schemas';
import { drizzleProvider } from '../../infra/db/drizzle/drizzle.module';
import type { Envs } from '../../shared/env.validation-schema';
import { MeResponseDto } from './dto/me.dto';
import { LevelResponseDto } from './dto/level.dto';
import { QuestResponseDto } from './dto/quest.dto';
import { StoreItemResponseDto } from './dto/store.dto';
import { StrikeResponseDto } from './dto/strike.dto';
import { TransactionResponseDto } from './dto/transaction.dto';

/** Начало дня (00:00:00) в UTC для даты */
function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Понедельник текущей недели (00:00 UTC) */
function startOfWeekUTC(d: Date): Date {
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + mondayOffset);
  return startOfDayUTC(monday);
}

/** Первый день текущего месяца (00:00 UTC) */
function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Конец текущей недели (понедельник следующей недели 00:00 UTC) */
function endOfWeekUTC(d: Date): Date {
  const start = startOfWeekUTC(d);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}

/** Первый день следующего месяца (00:00 UTC) */
function startOfNextMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

/** Квест активен в момент now с учётом activeFrom/activeUntil */
function isQuestInActiveWindow(
  activeFrom: Date | null,
  activeUntil: Date | null,
  now: Date,
): boolean {
  if (activeFrom != null && now < activeFrom) return false;
  if (activeUntil != null && now > activeUntil) return false;
  return true;
}

/** Конфиг условия квеста (расширенный) */
interface QuestConditionConfig {
  total?: number;
  totalHours?: number;
  clientId?: string;
  clientIds?: string[];
  category?: string;
}

/** Целевое значение для отображения (смены или часы) */
function getQuestTarget(config: QuestConditionConfig, conditionType: string): number {
  if (
    conditionType === 'hours_count' ||
    conditionType === 'hours_count_client' ||
    conditionType === 'hours_count_clients'
  ) {
    return config.totalHours ?? 1;
  }
  if (conditionType === 'shifts_series') {
    return config.total ?? 1;
  }
  if (conditionType === 'manual_confirmation') {
    return 1;
  }
  return config.total ?? 1;
}

@Injectable()
export class RewardsService {
  constructor(
    @Inject(drizzleProvider)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly config: ConfigService<Envs, true>,
  ) {}

  /**
   * Определяет ID текущего пользователя: из JWT (req.user), затем query, затем DEV_USER_ID.
   */
  resolveCurrentUserId(
    userIdFromAuth?: number,
    userIdFromQuery?: string,
  ): number {
    if (userIdFromAuth != null && Number.isInteger(userIdFromAuth)) {
      return userIdFromAuth;
    }
    const id = userIdFromQuery ?? this.config.get<string>('DEV_USER_ID');
    if (!id) {
      throw new NotFoundException(
        'User not identified. Use dev-login (JWT), ?userId= or DEV_USER_ID.',
      );
    }
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) {
      throw new NotFoundException('Invalid userId');
    }
    return num;
  }

  /** Записать просмотр вкладки/страницы пользователем (для аналитики посещаемости в админке). */
  async recordPageView(userId: number, path: string): Promise<void> {
    const { pageViews } = schema;
    const pathNorm = (path ?? '').toString().trim().slice(0, 128) || 'home';
    await this.db.insert(pageViews).values({ userId, path: pathNorm });
  }

  async getMe(userId: number): Promise<MeResponseDto> {
    await this.recalcUserLevel(userId);
    const { users, levels, transactions } = schema;
    const rows = await this.db
      .select({
        user: users,
        level: levels,
      })
      .from(users)
      .innerJoin(levels, eq(users.levelId, levels.id))
      .where(eq(users.id, userId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new NotFoundException('User not found');
    }
    const { user, level } = row;
    const now = new Date();
    const monthStart = startOfMonthUTC(now);
    const nextMonthStart = startOfNextMonthUTC(now);
    const nextLevelRows = await this.db
      .select()
      .from(levels)
      .where(sql`${levels.sortOrder} = ${level.sortOrder + 1}`)
      .limit(1);
    const nextLevel = nextLevelRows[0];
    const dto = new MeResponseDto();
    dto.id = user.id;
    dto.name = user.name;
    dto.email = user.email;
    dto.avatarUrl = user.avatarUrl;
    dto.balance = user.balance;
    dto.levelId = level.id;
    dto.levelName = level.name;
    dto.nextLevelName = nextLevel?.name ?? null;
    dto.nextLevelShiftsRequired = nextLevel?.shiftsRequired ?? null;
    dto.shiftsCompleted = user.shiftsCompleted;
    dto.shiftsRequired = level.shiftsRequired;
    dto.reliabilityRating = Number(user.reliabilityRating ?? 4);
    const [monthlySumRow] = await this.db
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
    dto.monthlyBonusTotal = Number(monthlySumRow?.sum ?? 0);
    dto.questMonthlyBonusCap = await this.getQuestMonthlyBonusCap();
    dto.questsLimitedByCap =
      dto.questMonthlyBonusCap > 0 && dto.monthlyBonusTotal >= dto.questMonthlyBonusCap;
    return dto;
  }

  async getStrikes(userId: number, limit = 50): Promise<StrikeResponseDto[]> {
    const { strikes } = schema;
    const rows = await this.db
      .select()
      .from(strikes)
      .where(eq(strikes.userId, userId))
      .orderBy(desc(strikes.occurredAt))
      .limit(limit);
    return rows.map((r) => {
      const dto = new StrikeResponseDto();
      dto.id = r.id;
      dto.type = r.type;
      dto.shiftExternalId = r.shiftExternalId;
      dto.occurredAt = (r.occurredAt as Date).toISOString();
      dto.removedAt = r.removedAt != null ? (r.removedAt as Date).toISOString() : null;
      return dto;
    });
  }

  async getTransactions(userId: number, limit = 50): Promise<TransactionResponseDto[]> {
    const { transactions } = schema;
    const rows = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(sql`${transactions.createdAt} desc`)
      .limit(limit);
    return rows.map((r) => {
      const dto = new TransactionResponseDto();
      dto.id = r.id;
      dto.amount = r.amount;
      dto.type = r.type;
      dto.title = r.title;
      dto.description = r.description;
      dto.location = r.location;
      dto.createdAt = (r.createdAt as Date).toISOString();
      return dto;
    });
  }

  async getQuests(userId: number): Promise<QuestResponseDto[]> {
    const { quests, questProgress, userGroupMembers, transactions } = schema;
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const weekStart = startOfWeekUTC(now);
    const weekKey = weekStart.toISOString().slice(0, 10);
    const monthStart = startOfMonthUTC(now);
    const monthKey = monthStart.toISOString().slice(0, 7);
    const nextMonthStart = startOfNextMonthUTC(now);

    const userGroupIds = new Set(
      (
        await this.db
          .select({ groupId: userGroupMembers.groupId })
          .from(userGroupMembers)
          .where(and(eq(userGroupMembers.userId, userId), isNull(userGroupMembers.deletedAt)))
      ).map((r) => r.groupId),
    );

    const cap = await this.getQuestMonthlyBonusCap();
    let capExceeded = false;
    if (cap > 0) {
      const [sumRow] = await this.db
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
      const monthlyBonusSum = Number(sumRow?.sum ?? 0);
      capExceeded = monthlyBonusSum >= cap;
    }

    const rows = await this.db.select().from(quests).where(eq(quests.isActive, 1));
    const result: QuestResponseDto[] = [];
    for (const q of rows) {
      if (q.targetType === 'group' && q.targetGroupId != null) {
        if (!userGroupIds.has(q.targetGroupId)) continue;
      }
      if (!isQuestInActiveWindow(q.activeFrom as Date | null, q.activeUntil as Date | null, now)) {
        continue;
      }
      const periodKey =
        q.isOneTime === 1
          ? 'once'
          : q.period === 'daily'
            ? todayKey
            : q.period === 'weekly'
              ? weekKey
              : q.period === 'monthly'
                ? monthKey
                : todayKey;
      const config = (q.conditionConfig as QuestConditionConfig) ?? {};
      const total = getQuestTarget(config, q.conditionType);
      const prog = await this.db
        .select()
        .from(questProgress)
        .where(
          and(
            eq(questProgress.userId, userId),
            eq(questProgress.questId, q.id),
            eq(questProgress.periodKey, periodKey),
          ),
        )
        .limit(1);
      if (capExceeded && prog.length === 0) continue;
      const progress = prog[0]?.progress ?? 0;
      const completed = !!prog[0]?.completedAt;
      const isHoursCondition =
        q.conditionType === 'hours_count' ||
        q.conditionType === 'hours_count_client' ||
        q.conditionType === 'hours_count_clients';
      const displayProgress =
        isHoursCondition ? (progress as number) / 10 : (progress as number);
      const dto = new QuestResponseDto();
      dto.id = q.id;
      dto.name = q.name;
      dto.description = q.description;
      dto.period = q.period;
      dto.isOneTime = q.isOneTime === 1;
      dto.progress = displayProgress;
      dto.total = total;
      dto.reward = q.rewardCoins;
      dto.icon = q.icon ?? 'target';
      dto.completed = completed;
      result.push(dto);
    }
    return result;
  }

  async getStoreItems(): Promise<StoreItemResponseDto[]> {
    const { storeItems, redemptions } = schema;
    const rows = await this.db
      .select()
      .from(storeItems)
      .where(and(eq(storeItems.isActive, 1), isNull(storeItems.deletedAt)))
      .orderBy(storeItems.sortOrder, storeItems.id);
    const result: StoreItemResponseDto[] = [];
    for (const r of rows) {
      let redeemedCount = 0;
      if (r.stockLimit != null) {
        const countResult = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(redemptions)
          .where(
            and(
              eq(redemptions.storeItemId, r.id),
              or(eq(redemptions.status, 'pending'), eq(redemptions.status, 'fulfilled')),
            ),
          );
        redeemedCount = countResult[0]?.count ?? 0;
      }
      const dto = new StoreItemResponseDto();
      dto.id = r.id;
      dto.name = r.name;
      dto.description = r.description;
      dto.category = r.category;
      dto.cost = r.cost;
      dto.icon = r.icon ?? 'gift';
      dto.stockLimit = r.stockLimit;
      dto.redeemedCount = redeemedCount;
      result.push(dto);
    }
    return result;
  }

  /** Список уровней лояльности для отображения в ЛК (название, порог смен, перки). */
  async getLevels(): Promise<LevelResponseDto[]> {
    const { levels } = schema;
    const rows = await this.db.select().from(levels).orderBy(levels.sortOrder);
    return rows.map((r) => {
      const dto = new LevelResponseDto();
      dto.id = r.id;
      dto.name = r.name;
      dto.shiftsRequired = r.shiftsRequired;
      dto.perks = Array.isArray(r.perks) ? r.perks : [];
      dto.sortOrder = r.sortOrder;
      return dto;
    });
  }

  async createRedemption(userId: number, storeItemId: number): Promise<{ redemptionId: number }> {
    const { users, storeItems, transactions, redemptions } = schema;

    return this.db.transaction(
      async (tx) => {
        // Блокируем строку пользователя (баланс не изменится до коммита)
        const userRows = await tx
          .select({ id: users.id, balance: users.balance })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
          .for('update');
        const user = userRows[0];
        if (!user) {
          throw new NotFoundException('User not found');
        }

        // Блокируем строку товара (сериализация по товару — остаток не превысим)
        const itemRows = await tx
          .select()
          .from(storeItems)
          .where(eq(storeItems.id, storeItemId))
          .limit(1)
          .for('update');
        const item = itemRows[0];
        if (!item || item.isActive !== 1) {
          throw new NotFoundException('Store item not found or inactive');
        }
        if (item.deletedAt) {
          throw new NotFoundException('Store item not found or inactive');
        }
        if (user.balance < item.cost) {
          throw new NotFoundException('Insufficient balance');
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
            throw new NotFoundException('Товар закончился');
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
          throw new Error('Failed to create redemption');
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

  /**
   * Пересчёт уровня пользователя по числу завершённых смен.
   * Уровень = максимальный по shifts_required такой, что shifts_required <= user.shifts_completed.
   * Базовый уровень (минимальный sort_order) назначается изначально без условий — если ни один уровень не подошёл по сменам, ставим базовый.
   * Обновляем только при повышении (по sortOrder), чтобы не затирать ручное назначение админом.
   * При автоматическом переходе: счётчик смен сбрасывается в 0, новый уровень сохраняется и далее не понижается.
   */
  async recalcUserLevel(userId: number): Promise<void> {
    const { users, levels } = schema;
    const [row] = await this.db
      .select({ user: users, currentLevel: levels })
      .from(users)
      .innerJoin(levels, eq(users.levelId, levels.id))
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) return;
    const { user, currentLevel } = row;
    let [newLevel] = await this.db
      .select()
      .from(levels)
      .where(lte(levels.shiftsRequired, user.shiftsCompleted))
      .orderBy(desc(levels.shiftsRequired))
      .limit(1);
    let usedBaseFallback = false;
    if (!newLevel) {
      const [baseLevel] = await this.db
        .select()
        .from(levels)
        .orderBy(asc(levels.sortOrder))
        .limit(1);
      if (baseLevel) {
        newLevel = baseLevel;
        usedBaseFallback = true;
      }
    }
    if (!newLevel) return;
    const isUpgrade = newLevel.sortOrder > currentLevel.sortOrder;
    const assignBaseInitially = usedBaseFallback && user.levelId !== newLevel.id;
    if (isUpgrade || assignBaseInitially) {
      await this.db
        .update(users)
        .set({
          levelId: newLevel.id,
          shiftsCompleted: assignBaseInitially ? user.shiftsCompleted : 0,
        })
        .where(eq(users.id, userId));
    }
  }

  /**
   * Пересчёт уровня по сменам (без учёта штрафов). Вызывается после снятия штрафа и в других местах.
   * Раньше учитывались лимиты штрафов за неделю/месяц — заменено на рейтинг надёжности.
   */
  async recalcUserLevelConsideringStrikes(userId: number): Promise<void> {
    await this.recalcUserLevel(userId);
  }

  /**
   * Засчитать завершённую смену: начисление монет, транзакция, +1 к shifts_completed, пересчёт уровня.
   * Если переданы hours — бонус считается автоматически: ceil(hours) * множитель_по_умолчанию * множитель_уровня.
   * Иначе используется переданное coins (ручной ввод).
   * Если передан sourceRef — идемпотентность: при существующей транзакции type=shift с таким source_ref возвращаем её id.
   */
  async recordShiftCompleted(
    userId: number,
    coins: number,
    title?: string,
    location?: string,
    clientId?: string,
    category?: string,
    hours?: number,
    sourceRef?: string,
  ): Promise<{ transactionId: number }> {
    const { users, transactions, levels } = schema;
    if (sourceRef != null && sourceRef !== '') {
      const [existing] = await this.db
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.type, 'shift'),
            eq(transactions.sourceRef, sourceRef),
          ),
        )
        .limit(1);
      if (existing) {
        return { transactionId: existing.id };
      }
    }
    const [user] = await this.db
      .select({ user: users, level: levels })
      .from(users)
      .innerJoin(levels, eq(users.levelId, levels.id))
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    let amount = coins;
    const hoursNum = hours != null ? Number(hours) : undefined;
    if (hoursNum != null && !Number.isNaN(hoursNum) && hoursNum > 0) {
      const defaultMult = await this.getDefaultShiftBonusMultiplier();
      const levelMult = Number(user.level.bonusMultiplier ?? 1);
      const hoursRoundedUp = Math.ceil(hoursNum);
      amount = Math.round(hoursRoundedUp * defaultMult * levelMult);
    } else if (amount < 0) {
      throw new NotFoundException('coins must be >= 0');
    }
    const [tx] = await this.db
      .insert(transactions)
      .values({
        userId,
        amount,
        type: 'shift',
        sourceRef: sourceRef ?? undefined,
        title: title ?? 'Смена',
        location: location ?? undefined,
        clientId: clientId ?? undefined,
        category: category ?? undefined,
        hours: hoursNum != null ? hoursNum : undefined,
      })
      .returning({ id: transactions.id });
    if (!tx) throw new Error('Failed to create transaction');
    const increase = await this.getReliabilityRatingIncreasePerShift();
    const newRating = Math.min(5, (user.user.reliabilityRating ?? 4) + increase);
    await this.db
      .update(users)
      .set({
        balance: user.user.balance + amount,
        shiftsCompleted: user.user.shiftsCompleted + 1,
        reliabilityRating: newRating,
      })
      .where(eq(users.id, userId));
    await this.recalcUserLevel(userId);
    await this.recalcQuestProgressForUser(userId);
    return { transactionId: tx.id };
  }

  /**
   * Зафиксировать факт бронирования смены (статус booked в TOJ).
   * Используется для квеста «забронировать смены»: один раз записанное бронирование не обнуляется
   * при смене статуса (confirmed/cancelled). Идемпотентно по jobId (sourceRef).
   * Баланс не меняется (amount=0).
   */
  async recordShiftBooked(
    userId: number,
    jobId: string,
    title?: string,
    clientId?: string,
    category?: string,
  ): Promise<{ transactionId?: number; recorded: boolean }> {
    const { transactions, users } = schema;
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const [existing] = await this.db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'shift_booked'),
          eq(transactions.sourceRef, String(jobId)),
        ),
      )
      .limit(1);
    if (existing) {
      return { transactionId: existing.id, recorded: false };
    }
    const [tx] = await this.db
      .insert(transactions)
      .values({
        userId,
        amount: 0,
        type: 'shift_booked',
        sourceRef: String(jobId),
        title: title ?? 'Бронирование смены',
        clientId: clientId ?? undefined,
        category: category ?? undefined,
        bookedAt: new Date(),
      })
      .returning({ id: transactions.id });
    if (!tx) throw new Error('Failed to create shift_booked transaction');
    await this.recalcQuestProgressForUser(userId);
    return { transactionId: tx.id, recorded: true };
  }

  /** Множитель бонусов за смену по умолчанию (монет за 1 час) из system_settings */
  private async getDefaultShiftBonusMultiplier(): Promise<number> {
    const { systemSettings } = schema;
    const [row] = await this.db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'shift_bonus_default_multiplier'))
      .limit(1);
    if (!row) return 10;
    const v = row.value;
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'object' && v != null && typeof (v as { value?: number }).value === 'number') {
      return (v as { value: number }).value;
    }
    const parsed = Number(v);
    return Number.isNaN(parsed) ? 10 : parsed;
  }

  /** Порог бонусов за месяц (shift + quest): при достижении новые квесты не выдаются до конца месяца. 0 = без ограничения. */
  private async getQuestMonthlyBonusCap(): Promise<number> {
    const { systemSettings } = schema;
    const [row] = await this.db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'quest_monthly_bonus_cap'))
      .limit(1);
    if (!row) return 0;
    const v = row.value;
    if (typeof v === 'number' && !Number.isNaN(v) && v >= 0) return v;
    if (typeof v === 'object' && v != null && typeof (v as { value?: number }).value === 'number') {
      const val = (v as { value: number }).value;
      return val >= 0 ? val : 0;
    }
    const parsed = Number(v);
    return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }

  /** Прирост рейтинга надёжности за одну выполненную смену (из system_settings). */
  private async getReliabilityRatingIncreasePerShift(): Promise<number> {
    return this.getSystemSettingNumber('reliability_rating_increase_per_shift', 0.1);
  }

  /** Снижение рейтинга за прогул (no_show). Положительное число — вычитается из рейтинга. */
  private async getReliabilityRatingDecreaseNoShow(): Promise<number> {
    return this.getSystemSettingNumber('reliability_rating_decrease_no_show', 0.2);
  }

  /** Снижение рейтинга за позднюю отмену (late_cancel). Положительное число — вычитается из рейтинга. */
  private async getReliabilityRatingDecreaseLateCancel(): Promise<number> {
    return this.getSystemSettingNumber('reliability_rating_decrease_late_cancel', 0.2);
  }

  private async getSystemSettingNumber(key: string, defaultValue: number): Promise<number> {
    const { systemSettings } = schema;
    const [row] = await this.db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);
    if (!row) return defaultValue;
    const v = row.value;
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'object' && v != null && typeof (v as { value?: number }).value === 'number') {
      return (v as { value: number }).value;
    }
    const parsed = Number(v);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Зарегистрировать штраф (no_show / late_cancel). Запись в strikes; снижение рейтинга надёжности на величину из настроек.
   */
  async registerStrike(
    userId: number,
    type: 'no_show' | 'late_cancel',
    shiftExternalId?: string,
  ): Promise<{ strikeId: number; levelDemoted: boolean }> {
    const { users, strikes } = schema;
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const now = new Date();
    const [strike] = await this.db
      .insert(strikes)
      .values({
        userId,
        type,
        shiftExternalId: shiftExternalId ?? undefined,
        occurredAt: now,
      })
      .returning({ id: strikes.id });
    if (!strike) throw new Error('Failed to create strike');
    const decrease =
      type === 'no_show'
        ? await this.getReliabilityRatingDecreaseNoShow()
        : await this.getReliabilityRatingDecreaseLateCancel();
    const currentRating = user.reliabilityRating ?? 4;
    const newRating = Math.max(0, currentRating - decrease);
    await this.db
      .update(users)
      .set({ reliabilityRating: newRating })
      .where(eq(users.id, userId));
    await this.resetShiftsSeriesProgressForUser(userId);
    return { strikeId: strike.id, levelDemoted: false };
  }

  /**
   * Обнуляет прогресс по квестам «серия смен» для пользователя при прогуле или поздней отмене.
   * Вызывается из registerStrike.
   */
  async resetShiftsSeriesProgressForUser(userId: number): Promise<void> {
    const { quests, questProgress } = schema;
    const now = new Date();
    const todayStart = startOfDayUTC(now);
    const weekStart = startOfWeekUTC(now);
    const monthStart = startOfMonthUTC(now);
    const todayKey = todayStart.toISOString().slice(0, 10);
    const weekKey = weekStart.toISOString().slice(0, 10);
    const monthKey = monthStart.toISOString().slice(0, 7);

    const seriesQuests = await this.db
      .select({
        id: quests.id,
        period: quests.period,
        isOneTime: quests.isOneTime,
        activeFrom: quests.activeFrom,
        activeUntil: quests.activeUntil,
      })
      .from(quests)
      .where(and(eq(quests.isActive, 1), eq(quests.conditionType, 'shifts_series')));
    for (const q of seriesQuests) {
      if (!isQuestInActiveWindow(q.activeFrom as Date | null, q.activeUntil as Date | null, now))
        continue;
      const periodKey =
        q.isOneTime === 1
          ? 'once'
          : q.period === 'daily'
            ? todayKey
            : q.period === 'weekly'
              ? weekKey
              : q.period === 'monthly'
                ? monthKey
                : todayKey;
      await this.db
        .update(questProgress)
        .set({ progress: 0 })
        .where(
          and(
            eq(questProgress.userId, userId),
            eq(questProgress.questId, q.id),
            eq(questProgress.periodKey, periodKey),
            isNull(questProgress.completedAt),
          ),
        );
    }
  }

  /**
   * Проверка и начисление штрафа за позднюю отмену: смена перешла в cancelled менее чем за 24 ч
   * до начала, инициатор отмены — работник (worker). Используется meta.initiatorType из TOJ (job.update.command).
   * Штраф отображается в активностях (strikes).
   * @returns applied: true если штраф начислен; reason — причина пропуска при applied: false
   */
  async processLateCancelIfEligible(params: {
    jobId: string;
    workerId: string;
    jobStartIso: string;
    cancelledAtIso: string;
    /** Тип инициатора из TOJ meta (например "worker"); при значении "worker" штраф применяется */
    initiatorType?: string;
    /** Идентификатор инициатора (для обратной совместимости и аудита); при "worker" тоже считается */
    initiator?: string;
  }): Promise<{ applied: boolean; strikeId?: number; reason?: string }> {
    const { jobId, workerId, jobStartIso, cancelledAtIso, initiatorType, initiator } = params;
    const { users, strikes } = schema;

    const normalizedType = (initiatorType ?? '').toString().trim().toLowerCase();
    const normalizedInitiator = (initiator ?? '').toString().trim().toLowerCase();
    const isWorker = normalizedType === 'worker' || normalizedInitiator === 'worker';
    if (!isWorker) {
      return { applied: false, reason: 'initiator_not_worker' };
    }

    const [userRow] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.externalId, workerId.trim()))
      .limit(1);
    if (!userRow) {
      return { applied: false, reason: 'user_not_found' };
    }

    const startMs = new Date(jobStartIso).getTime();
    const cancelledMs = new Date(cancelledAtIso).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(cancelledMs)) {
      return { applied: false, reason: 'invalid_dates' };
    }
    if (cancelledMs >= startMs) {
      return { applied: false, reason: 'cancelled_after_or_at_start' };
    }
    const hoursBeforeStart = (startMs - cancelledMs) / (60 * 60 * 1000);
    if (hoursBeforeStart >= 24) {
      return { applied: false, reason: 'cancelled_24h_or_more_before_start' };
    }

    const [existing] = await this.db
      .select({ id: strikes.id })
      .from(strikes)
      .where(eq(strikes.shiftExternalId, jobId))
      .limit(1);
    if (existing) {
      return { applied: false, reason: 'strike_already_applied' };
    }

    const { strikeId } = await this.registerStrike(userRow.id, 'late_cancel', jobId);
    return { applied: true, strikeId };
  }

  /**
   * Засчитать прогул по смене (статус failed в TOJ): запись штрафа no_show, привязка к jobId.
   * Идемпотентно по jobId: если штраф по этой смене уже есть — не дублируем.
   * При смене статуса смены на confirmed штраф снимается через removeStrikeByShiftExternalId.
   */
  async processNoShowIfEligible(params: { jobId: string; workerId: string }): Promise<{ applied: boolean; strikeId?: number; reason?: string }> {
    const { jobId, workerId } = params;
    const { users, strikes } = schema;

    const [userRow] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.externalId, workerId.trim()))
      .limit(1);
    if (!userRow) {
      return { applied: false, reason: 'user_not_found' };
    }

    const [existing] = await this.db
      .select({ id: strikes.id })
      .from(strikes)
      .where(
        and(eq(strikes.shiftExternalId, jobId), isNull(strikes.removedAt)),
      )
      .limit(1);
    if (existing) {
      return { applied: false, reason: 'strike_already_applied' };
    }

    const { strikeId } = await this.registerStrike(userRow.id, 'no_show', jobId);
    return { applied: true, strikeId };
  }

  /**
   * Восстановить рейтинг надёжности при снятии штрафа (ручное снятие или смена перешла в confirmed).
   * При смене на confirmed затем вызывается recordShiftCompleted — там начислится прирост за смену.
   */
  async restoreReliabilityRatingForStrikeRemoval(
    userId: number,
    strikeType: 'no_show' | 'late_cancel',
  ): Promise<void> {
    const { users } = schema;
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return;
    const decrease =
      strikeType === 'no_show'
        ? await this.getReliabilityRatingDecreaseNoShow()
        : await this.getReliabilityRatingDecreaseLateCancel();
    const currentRating = user.reliabilityRating ?? 4;
    const newRating = Math.min(5, currentRating + decrease);
    await this.db.update(users).set({ reliabilityRating: newRating }).where(eq(users.id, userId));
  }

  /**
   * Снять штраф по внешнему ID смены (jobId). Используется когда смена из TOJ переходит в confirmed:
   * ранее мог быть начислен прогул (failed) или поздняя отмена (cancelled) — снимаем, восстанавливаем рейтинг.
   * Прирост за саму смену будет начислен при вызове recordShiftCompleted для этой смены.
   */
  async removeStrikeByShiftExternalId(shiftExternalId: string): Promise<{ removed: boolean; userId?: number }> {
    const { strikes } = schema;
    const [strike] = await this.db
      .select()
      .from(strikes)
      .where(
        and(eq(strikes.shiftExternalId, shiftExternalId), isNull(strikes.removedAt)),
      )
      .limit(1);
    if (!strike) {
      return { removed: false };
    }
    const now = new Date();
    await this.db
      .update(strikes)
      .set({
        removedAt: now,
        removalReason: 'Смена подтверждена (confirmed)',
      })
      .where(eq(strikes.id, strike.id));
    await this.restoreReliabilityRatingForStrikeRemoval(strike.userId, strike.type as 'no_show' | 'late_cancel');
    await this.recalcUserLevel(strike.userId);
    await this.recalcQuestProgressForUser(strike.userId);
    return { removed: true, userId: strike.userId };
  }

  /**
   * Пересчёт прогресса по квестам пользователя после смены (или вручную).
   * Условие shifts_count: число транзакций type=shift за период (день/неделя). При достижении total — начисление награды.
   */
  async recalcQuestProgressForUser(userId: number): Promise<void> {
    const { quests, questProgress, transactions, users, userGroupMembers } = schema;
    const now = new Date();
    const todayStart = startOfDayUTC(now);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
    const weekStart = startOfWeekUTC(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    const monthStart = startOfMonthUTC(now);
    const nextMonthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
    const todayKey = todayStart.toISOString().slice(0, 10);
    const weekKey = weekStart.toISOString().slice(0, 10);
    const monthKey = monthStart.toISOString().slice(0, 7);

    const userGroupIds = new Set(
      (
        await this.db
          .select({ groupId: userGroupMembers.groupId })
          .from(userGroupMembers)
          .where(and(eq(userGroupMembers.userId, userId), isNull(userGroupMembers.deletedAt)))
      ).map((r) => r.groupId),
    );

    const cap = await this.getQuestMonthlyBonusCap();
    let capExceeded = false;
    if (cap > 0) {
      const [sumRow] = await this.db
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
      const monthlyBonusSum = Number(sumRow?.sum ?? 0);
      capExceeded = monthlyBonusSum >= cap;
    }

    const rows = await this.db.select().from(quests).where(eq(quests.isActive, 1));
    for (const q of rows) {
      if (q.targetType === 'group' && q.targetGroupId != null) {
        if (!userGroupIds.has(q.targetGroupId)) continue;
      }
      if (!isQuestInActiveWindow(q.activeFrom as Date | null, q.activeUntil as Date | null, now)) {
        continue;
      }
      const period =
        q.period === 'daily'
          ? 'daily'
          : q.period === 'weekly'
            ? 'weekly'
            : q.period === 'monthly'
              ? 'monthly'
              : 'daily';
      let periodKey: string;
      let periodStart: Date;
      let periodEnd: Date;
      if (period === 'daily') {
        periodKey = q.isOneTime === 1 ? 'once' : todayKey;
        periodStart = todayStart;
        periodEnd = tomorrowStart;
      } else if (period === 'weekly') {
        periodKey = q.isOneTime === 1 ? 'once' : weekKey;
        periodStart = weekStart;
        periodEnd = weekEnd;
      } else {
        periodKey = q.isOneTime === 1 ? 'once' : monthKey;
        periodStart = monthStart;
        periodEnd = nextMonthStart;
      }
      const config = (q.conditionConfig as QuestConditionConfig) ?? {};
      const isHoursCondition =
        q.conditionType === 'hours_count' ||
        q.conditionType === 'hours_count_client' ||
        q.conditionType === 'hours_count_clients';
      const isShiftsSeries = q.conditionType === 'shifts_series';
      const isManualConfirmation = q.conditionType === 'manual_confirmation';
      const totalTarget = isManualConfirmation
        ? 1
        : isHoursCondition
          ? (config.totalHours ?? 1)
          : (config.total ?? 1);
      const totalForStorage =
        isHoursCondition ? Math.round(totalTarget * 10) : totalTarget;

      const baseConditions = and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'shift'),
        gte(transactions.createdAt, periodStart),
        lt(transactions.createdAt, periodEnd),
      );
      const baseConditionsBookings = and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'shift_booked'),
        gte(sql`coalesce(${transactions.bookedAt}, ${transactions.createdAt})`, periodStart.toISOString()),
        lt(sql`coalesce(${transactions.bookedAt}, ${transactions.createdAt})`, periodEnd.toISOString()),
      );

      let progress = 0;
      if (q.conditionType === 'bookings_count') {
        const countResult = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .where(baseConditionsBookings);
        progress = Math.min(countResult[0]?.count ?? 0, totalForStorage);
      } else if (q.conditionType === 'shifts_count') {
        const countResult = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .where(baseConditions);
        progress = Math.min(countResult[0]?.count ?? 0, totalForStorage);
      } else if (q.conditionType === 'shifts_count_client' && config.clientId) {
        const countResult = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .where(and(baseConditions, eq(transactions.clientId, config.clientId)));
        progress = Math.min(countResult[0]?.count ?? 0, totalForStorage);
      } else if (q.conditionType === 'shifts_count_clients' && Array.isArray(config.clientIds) && config.clientIds.length > 0) {
        const countResult = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .where(and(baseConditions, inArray(transactions.clientId, config.clientIds)));
        progress = Math.min(countResult[0]?.count ?? 0, totalForStorage);
      } else if (q.conditionType === 'shifts_count_category' && config.category) {
        const countResult = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .where(and(baseConditions, eq(transactions.category, config.category)));
        progress = Math.min(countResult[0]?.count ?? 0, totalForStorage);
      } else if (q.conditionType === 'hours_count') {
        const sumResult = await this.db
          .select({ sum: sql<number>`coalesce(sum(${transactions.hours}), 0)` })
          .from(transactions)
          .where(baseConditions);
        const sumHours = Number(sumResult[0]?.sum ?? 0);
        progress = Math.min(Math.round(sumHours * 10), totalForStorage);
      } else if (q.conditionType === 'hours_count_client' && config.clientId) {
        const sumResult = await this.db
          .select({ sum: sql<number>`coalesce(sum(${transactions.hours}), 0)` })
          .from(transactions)
          .where(and(baseConditions, eq(transactions.clientId, config.clientId)));
        const sumHours = Number(sumResult[0]?.sum ?? 0);
        progress = Math.min(Math.round(sumHours * 10), totalForStorage);
      } else if (q.conditionType === 'hours_count_clients' && Array.isArray(config.clientIds) && config.clientIds.length > 0) {
        const sumResult = await this.db
          .select({ sum: sql<number>`coalesce(sum(${transactions.hours}), 0)` })
          .from(transactions)
          .where(and(baseConditions, inArray(transactions.clientId, config.clientIds)));
        const sumHours = Number(sumResult[0]?.sum ?? 0);
        progress = Math.min(Math.round(sumHours * 10), totalForStorage);
      } else if (isShiftsSeries) {
        const { strikes } = schema;
        const [lastStrikeRow] = await this.db
          .select({ occurredAt: strikes.occurredAt })
          .from(strikes)
          .where(
            and(
              eq(strikes.userId, userId),
              gte(strikes.occurredAt, periodStart),
              lt(strikes.occurredAt, periodEnd),
              isNull(strikes.removedAt),
            ),
          )
          .orderBy(desc(strikes.occurredAt))
          .limit(1);
        const lastStrikeAt = lastStrikeRow?.occurredAt
          ? new Date(lastStrikeRow.occurredAt)
          : new Date(periodStart.getTime() - 1);
        const seriesCountResult = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.type, 'shift'),
              gte(transactions.createdAt, periodStart),
              lt(transactions.createdAt, periodEnd),
              gt(transactions.createdAt, lastStrikeAt),
            ),
          );
        const seriesCount = seriesCountResult[0]?.count ?? 0;
        progress = Math.min(seriesCount, totalForStorage);
      } else if (isManualConfirmation) {
        progress = 0;
      }

      const total = totalForStorage;

      const existing = await this.db
        .select()
        .from(questProgress)
        .where(
          and(
            eq(questProgress.userId, userId),
            eq(questProgress.questId, q.id),
            eq(questProgress.periodKey, periodKey),
          ),
        )
        .limit(1);
      const row = existing[0];

      if (row) {
        if (row.completedAt) continue;
        await this.db
          .update(questProgress)
          .set({ progress, updatedAt: now })
          .where(eq(questProgress.id, row.id));
      } else {
        if (capExceeded) continue;
        await this.db
          .insert(questProgress)
          .values({
            userId,
            questId: q.id,
            periodKey,
            progress,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              questProgress.userId,
              questProgress.questId,
              questProgress.periodKey,
            ],
            set: { progress, updatedAt: now },
          });
      }

      // Атомарно помечаем квест выполненным и получаем право на начисление награды только один раз
      const completedRows = await this.db
        .update(questProgress)
        .set({ completedAt: now, updatedAt: now })
        .where(
          and(
            eq(questProgress.userId, userId),
            eq(questProgress.questId, q.id),
            eq(questProgress.periodKey, periodKey),
            isNull(questProgress.completedAt),
            gte(questProgress.progress, total),
          ),
        )
        .returning({ id: questProgress.id });
      if (completedRows.length > 0) {
        const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (user) {
          await this.db
            .update(users)
            .set({ balance: user.balance + q.rewardCoins })
            .where(eq(users.id, userId));
          await this.db.insert(transactions).values({
            userId,
            amount: q.rewardCoins,
            type: 'quest',
            sourceRef: String(q.id),
            title: q.name,
          });
        }
      }
    }
  }

  /**
   * Ручное подтверждение выполнения квеста администратором (тип условия manual_confirmation).
   * Начисляет награду и помечает квест выполненным за период для пользователя.
   * Идемпотентно: повторный вызов для уже выполненного квеста возвращает alreadyCompleted: true без повторного начисления.
   */
  async completeManualQuestForUser(
    userId: number,
    questId: number,
  ): Promise<{ completed: boolean; alreadyCompleted: boolean }> {
    const { quests, questProgress, users, transactions } = schema;
    const now = new Date();
    const [quest] = await this.db.select().from(quests).where(eq(quests.id, questId)).limit(1);
    if (!quest) {
      throw new NotFoundException('Quest not found');
    }
    if (quest.conditionType !== 'manual_confirmation') {
      throw new NotFoundException('Quest is not a manual confirmation quest');
    }
    if (quest.isActive !== 1) {
      throw new NotFoundException('Quest is not active');
    }
    if (!isQuestInActiveWindow(quest.activeFrom as Date | null, quest.activeUntil as Date | null, now)) {
      throw new NotFoundException('Quest is not in active window');
    }
    const todayKey = now.toISOString().slice(0, 10);
    const weekStart = startOfWeekUTC(now);
    const weekKey = weekStart.toISOString().slice(0, 10);
    const monthStart = startOfMonthUTC(now);
    const monthKey = monthStart.toISOString().slice(0, 7);
    const periodKey =
      quest.isOneTime === 1
        ? 'once'
        : quest.period === 'daily'
          ? todayKey
          : quest.period === 'weekly'
            ? weekKey
            : quest.period === 'monthly'
              ? monthKey
              : todayKey;

    const [existing] = await this.db
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
    if (existing?.completedAt) {
      return { completed: false, alreadyCompleted: true };
    }

    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (existing) {
      await this.db
        .update(questProgress)
        .set({ progress: 1, completedAt: now, updatedAt: now })
        .where(eq(questProgress.id, existing.id));
    } else {
      await this.db.insert(questProgress).values({
        userId,
        questId,
        periodKey,
        progress: 1,
        completedAt: now,
        updatedAt: now,
      });
    }
    await this.db
      .update(users)
      .set({ balance: user.balance + quest.rewardCoins })
      .where(eq(users.id, userId));
    await this.db.insert(transactions).values({
      userId,
      amount: quest.rewardCoins,
      type: 'quest',
      sourceRef: String(quest.id),
      title: quest.name,
    });
    return { completed: true, alreadyCompleted: false };
  }
}

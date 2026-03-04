import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../infra/db/drizzle/schemas';
import { drizzleProvider } from '../../infra/db/drizzle/drizzle.module';
import type { Envs } from '../../shared/env.validation-schema';
import { MeResponseDto } from './dto/me.dto';
import { QuestResponseDto } from './dto/quest.dto';
import { StoreItemResponseDto } from './dto/store.dto';
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

  async getMe(userId: number): Promise<MeResponseDto> {
    const { users, levels, strikes } = schema;
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
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const strikesCount = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(strikes)
      .where(and(eq(strikes.userId, userId), gte(strikes.occurredAt, thirtyDaysAgo)));
    const count = strikesCount[0]?.count ?? 0;
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
    dto.shiftsCompleted = user.shiftsCompleted;
    dto.shiftsRequired = level.shiftsRequired;
    dto.strikesCount = count;
    dto.strikesThreshold = level.strikeThreshold;
    return dto;
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
    const { quests, questProgress } = schema;
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekKey = weekStart.toISOString().slice(0, 10);
    const activeQuests = await this.db.select().from(quests).where(eq(quests.isActive, 1));
    const result: QuestResponseDto[] = [];
    for (const q of activeQuests) {
      const periodKey = q.period === 'daily' ? todayKey : weekKey;
      const config = (q.conditionConfig as { total?: number }) ?? {};
      const total = config.total ?? 1;
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
      const progress = prog[0]?.progress ?? 0;
      const completed = !!prog[0]?.completedAt;
      const dto = new QuestResponseDto();
      dto.id = q.id;
      dto.name = q.name;
      dto.description = q.description;
      dto.period = q.period;
      dto.progress = progress;
      dto.total = total;
      dto.reward = q.rewardCoins;
      dto.icon = q.icon ?? 'target';
      dto.completed = completed;
      result.push(dto);
    }
    return result;
  }

  async getStoreItems(): Promise<StoreItemResponseDto[]> {
    const { storeItems } = schema;
    const rows = await this.db
      .select()
      .from(storeItems)
      .where(eq(storeItems.isActive, 1))
      .orderBy(storeItems.sortOrder, storeItems.id);
    return rows.map((r) => {
      const dto = new StoreItemResponseDto();
      dto.id = r.id;
      dto.name = r.name;
      dto.description = r.description;
      dto.category = r.category;
      dto.cost = r.cost;
      dto.icon = r.icon ?? 'gift';
      return dto;
    });
  }

  async createRedemption(userId: number, storeItemId: number): Promise<{ redemptionId: number }> {
    const { users, storeItems, transactions, redemptions } = schema;
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const [item] = await this.db.select().from(storeItems).where(eq(storeItems.id, storeItemId)).limit(1);
    if (!item || item.isActive !== 1) {
      throw new NotFoundException('Store item not found or inactive');
    }
    if (user.balance < item.cost) {
      throw new NotFoundException('Insufficient balance');
    }
    const [redemption] = await this.db
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
    await this.db.update(users).set({ balance: user.balance - item.cost }).where(eq(users.id, userId));
    await this.db.insert(transactions).values({
      userId,
      amount: -item.cost,
      type: 'redemption',
      sourceRef: String(redemption.id),
      title: item.name,
    });
    return { redemptionId: redemption.id };
  }

  /**
   * Пересчёт уровня пользователя по числу завершённых смен.
   * Уровень = максимальный по shifts_required такой, что shifts_required <= user.shifts_completed.
   */
  async recalcUserLevel(userId: number): Promise<void> {
    const { users, levels } = schema;
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return;
    const [newLevel] = await this.db
      .select()
      .from(levels)
      .where(lte(levels.shiftsRequired, user.shiftsCompleted))
      .orderBy(desc(levels.shiftsRequired))
      .limit(1);
    if (newLevel && newLevel.id !== user.levelId) {
      await this.db.update(users).set({ levelId: newLevel.id }).where(eq(users.id, userId));
    }
  }

  /**
   * Засчитать завершённую смену: начисление монет, транзакция, +1 к shifts_completed, пересчёт уровня.
   * Для вызова из админки/dev или из webhook при интеграции.
   */
  async recordShiftCompleted(
    userId: number,
    coins: number,
    title?: string,
    location?: string,
  ): Promise<{ transactionId: number }> {
    const { users, transactions } = schema;
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (coins < 0) {
      throw new NotFoundException('coins must be >= 0');
    }
    const [tx] = await this.db
      .insert(transactions)
      .values({
        userId,
        amount: coins,
        type: 'shift',
        title: title ?? 'Смена',
        location: location ?? undefined,
      })
      .returning({ id: transactions.id });
    if (!tx) throw new Error('Failed to create transaction');
    await this.db
      .update(users)
      .set({
        balance: user.balance + coins,
        shiftsCompleted: user.shiftsCompleted + 1,
      })
      .where(eq(users.id, userId));
    await this.recalcUserLevel(userId);
    await this.recalcQuestProgressForUser(userId);
    return { transactionId: tx.id };
  }

  /**
   * Зарегистрировать штраф (no_show / late_cancel). Запись в strikes, при достижении порога уровня — понижение на 1.
   */
  async registerStrike(
    userId: number,
    type: 'no_show' | 'late_cancel',
    shiftExternalId?: string,
  ): Promise<{ strikeId: number; levelDemoted: boolean }> {
    const { users, levels, strikes } = schema;
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
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(strikes)
      .where(and(eq(strikes.userId, userId), gte(strikes.occurredAt, thirtyDaysAgo)));
    const count = countResult[0]?.count ?? 0;
    const [currentLevel] = await this.db
      .select()
      .from(levels)
      .where(eq(levels.id, user.levelId))
      .limit(1);
    let levelDemoted = false;
    if (currentLevel?.strikeThreshold != null && count >= currentLevel.strikeThreshold) {
      const [prevLevel] = await this.db
        .select()
        .from(levels)
        .where(eq(levels.sortOrder, currentLevel.sortOrder - 1))
        .limit(1);
      if (prevLevel) {
        await this.db.update(users).set({ levelId: prevLevel.id }).where(eq(users.id, userId));
        levelDemoted = true;
      }
    }
    return { strikeId: strike.id, levelDemoted };
  }

  /**
   * Пересчёт прогресса по квестам пользователя после смены (или вручную).
   * Условие shifts_count: число транзакций type=shift за период (день/неделя). При достижении total — начисление награды.
   */
  async recalcQuestProgressForUser(userId: number): Promise<void> {
    const { quests, questProgress, transactions, users } = schema;
    const now = new Date();
    const todayStart = startOfDayUTC(now);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
    const weekStart = startOfWeekUTC(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    const todayKey = todayStart.toISOString().slice(0, 10);
    const weekKey = weekStart.toISOString().slice(0, 10);

    const activeQuests = await this.db
      .select()
      .from(quests)
      .where(eq(quests.isActive, 1));
    for (const q of activeQuests) {
      const periodKey = q.period === 'daily' ? todayKey : weekKey;
      const periodStart = q.period === 'daily' ? todayStart : weekStart;
      const periodEnd = q.period === 'daily' ? tomorrowStart : weekEnd;
      const config = (q.conditionConfig as { total?: number }) ?? {};
      const total = config.total ?? 1;

      let progress = 0;
      if (q.conditionType === 'shifts_count') {
        const countResult = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.type, 'shift'),
              gte(transactions.createdAt, periodStart),
              lt(transactions.createdAt, periodEnd),
            ),
          );
        progress = Math.min(countResult[0]?.count ?? 0, total);
      }

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
        if (progress >= total) {
          await this.db
            .update(questProgress)
            .set({ completedAt: now })
            .where(eq(questProgress.id, row.id));
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
      } else {
        await this.db.insert(questProgress).values({
          userId,
          questId: q.id,
          periodKey,
          progress,
          updatedAt: now,
        });
        if (progress >= total) {
          const [inserted] = await this.db
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
          if (inserted) {
            await this.db
              .update(questProgress)
              .set({ completedAt: now })
              .where(eq(questProgress.id, inserted.id));
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
    }
  }
}

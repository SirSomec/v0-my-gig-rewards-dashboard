import { integer, jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './base.schema';

export const quests = pgTable('quests', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 256 }).notNull(),
  description: varchar('description', { length: 512 }),
  period: varchar('period', { length: 16 }).notNull(), // daily | weekly | monthly
  conditionType: varchar('condition_type', { length: 64 }).notNull(),
  conditionConfig: jsonb('condition_config').$type<Record<string, unknown>>().default({}),
  rewardCoins: integer('reward_coins').notNull(),
  icon: varchar('icon', { length: 32 }).default('target'),
  isActive: integer('is_active').notNull().default(1),
  /** Единоразовый: пользователь может выполнить квест только один раз (независимо от периода) */
  isOneTime: integer('is_one_time').notNull().default(0),
  /** Квест показывается и учитывается только с этой даты (UTC) */
  activeFrom: timestamp('active_from', { withTimezone: true }),
  /** После этой даты квест автоматически не показывается (отключение по истечении периода) */
  activeUntil: timestamp('active_until', { withTimezone: true }),
  targetType: varchar('target_type', { length: 16 }).default('all'), // all | group
  targetGroupId: integer('target_group_id'),
  ...timestamps,
});

import { integer, jsonb, pgTable, real, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './base.schema';

export const levels = pgTable('levels', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 128 }).notNull(),
  shiftsRequired: integer('shifts_required').notNull(),
  strikeThreshold: integer('strike_threshold'), // устаревшее: порог за 30 дней (оставлено для совместимости)
  /** Макс. штрафов за текущую неделю; при превышении — понижение на 1 уровень (null = не понижаем) */
  strikeLimitPerWeek: integer('strike_limit_per_week'),
  /** Макс. штрафов за текущий месяц; при превышении — понижение на 1 уровень (null = не понижаем) */
  strikeLimitPerMonth: integer('strike_limit_per_month'),
  perks: jsonb('perks').$type<Array<{ title: string; description?: string }>>().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
  /** Дополнительный множитель бонусов за смену для данного уровня (по умолчанию 1) */
  bonusMultiplier: real('bonus_multiplier').notNull().default(1),
  ...timestamps,
});

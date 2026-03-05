import { integer, jsonb, pgTable, varchar } from 'drizzle-orm/pg-core';
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
  ...timestamps,
});

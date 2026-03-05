import { jsonb, pgTable, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './base.schema';

/** Ключ-значение настроек системы (множитель бонусов за смену по умолчанию и т.д.) */
export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  ...timestamps,
});

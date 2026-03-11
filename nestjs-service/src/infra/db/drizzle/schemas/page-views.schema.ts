import { integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

/** События просмотра вкладок/страниц пользователями дашборда (для аналитики посещаемости). */
export const pageViews = pgTable('page_views', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references(() => users.id),
  /** Путь/вкладка: home, history, store, levels и т.д. */
  path: varchar('path', { length: 128 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

import { integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { quests } from './quests.schema';
import { users } from './users.schema';

export const questProgress = pgTable('quest_progress', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  questId: integer('quest_id').references(() => quests.id, { onDelete: 'cascade' }).notNull(),
  periodKey: varchar('period_key', { length: 32 }).notNull(), // YYYY-MM-DD (daily/weekly), YYYY-MM (monthly), 'once' (one-time)
  progress: integer('progress').notNull().default(0),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

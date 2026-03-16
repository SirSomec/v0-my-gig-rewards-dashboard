import { integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const pendingRecalcUsers = pgTable('pending_recalc_users', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  reason: varchar('reason', { length: 64 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  availableAt: timestamp('available_at', { withTimezone: true }).defaultNow().notNull(),
  attempts: integer('attempts').notNull().default(0),
  lastError: varchar('last_error', { length: 1024 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

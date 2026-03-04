import { integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const strikes = pgTable('strikes', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 32 }).notNull(), // 'no_show' | 'late_cancel'
  shiftExternalId: varchar('shift_external_id', { length: 256 }),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

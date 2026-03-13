import { integer, pgTable, real, timestamp, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

/** Лог изменений рейтинга надёжности (смена, штраф, снятие штрафа и т.д.) */
export const reliabilityRatingLog = pgTable('reliability_rating_log', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  previousRating: real('previous_rating').notNull(),
  newRating: real('new_rating').notNull(),
  reason: varchar('reason', { length: 64 }).notNull(),
  referenceType: varchar('reference_type', { length: 32 }),
  referenceId: varchar('reference_id', { length: 128 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

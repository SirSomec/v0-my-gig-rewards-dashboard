import { integer, pgTable, real, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './base.schema';
import { levels } from './levels.schema';

export const users = pgTable('users', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  externalId: varchar('external_id', { length: 256 }),
  name: varchar('name', { length: 256 }),
  email: varchar('email', { length: 256 }),
  avatarUrl: varchar('avatar_url', { length: 512 }),
  balance: integer('balance').notNull().default(0),
  levelId: integer('level_id').references(() => levels.id).notNull(),
  shiftsCompleted: integer('shifts_completed').notNull().default(0),
  /** Рейтинг надёжности 0–5. По умолчанию 4. Дробное. */
  reliabilityRating: real('reliability_rating').notNull().default(4),
  ...timestamps,
});

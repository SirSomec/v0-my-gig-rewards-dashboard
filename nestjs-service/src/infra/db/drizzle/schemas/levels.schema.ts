import { integer, jsonb, pgTable, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './base.schema';

export const levels = pgTable('levels', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 128 }).notNull(),
  shiftsRequired: integer('shifts_required').notNull(),
  strikeThreshold: integer('strike_threshold'), // null для бронзы — понижение не применяется
  perks: jsonb('perks').$type<Array<{ title: string; description?: string }>>().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

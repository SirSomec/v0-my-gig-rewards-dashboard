import { integer, jsonb, timestamp, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './base.schema';

export const storeItems = pgTable('store_items', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 256 }).notNull(),
  description: varchar('description', { length: 1024 }),
  category: varchar('category', { length: 64 }).notNull(),
  cost: integer('cost').notNull(),
  icon: varchar('icon', { length: 64 }).default('gift'),
  stockLimit: integer('stock_limit'),
  visibleFrom: timestamp('visible_from', { withTimezone: true }),
  visibleUntil: timestamp('visible_until', { withTimezone: true }),
  isActive: integer('is_active').notNull().default(1), // 1 = да
  sortOrder: integer('sort_order').notNull().default(0),
  visibilityRules: jsonb('visibility_rules').$type<Record<string, unknown>>(),
  ...timestamps,
});

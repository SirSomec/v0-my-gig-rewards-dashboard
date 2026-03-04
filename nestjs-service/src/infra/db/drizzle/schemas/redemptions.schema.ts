import { integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { storeItems } from './store-items.schema';
import { users } from './users.schema';

export const redemptions = pgTable('redemptions', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  storeItemId: integer('store_item_id').references(() => storeItems.id).notNull(),
  status: varchar('status', { length: 32 }).notNull(), // pending | fulfilled | cancelled
  coinsSpent: integer('coins_spent').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  processedBy: integer('processed_by'),
  notes: varchar('notes', { length: 512 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

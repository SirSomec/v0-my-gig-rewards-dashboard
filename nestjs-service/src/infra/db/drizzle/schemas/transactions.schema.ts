import { integer, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './base.schema';
import { users } from './users.schema';

export const transactions = pgTable('transactions', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  amount: integer('amount').notNull(), // + начисление, − списание
  type: varchar('type', { length: 32 }).notNull(), // shift | bonus | quest | manual_credit | manual_debit | redemption
  sourceRef: varchar('source_ref', { length: 256 }),
  title: varchar('title', { length: 256 }),
  description: varchar('description', { length: 512 }),
  location: varchar('location', { length: 256 }),
  createdBy: integer('created_by'), // для ручных операций — ID админа
  ...timestamps,
});

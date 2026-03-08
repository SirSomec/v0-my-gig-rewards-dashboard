import { integer, pgTable, real, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './base.schema';
import { users } from './users.schema';

export const transactions = pgTable('transactions', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  amount: integer('amount').notNull(), // + начисление, − списание
  type: varchar('type', { length: 32 }).notNull(), // shift | shift_booked | bonus | quest | manual_credit | manual_debit | redemption
  sourceRef: varchar('source_ref', { length: 256 }),
  title: varchar('title', { length: 256 }),
  description: varchar('description', { length: 512 }),
  location: varchar('location', { length: 256 }),
  /** ID или код бренда/клиента (для квестов по сменам/часам в клиенте) */
  clientId: varchar('client_id', { length: 128 }),
  /** Категория/профессия смены (для квестов по категории) */
  category: varchar('category', { length: 128 }),
  /** Часы, отработанные в смене (для квестов по часам) */
  hours: real('hours'),
  createdBy: integer('created_by'), // для ручных операций — ID админа
  ...timestamps,
});

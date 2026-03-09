import { integer, pgTable, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './base.schema';

export const userGroups = pgTable('user_groups', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 256 }).notNull(),
  description: varchar('description', { length: 512 }),
  ...timestamps,
});

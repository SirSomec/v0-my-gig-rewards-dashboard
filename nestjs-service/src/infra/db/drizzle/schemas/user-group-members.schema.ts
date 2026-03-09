import { integer, pgTable, unique } from 'drizzle-orm/pg-core';
import { timestamps } from './base.schema';
import { userGroups } from './user-groups.schema';
import { users } from './users.schema';

export const userGroupMembers = pgTable(
  'user_group_members',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    groupId: integer('group_id')
      .references(() => userGroups.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    ...timestamps,
  },
  (t) => [unique().on(t.groupId, t.userId)],
);

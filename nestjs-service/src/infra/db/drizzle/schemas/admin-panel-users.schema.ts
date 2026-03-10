import { integer, jsonb, pgTable, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './base.schema';

/** Ключи прав доступа к разделам админ-панели. Совпадают с ключами в nav. */
export const ADMIN_PERMISSION_KEYS = [
  'overview',
  'users',
  'redemptions',
  'store',
  'quests',
  'user_groups',
  'quest_moderation',
  'levels',
  'settings',
  'balance',
  'audit',
  'admin_users',
  'mock_toj',
  'dev',
  'etl_explorer',
] as const;

export type AdminPermissionKey = (typeof ADMIN_PERMISSION_KEYS)[number];

export const adminPanelUsers = pgTable('admin_panel_users', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  email: varchar('email', { length: 256 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 256 }).notNull(),
  name: varchar('name', { length: 256 }),
  isActive: integer('is_active').default(1).notNull(), // 1 = active, 0 = disabled
  /** Массив ключей прав (overview, users, store, ...). Пустой = только вход без разделов. */
  permissions: jsonb('permissions').$type<AdminPermissionKey[]>().default([]),
  ...timestamps,
});

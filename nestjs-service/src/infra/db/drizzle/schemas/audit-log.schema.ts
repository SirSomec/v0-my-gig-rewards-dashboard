import { integer, jsonb, pgTable, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './base.schema';

export const auditLog = pgTable('audit_log', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  adminId: integer('admin_id'),
  action: varchar('action', { length: 64 }).notNull(),
  entityType: varchar('entity_type', { length: 64 }),
  entityId: varchar('entity_id', { length: 128 }),
  oldValues: jsonb('old_values').$type<Record<string, unknown>>(),
  newValues: jsonb('new_values').$type<Record<string, unknown>>(),
  ...timestamps,
});

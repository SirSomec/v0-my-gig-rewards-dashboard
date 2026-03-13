import { integer, pgTable, real, timestamp, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './base.schema';
import { adminPanelUsers } from './admin-panel-users.schema';
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
  /** Статус участия в программе лояльности: active | pending */
  loyaltyStatus: varchar('loyalty_status', { length: 16 }).notNull().default('active'),
  /** Когда пользователь нажал «Зарегистрироваться» (принял условия) */
  loyaltyRequestedAt: timestamp('loyalty_requested_at', { withTimezone: true }),
  /** Когда админ одобрил заявку */
  loyaltyApprovedAt: timestamp('loyalty_approved_at', { withTimezone: true }),
  /** ID администратора, одобрившего заявку */
  loyaltyApprovedByAdminId: integer('loyalty_approved_by_admin_id').references(() => adminPanelUsers.id, { onDelete: 'set null' }),
  /** С какого момента учитывать смены (при предрегистрации — дата одобрения) */
  loyaltyStartedAt: timestamp('loyalty_started_at', { withTimezone: true }),
  ...timestamps,
});

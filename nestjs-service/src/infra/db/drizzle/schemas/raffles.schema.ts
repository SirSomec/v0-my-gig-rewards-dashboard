import { integer, pgTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './base.schema';
import { adminPanelUsers } from './admin-panel-users.schema';
import { users } from './users.schema';

export const raffles = pgTable('raffles', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: varchar('title', { length: 256 }).notNull(),
  description: varchar('description', { length: 2048 }),
  status: varchar('status', { length: 32 }).notNull().default('draft'), // draft | active | drawing | completed | completed_without_entries | cancelled
  ticketPrice: integer('ticket_price').notNull(),
  maxTicketsPerUser: integer('max_tickets_per_user'),
  winnersCount: integer('winners_count').notNull().default(1),
  coverImageUrl: varchar('cover_image_url', { length: 512 }),
  isVisible: integer('is_visible').notNull().default(1),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdBy: integer('created_by').references(() => adminPanelUsers.id, { onDelete: 'set null' }),
  ...timestamps,
});

export const rafflePrizes = pgTable('raffle_prizes', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  raffleId: integer('raffle_id').references(() => raffles.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 256 }).notNull(),
  description: varchar('description', { length: 2048 }),
  imageUrl: varchar('image_url', { length: 512 }),
  quantity: integer('quantity').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

export const raffleTickets = pgTable(
  'raffle_tickets',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    raffleId: integer('raffle_id').references(() => raffles.id, { onDelete: 'cascade' }).notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    ticketNumber: integer('ticket_number').notNull(),
    sourceRef: varchar('source_ref', { length: 256 }),
    ...timestamps,
  },
  (table) => ({
    raffleTicketNumberIdx: uniqueIndex('raffle_tickets_raffle_ticket_number_uidx').on(
      table.raffleId,
      table.ticketNumber,
    ),
    raffleSourceRefIdx: uniqueIndex('raffle_tickets_raffle_source_ref_uidx').on(
      table.raffleId,
      table.sourceRef,
    ),
  }),
);

export const raffleWinners = pgTable(
  'raffle_winners',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    raffleId: integer('raffle_id').references(() => raffles.id, { onDelete: 'cascade' }).notNull(),
    prizeId: integer('prize_id').references(() => rafflePrizes.id, { onDelete: 'cascade' }).notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    ticketId: integer('ticket_id').references(() => raffleTickets.id, { onDelete: 'cascade' }).notNull(),
    selectedAt: timestamp('selected_at', { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => ({
    rafflePrizeWinnerIdx: uniqueIndex('raffle_winners_prize_id_uidx').on(table.prizeId),
    raffleTicketWinnerIdx: uniqueIndex('raffle_winners_ticket_id_uidx').on(table.ticketId),
  }),
);

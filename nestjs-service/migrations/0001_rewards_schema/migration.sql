-- Rewards schema: levels, users, strikes, transactions, store_items, redemptions, quests, quest_progress, audit_log

CREATE TABLE IF NOT EXISTS "levels" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(128) NOT NULL,
  "shifts_required" integer NOT NULL,
  "strike_threshold" integer,
  "perks" jsonb DEFAULT '[]'::jsonb,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "external_id" varchar(256),
  "name" varchar(256),
  "email" varchar(256),
  "avatar_url" varchar(512),
  "balance" integer DEFAULT 0 NOT NULL,
  "level_id" integer NOT NULL REFERENCES "levels"("id"),
  "shifts_completed" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

CREATE TABLE IF NOT EXISTS "strikes" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" varchar(32) NOT NULL,
  "shift_external_id" varchar(256),
  "occurred_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "transactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" integer NOT NULL,
  "type" varchar(32) NOT NULL,
  "source_ref" varchar(256),
  "title" varchar(256),
  "description" varchar(512),
  "location" varchar(256),
  "created_by" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

CREATE TABLE IF NOT EXISTS "store_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(256) NOT NULL,
  "description" varchar(1024),
  "category" varchar(64) NOT NULL,
  "cost" integer NOT NULL,
  "icon" varchar(64) DEFAULT 'gift',
  "stock_limit" integer,
  "visible_from" timestamp with time zone,
  "visible_until" timestamp with time zone,
  "is_active" integer DEFAULT 1 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "visibility_rules" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

CREATE TABLE IF NOT EXISTS "redemptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "store_item_id" integer NOT NULL REFERENCES "store_items"("id"),
  "status" varchar(32) NOT NULL,
  "coins_spent" integer NOT NULL,
  "processed_at" timestamp with time zone,
  "processed_by" integer,
  "notes" varchar(512),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "quests" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(256) NOT NULL,
  "description" varchar(512),
  "period" varchar(16) NOT NULL,
  "condition_type" varchar(64) NOT NULL,
  "condition_config" jsonb DEFAULT '{}'::jsonb,
  "reward_coins" integer NOT NULL,
  "icon" varchar(32) DEFAULT 'target',
  "is_active" integer DEFAULT 1 NOT NULL,
  "target_type" varchar(16) DEFAULT 'all',
  "target_group_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

CREATE TABLE IF NOT EXISTS "quest_progress" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "quest_id" integer NOT NULL REFERENCES "quests"("id") ON DELETE CASCADE,
  "period_key" varchar(32) NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "admin_id" integer,
  "action" varchar(64) NOT NULL,
  "entity_type" varchar(64),
  "entity_id" varchar(128),
  "old_values" jsonb,
  "new_values" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

-- Справочник уровней (FUNCTIONALITY.md)
INSERT INTO "levels" ("name", "shifts_required", "strike_threshold", "perks", "sort_order")
VALUES
  ('Бронзовый новичок', 0, NULL, '[{"title": "Базовая ставка"}, {"title": "Стандартное расписание"}, {"title": "Начисление монет 1x"}]'::jsonb, 0),
  ('Серебряный партнёр', 10, 2, '[{"title": "+5% бонус за смену"}, {"title": "2x монеты в выходные"}, {"title": "Приоритет выбора смен"}]'::jsonb, 1),
  ('Золотой партнёр', 25, 3, '[{"title": "+10% бонус"}, {"title": "Мгновенные выплаты"}, {"title": "3x монеты в выходные"}]'::jsonb, 2),
  ('Платиновый элит', 50, 4, '[{"title": "+15% бонус"}, {"title": "VIP-поддержка"}, {"title": "5x монеты в выходные"}]'::jsonb, 3);

-- Лог изменений рейтинга надёжности (отдельная таблица)
CREATE TABLE IF NOT EXISTS "reliability_rating_log" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "previous_rating" real NOT NULL,
  "new_rating" real NOT NULL,
  "reason" varchar(64) NOT NULL,
  "reference_type" varchar(32),
  "reference_id" varchar(128),
  "created_at" timestamp DEFAULT now() NOT NULL
);

COMMENT ON TABLE "reliability_rating_log" IS 'Логирование всех изменений рейтинга надёжности пользователя (смена, штраф, снятие штрафа и т.д.)';

CREATE INDEX IF NOT EXISTS "reliability_rating_log_user_id_idx" ON "reliability_rating_log" ("user_id");
CREATE INDEX IF NOT EXISTS "reliability_rating_log_created_at_idx" ON "reliability_rating_log" ("created_at");

-- Предварительная регистрация в программе лояльности
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "loyalty_status" varchar(16) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "loyalty_requested_at" timestamp,
  ADD COLUMN IF NOT EXISTS "loyalty_approved_at" timestamp,
  ADD COLUMN IF NOT EXISTS "loyalty_approved_by_admin_id" integer REFERENCES "admin_panel_users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "loyalty_started_at" timestamp;

COMMENT ON COLUMN "users"."loyalty_status" IS 'Статус участия в программе: active — участник, pending — заявка на рассмотрении';
COMMENT ON COLUMN "users"."loyalty_requested_at" IS 'Когда пользователь нажал «Зарегистрироваться» (принял условия)';
COMMENT ON COLUMN "users"."loyalty_approved_at" IS 'Когда админ одобрил заявку';
COMMENT ON COLUMN "users"."loyalty_approved_by_admin_id" IS 'ID администратора, одобрившего заявку';
COMMENT ON COLUMN "users"."loyalty_started_at" IS 'С какого момента учитывать смены (при предрегистрации — дата одобрения, иначе created_at)';

UPDATE "users" SET "loyalty_status" = 'active' WHERE "loyalty_status" IS NULL;

-- Настройка: включена ли предварительная регистрация (по умолчанию выключена)
INSERT INTO "system_settings" ("key", "value")
VALUES ('loyalty_pre_registration_enabled', 'false')
ON CONFLICT ("key") DO NOTHING;

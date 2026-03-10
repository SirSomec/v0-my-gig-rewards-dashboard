-- Пользователи админ-панели: email + пароль, права доступа к разделам.
-- Суперадмин задаётся в .env (ADMIN_SUPER_EMAIL, ADMIN_SUPER_PASSWORD) и не хранится в БД.
CREATE TABLE IF NOT EXISTS "admin_panel_users" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" varchar(256) NOT NULL UNIQUE,
  "password_hash" varchar(256) NOT NULL,
  "name" varchar(256),
  "is_active" integer DEFAULT 1 NOT NULL,
  "permissions" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "admin_panel_users_email_idx" ON "admin_panel_users"("email");
CREATE INDEX IF NOT EXISTS "admin_panel_users_is_active_idx" ON "admin_panel_users"("is_active");

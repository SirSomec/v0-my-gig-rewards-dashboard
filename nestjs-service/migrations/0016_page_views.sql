-- Счётчики посещаемости и просмотра вкладок пользователями дашборда (аналитика в админке).
CREATE TABLE IF NOT EXISTS "page_views" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer REFERENCES "users"("id"),
  "path" varchar(128) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "page_views_created_at_idx" ON "page_views"("created_at");
CREATE INDEX IF NOT EXISTS "page_views_user_id_idx" ON "page_views"("user_id");
CREATE INDEX IF NOT EXISTS "page_views_path_idx" ON "page_views"("path");

CREATE TABLE IF NOT EXISTS "pending_recalc_users" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reason" varchar(64) NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'pending',
  "available_at" timestamp DEFAULT now() NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" varchar(1024),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "pending_recalc_users_status_available_at_idx"
  ON "pending_recalc_users" ("status", "available_at");

CREATE INDEX IF NOT EXISTS "pending_recalc_users_user_id_idx"
  ON "pending_recalc_users" ("user_id");

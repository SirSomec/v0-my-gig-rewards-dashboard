-- Группы пользователей (для привязки квестов target_type=group)
CREATE TABLE IF NOT EXISTS "user_groups" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(256) NOT NULL,
  "description" varchar(512),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

-- Участники групп (many-to-many)
CREATE TABLE IF NOT EXISTS "user_group_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL REFERENCES "user_groups"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  UNIQUE("group_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "user_group_members_group_id_idx" ON "user_group_members"("group_id");
CREATE INDEX IF NOT EXISTS "user_group_members_user_id_idx" ON "user_group_members"("user_id");

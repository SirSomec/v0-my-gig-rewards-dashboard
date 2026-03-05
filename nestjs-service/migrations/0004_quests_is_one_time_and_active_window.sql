-- Единоразовый квест (отдельный признак) и автоотключение по окончании периода
ALTER TABLE "quests"
  ADD COLUMN IF NOT EXISTS "is_one_time" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "active_from" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "active_until" timestamp with time zone;

COMMENT ON COLUMN "quests"."is_one_time" IS '1 = единоразовый (выполняется один раз на пользователя)';
COMMENT ON COLUMN "quests"."active_from" IS 'Квест активен с этой даты (UTC)';
COMMENT ON COLUMN "quests"."active_until" IS 'После этой даты квест не показывается (автоотключение по периоду)';

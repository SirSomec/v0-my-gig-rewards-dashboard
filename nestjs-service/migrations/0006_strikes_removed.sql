-- 6.7: снятие штрафа с причиной (removed_at, removal_reason)
ALTER TABLE "strikes"
  ADD COLUMN IF NOT EXISTS "removed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "removal_reason" varchar(512);

COMMENT ON COLUMN "strikes"."removed_at" IS 'Когда штраф снят (не учитывается в подсчёте за 30 дней)';
COMMENT ON COLUMN "strikes"."removal_reason" IS 'Причина снятия (ошибка системы, форс-мажор и т.д.)';

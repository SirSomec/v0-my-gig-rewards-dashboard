-- Лимиты штрафов за неделю и месяц для каждого уровня. При превышении любого — понижение на 1 уровень.
ALTER TABLE "levels"
  ADD COLUMN IF NOT EXISTS "strike_limit_per_week" integer,
  ADD COLUMN IF NOT EXISTS "strike_limit_per_month" integer;

COMMENT ON COLUMN "levels"."strike_limit_per_week" IS 'Макс. штрафов за текущую неделю; при превышении — понижение уровня (null = не учитывать)';
COMMENT ON COLUMN "levels"."strike_limit_per_month" IS 'Макс. штрафов за текущий месяц; при превышении — понижение уровня (null = не учитывать)';

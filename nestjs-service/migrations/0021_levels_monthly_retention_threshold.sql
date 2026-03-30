ALTER TABLE "levels"
  ADD COLUMN IF NOT EXISTS "monthly_shifts_required_to_keep" integer;

COMMENT ON COLUMN "levels"."monthly_shifts_required_to_keep"
  IS 'Минимум смен за календарный месяц (UTC) для сохранения уровня; null — удержание не требуется';

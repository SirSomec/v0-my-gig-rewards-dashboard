-- Настройки системы (ключ-значение): множитель бонусов за смену по умолчанию и др.
CREATE TABLE IF NOT EXISTS "system_settings" (
  "key" varchar(64) PRIMARY KEY,
  "value" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

COMMENT ON TABLE "system_settings" IS 'Настройки системы (множитель бонусов за смену по умолчанию и т.д.)';

-- Множитель бонусов за смену по умолчанию (монет за 1 час, округление вверх до часа)
INSERT INTO "system_settings" ("key", "value")
VALUES ('shift_bonus_default_multiplier', '10')
ON CONFLICT ("key") DO NOTHING;

-- Дополнительный множитель бонусов для каждого уровня лояльности (1 = без доп. множителя)
ALTER TABLE "levels"
  ADD COLUMN IF NOT EXISTS "bonus_multiplier" real NOT NULL DEFAULT 1;

COMMENT ON COLUMN "levels"."bonus_multiplier" IS 'Дополнительный множитель бонусов за смену для данного уровня (по умолчанию 1)';

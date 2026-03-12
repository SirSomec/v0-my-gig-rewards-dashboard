-- Рейтинг надёжности пользователя (0–5). По умолчанию 4. Увеличивается за выполненную смену, уменьшается за прогул/позднюю отмену.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "reliability_rating" real NOT NULL DEFAULT 4;

COMMENT ON COLUMN "users"."reliability_rating" IS 'Рейтинг надёжности 0–5. По умолчанию 4. Настраивается в system_settings: прирост за смену, снижение за прогул/позднюю отмену.';

-- Ограничение 0–5 (проверка при вставке/обновлении не добавляем — логика в приложении; при желании можно добавить CHECK).
UPDATE "users" SET "reliability_rating" = 4 WHERE "reliability_rating" IS NULL;

-- Настройки рейтинга в админке
INSERT INTO "system_settings" ("key", "value")
VALUES
  ('reliability_rating_increase_per_shift', '0.1'),
  ('reliability_rating_decrease_no_show', '0.2'),
  ('reliability_rating_decrease_late_cancel', '0.2')
ON CONFLICT ("key") DO NOTHING;

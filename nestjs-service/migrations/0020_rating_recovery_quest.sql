-- Квесты восстановления рейтинга: награда рейтингом, автоназначение при падении рейтинга
ALTER TABLE "quests"
  ADD COLUMN IF NOT EXISTS "reward_reliability_rating" real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "auto_assigned_rating_recovery" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "assigned_user_id" integer REFERENCES "users"("id") ON DELETE CASCADE;

COMMENT ON COLUMN "quests"."reward_reliability_rating" IS 'Прирост рейтинга надёжности при выполнении (0 = без прироста). Монеты задаются отдельно в reward_coins.';
COMMENT ON COLUMN "quests"."auto_assigned_rating_recovery" IS '1 = квест создан автоматически при падении рейтинга ниже порога.';
COMMENT ON COLUMN "quests"."assigned_user_id" IS 'Если задан — квест виден только этому пользователю (персональное назначение).';

INSERT INTO "system_settings" ("key", "value")
VALUES (
  'rating_recovery_quest_settings',
  '{"enabled":false,"assignBelowRating":3,"name":"Восстановление рейтинга","description":"Выполните условие, чтобы повысить рейтинг надёжности. Монеты не начисляются.","period":"monthly","conditionType":"shifts_count","conditionConfig":{"total":3},"rewardReliabilityRating":0.3,"icon":"target"}'::jsonb
)
ON CONFLICT ("key") DO NOTHING;

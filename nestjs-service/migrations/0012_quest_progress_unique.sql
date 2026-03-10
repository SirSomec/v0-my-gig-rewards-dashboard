-- Уникальность прогресса по квесту: один слот (user_id, quest_id, period_key) на пользователя за период.
-- Защищает от дубликатов при конкурентных запросах и гарантирует однократную выдачу награды за квест.
ALTER TABLE "quest_progress"
  ADD CONSTRAINT "quest_progress_user_quest_period_unique" UNIQUE ("user_id", "quest_id", "period_key");

-- Сидер квестов: ежедневные и еженедельные цели с условием shifts_count
INSERT INTO "quests" ("name", "description", "period", "condition_type", "condition_config", "reward_coins", "icon", "is_active", "target_type")
VALUES
  ('Ранняя пташка', 'Примите смену до 8 утра', 'daily', 'shifts_count', '{"total": 1}'::jsonb, 30, 'calendar', 1, 'all'),
  ('Первая смена дня', 'Завершите хотя бы одну смену', 'daily', 'shifts_count', '{"total": 1}'::jsonb, 25, 'streak', 1, 'all'),
  ('Цель недели', 'Завершите 5 смен за неделю', 'weekly', 'shifts_count', '{"total": 5}'::jsonb, 150, 'target', 1, 'all'),
  ('Серия смен', 'Завершите 3 смены подряд', 'weekly', 'shifts_count', '{"total": 3}'::jsonb, 100, 'streak', 1, 'all');

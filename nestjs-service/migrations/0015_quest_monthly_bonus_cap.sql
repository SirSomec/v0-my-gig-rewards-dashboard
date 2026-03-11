-- Порог бонусов за месяц: при достижении этого значения новые квесты не выдаются до конца месяца (уже назначенные остаются доступны). 0 = без ограничения.
INSERT INTO "system_settings" ("key", "value")
VALUES ('quest_monthly_bonus_cap', '0')
ON CONFLICT ("key") DO NOTHING;

-- Тестовый пользователь для dev-режима (id=1, уровень "Бронзовый новичок").
-- Используется при NEXT_PUBLIC_DEV_USER_ID=1 / DEV_USER_ID=1.
INSERT INTO "users" ("id", "name", "level_id", "balance", "shifts_completed")
SELECT 1, 'Тестовый пользователь', 1, 500, 0
WHERE NOT EXISTS (SELECT 1 FROM "users" WHERE "id" = 1);

-- Обновить sequence, чтобы следующий id был 2 (если только что вставили 1).
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT COALESCE(MAX(id), 1) FROM "users"));

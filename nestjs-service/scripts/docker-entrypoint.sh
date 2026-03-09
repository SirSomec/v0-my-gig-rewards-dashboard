#!/usr/bin/env sh
# При каждом запуске контейнера сначала применяются неприменённые миграции БД, затем стартует приложение.
# Требуются DATABASE_URL или PG_CONNECTION и MIGRATIONS_PATH (по умолчанию /app/migrations).
set -e
cd /app
if [ -n "$DATABASE_URL" ] || [ -n "$PG_CONNECTION" ]; then
  node dist/infra/db/drizzle/migrate.js
fi
exec node dist/main.js

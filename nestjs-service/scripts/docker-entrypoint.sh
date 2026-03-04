#!/usr/bin/env sh
# Запуск миграций БД, затем старт приложения (для контейнера API).
set -e
cd /app
if [ -n "$DATABASE_URL" ] || [ -n "$PG_CONNECTION" ]; then
  echo "==> Применение миграций..."
  node dist/infra/db/drizzle/migrate.js
fi
exec node dist/main.js

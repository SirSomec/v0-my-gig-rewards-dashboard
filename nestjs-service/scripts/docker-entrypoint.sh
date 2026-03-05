#!/usr/bin/env sh
# При каждом запуске контейнера API: применяются все неприменённые миграции БД, затем старт приложения.
set -e
cd /app

if [ -n "$DATABASE_URL" ] || [ -n "$PG_CONNECTION" ]; then
  echo "==> Применение миграций БД (при необходимости)..."
  node dist/infra/db/drizzle/migrate.js
  echo "==> Миграции применены."
else
  echo "==> DATABASE_URL и PG_CONNECTION не заданы — миграции пропущены."
fi

exec node dist/main.js

#!/usr/bin/env sh
# При каждом запуске контейнера сначала применяются неприменённые миграции БД, затем стартует приложение.
# Требуются DATABASE_URL или PG_CONNECTION и MIGRATIONS_PATH (по умолчанию /app/migrations).
# При недоступности БД миграции повторяются до ~30 с (ожидание готовности postgres после depends_on).
set -e
cd /app
if [ -n "$DATABASE_URL" ] || [ -n "$PG_CONNECTION" ]; then
  tries=0
  max_tries=10
  while [ "$tries" -lt "$max_tries" ]; do
    if node dist/infra/db/drizzle/migrate.js; then
      break
    fi
    tries=$((tries + 1))
    if [ "$tries" -eq "$max_tries" ]; then
      echo "Migrations failed after $max_tries attempts"
      exit 1
    fi
    echo "Migration attempt $tries failed, retrying in 3s..."
    sleep 3
  done
fi
exec node dist/main.js

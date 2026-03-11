#!/usr/bin/env sh
# При каждом запуске контейнера (деплой) сначала применяются неприменённые миграции БД, затем стартует приложение.
# Требуются DATABASE_URL или PG_CONNECTION. MIGRATIONS_PATH по умолчанию /app/migrations.
# При недоступности БД миграции повторяются до ~30 с (ожидание готовности postgres после depends_on).
set -e
cd /app
if [ -n "$DATABASE_URL" ] || [ -n "$PG_CONNECTION" ]; then
  tries=0
  max_tries=10
  while [ "$tries" -lt "$max_tries" ]; do
    if node dist/infra/db/drizzle/migrate.js; then
      echo "Migrations applied successfully."
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
else
  echo "Skipping migrations: DATABASE_URL or PG_CONNECTION not set."
fi
exec node dist/main.js

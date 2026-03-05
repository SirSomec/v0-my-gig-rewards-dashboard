#!/usr/bin/env sh
# При каждом запуске контейнера API стартует приложение; миграции БД применяются автоматически в main.js при наличии DATABASE_URL или PG_CONNECTION.
set -e
cd /app
exec node dist/main.js

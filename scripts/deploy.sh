#!/usr/bin/env bash
# Деплой/обновление на сервере: синхронизация кода, сборка образов, перезапуск контейнеров.
# Запускать из корня проекта: ./scripts/deploy.sh

set -e
cd "$(dirname "$0")/.."

echo "==> Синхронизация изменений..."
if [ -d .git ]; then
  git pull
else
  echo "    (не Git-репозиторий — пропуск git pull)"
fi

echo "==> Сборка образов..."
docker compose build

echo "==> Перезапуск контейнеров..."
docker compose up -d

echo "==> Готово. Проверка: docker compose ps"

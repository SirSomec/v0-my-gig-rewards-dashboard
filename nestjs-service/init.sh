#!/usr/bin/env bash
set -e

show_help() {
  cat <<EOF
Использование: $(basename "$0") --name|-n <имя> [--description|-d <описание>]

Параметры:
  --name, -n <имя>          (обязательный) имя, на которое нужно заменить все вхождения <SERVICE_NAME> и <SERVICE_SLUG>
  --description, -d <текст> (опциональный) описание, заменяет все вхождения <SERVICE_DESCRIPTION>
  --help, -h                Показать это сообщение

Пример:
  $(basename "$0") --name "My Service" --description "Мой тестовый сервис"
  $(basename "$0") -n "My Service" -d "Мой тестовый сервис"
EOF
}

NAME=""
DESCRIPTION=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      show_help
      exit 0
      ;;
    -n|--name)
      shift
      if [[ -z "$1" || "$1" == --* ]]; then
        echo "Ошибка: после --name/-n требуется значение"
        exit 1
      fi
      NAME="$1"
      shift
      ;;
    -d|--description)
      shift
      if [[ -z "$1" || "$1" == --* ]]; then
        echo "Ошибка: после --description/-d требуется значение"
        exit 1
      fi
      DESCRIPTION="$1"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -z "$NAME" ]]; then
  echo "Ошибка: параметр --name или -n обязателен"
  exit 1
fi

FUNCTION_SLUG=$(echo "$NAME" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[[:space:]]+/-/g')

echo "Имя функции: $NAME"
echo "Slug: $FUNCTION_SLUG"
if [[ -n "$DESCRIPTION" ]]; then
  echo "Описание: $DESCRIPTION"
fi
read -p "Продолжить? (y/N): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Операция отменена"
  exit 0
fi

find . -type f ! -name "$(basename "$0")" ! -name "README.md" -print0 | while IFS= read -r -d '' file; do
  sed -i "s/<SERVICE_NAME>/$NAME/g" "$file"
  sed -i "s/<SERVICE_SLUG>/$FUNCTION_SLUG/g" "$file"
  sed -i "s/<SERVICE_DESCRIPTION>/$DESCRIPTION/g" "$file"
done

echo "Инициализация завершена"

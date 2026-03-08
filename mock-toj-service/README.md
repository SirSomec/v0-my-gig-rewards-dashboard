# Мок TOJ (Terms of Job) — смены

Отдельный сервис, эмулирующий API TOJ (Jobs) для разработки без доступа к spellbook-qa.

## Запуск

- **В Docker:** из корня проекта `docker-compose up mock-toj`. Порт 3010.
- **Локально:** `npm install && npm start`. По умолчанию порт 3010 (или `PORT` в env).

## Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `PORT` | Порт сервера | 3010 |
| `MOCK_TOJ_USER` | Basic Auth (логин) для эндпоинтов TOJ | mock |
| `MOCK_TOJ_PASSWORD` | Basic Auth (пароль) | mock |
| `MOCK_TOJ_ADMIN_KEY` | Ключ для `POST /admin/generate-jobs` (X-Admin-Key) | mock-admin-key |

## Эндпоинты

- **TOJ (Basic Auth):**  
  `POST /job.find-many.query`, `POST /job.count.query`, `POST /job.find-by-id.query` — формат по [TOJ-API.md](../docs/TOJ-API.md).
- **Генерация (X-Admin-Key):**  
  `POST /admin/generate-jobs` — тело: `{ count, workerIds[], dateFrom?, dateTo? }`. Заменяет текущий список смен сгенерированными.
- **Создать одну забронированную смену (X-Admin-Key):**  
  `POST /admin/create-booked-job` — тело: `{ workerId, start, finish?, customName?, spec?, clientId?, hours? }`. Добавляет одну смену со статусом `booked`. `start` — ISO date-time начала смены; дата бронирования фиксируется на стороне rewards при синхронизации.
- **Просмотр смен (X-Admin-Key):**  
  `GET /admin/jobs?limit=&skip=` — возвращает `{ data: { items, total } }` (текущий список смен в памяти).
- **Смена статуса смены с инициатором (X-Admin-Key):**  
  `PATCH /admin/jobs/:id` — тело: `{ status, initiatorType?, initiator? }`. Меняет статус смены (например на `cancelled`), записывает на смену `statusChangeMeta: { initiatorType, initiator, at }` (как `meta` в TOJ `job.update.command`). Для теста штрафа «поздняя отмена»: переведите смену в `cancelled` с `initiatorType: "worker"`, затем вызовите `POST /v1/admin/toj/process-late-cancel` с `jobId`, `workerId`, `jobStart`, `cancelledAt` (можно взять `statusChangeMeta.at` или `updatedAt` смены), `initiatorType: "worker"`.
- **Health:**  
  `GET /health` — без авторизации, возвращает `{ status: "ok", jobsCount: N }`.

## Подключение бэкенда

В env приложения api задайте:

- `MOCK_TOJ_URL` — URL мока (в Docker: `http://mock-toj:3010`, локально: `http://localhost:3010`).
- `MOCK_TOJ_ADMIN_KEY` — тот же ключ, что и `MOCK_TOJ_ADMIN_KEY` в контейнере мока.

Генерация из админки вызывается через api: `POST /v1/admin/mock-toj/generate` с телом `{ userId, count?, dateFrom?, dateTo? }`.

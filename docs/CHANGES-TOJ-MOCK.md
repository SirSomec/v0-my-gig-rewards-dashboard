# Внесённые изменения: мок TOJ и синхронизация смен

Краткий обзор изменений в проекте, связанных с моковым сервисом TOJ и синхронизацией смен из TOJ.

---

## Документация

| Файл | Описание |
|------|----------|
| [TOJ-API.md](./TOJ-API.md) | Описание TOJ API (Jobs): эндпоинты, запросы/ответы, фильтры, сущность Job. |
| [MOCK-SERVICE-PLAN.md](./MOCK-SERVICE-PLAN.md) | План мокового сервиса; раздел «Реализовано» — мок TOJ, админка, генерация и просмотр смен, синхронизация. |
| [TOJ-SYNC-PLAN.md](./TOJ-SYNC-PLAN.md) | План синхронизации смен из TOJ; раздел «Реализовано» — watermark, батчи, идемпотентность, админ API и UI. |

---

## Мок TOJ (mock-toj-service)

- **Папка:** `mock-toj-service/` — отдельный Express-сервис, порт 3010.
- **Эндпоинты TOJ:** `POST /job.find-many.query`, `POST /job.count.query`, `POST /job.find-by-id.query` (Basic Auth).
- **Админ мока:** `POST /admin/generate-jobs` (X-Admin-Key), `GET /admin/jobs` — генерация и просмотр смен в памяти.
- **Docker:** сервис `mock-toj` в `docker-compose.yml`; для `api` заданы `MOCK_TOJ_URL`, `MOCK_TOJ_ADMIN_KEY`.
- **Env:** `MOCK_TOJ_*`, см. `.env.example` и [mock-toj-service/README.md](../mock-toj-service/README.md).

---

## Бэкенд (nestjs-service)

- **RewardsService:** `recordShiftCompleted(..., sourceRef?: string)` — опциональный `sourceRef`; идемпотентность по `source_ref` (если уже есть транзакция с таким `source_ref`, возвращается её id); при создании транзакции записывается `source_ref`.
- **TojModule** (`modules/toj/`):
  - **TojClientService** — вызов TOJ API (findJobs с Basic Auth, пагинация, фильтры).
  - **TojSyncService** — watermark в `system_settings` (`toj_sync_last_updated_at`), батчи по workerIds, лимит смен за прогон, пропуск смен до даты регистрации пользователя, вызов `recordShiftCompleted` с `sourceRef: job._id`.
- **AdminModule:** импорт TojModule; эндпоинты:
  - Мок TOJ: `GET /v1/admin/mock-toj/status`, `GET /v1/admin/mock-toj/jobs`, `POST /v1/admin/mock-toj/generate`.
  - Синхронизация: `GET /v1/admin/toj-sync/status`, `POST /v1/admin/toj-sync/run`.
- **Env:** в схеме валидации добавлены `TOJ_*`, `TOJ_SYNC_*`; см. `.env.example`.

---

## Фронтенд (Next.js)

- **lib/admin-api.ts:** функции для мока TOJ (status, list jobs, generate) и синхронизации (tojSyncStatus, tojSyncRun); типы `MockTojJob` и ответы статуса/результата.
- **app/admin/layout.tsx:** пункт навигации «Мок TOJ (смены)».
- **app/admin/mock-toj/page.tsx:** страница админки: выбор пользователя и форма генерации смен; таблица «Сгенерированные смены» (обновление по кнопке); блок «Синхронизация смен из TOJ» — статус, кнопка «Синхронизировать смены», вывод результата (processed/skipped/errors).

---

## Конфигурация

- **docker-compose.yml:** сервис `mock-toj`; в `api` передаются переменные `MOCK_TOJ_*` и `TOJ_*` / `TOJ_SYNC_*`.
- **.env.example:** комментарии и примеры для `MOCK_TOJ_*`, `TOJ_BASE_URL`, `TOJ_USER`, `TOJ_PASSWORD`, `TOJ_SYNC_*`.

---

## Итог

- Мок TOJ позволяет разрабатывать и тестировать синхронизацию без реального TOJ.
- Синхронизация смен из TOJ (реального или мокового) выполняется вручную из админки; идемпотентность и ограничение нагрузки (watermark, батчи, лимит за прогон) реализованы по плану.

# Документация API микросервиса TOJ (Terms of Job)

**Версия:** 1.0  
**Спецификация:** OpenAPI 3.0  
**Описание:** API для работы с шаблонами смен, заказами и сменами (jobs).

---

## Общие сведения

- **Аутентификация:** HTTP Basic Auth (`securitySchemes.basic`).
- **Базовый URL:** в спеке не задан (`servers: []`). Для тестовой среды используется хост из Swagger UI, например: `https://spellbook-qa.mygig.ru/api/toj` (уточнить у команды).
- **Content-Type запросов:** `application/json`.
- **Ответы:** тело ответа — JSON. У большинства методов обёртка вида `{ "data": ..., "error": ... }`.

---

## 1. Jobs (смены)

Основной блок для интеграции по данным о сменах.

### 1.1 Получить список смен — `JobController_findMany`

- **Метод и путь:** `POST /job.find-many.query`
- **Назначение:** поиск смен с фильтрами, пагинацией и сортировкой.

**Тело запроса (JobFindManyRequest):**

```json
{
  "data": {
    "filters": {},
    "projection": "строка полей через пробел или пустая строка",
    "options": {
      "limit": 100,
      "skip": 0,
      "sort": { "поле": 1 }
    }
  }
}
```

**Фильтры (JobFindManyFilters):** все поля опциональны.

| Поле | Тип | Описание |
|------|-----|----------|
| `ids` | string[] | ID смен |
| `workerIds` | string[] | ID работников |
| `clientIds` | string[] | ID клиентов |
| `workplaceIds` | string[] | ID рабочих мест |
| `sources` | string[] | Источники |
| `extSources` | string[] | Внешние источники |
| `statuses` | string[] | Статусы смен |
| `start` | string[] | Диапазон дат начала (например, `["gte:ISO8601", "lte:ISO8601"]`) |
| `finish` | string[] | Диапазон дат окончания |
| `isManualConfirmOnly` | boolean | Только с ручным подтверждением |
| `legalTypes` | ("self_employed" \| "civil_law_agreement")[] | Тип занятости |
| `deleted` | object | Фильтр по удалённым |
| `receiptStatuses` | string[] | Статусы чека |
| `updatedAt` | string[] | Диапазон дат обновления |

**Ответ 200:** `JobEntitiesOptionalWrapper`

```json
{
  "data": [],
  "error": null
}
```

При ошибке: `data` может быть `null`, в `error` — строка или `{ "message": "..." }`.

**Основные поля смены (JobEntityOptional):**

| Поле | Тип | Описание |
|------|-----|----------|
| `_id` | ObjectId | ID смены |
| `status` | string | Статус |
| `workerId` | string | ID работника |
| `employerId`, `clientId`, `workplaceId`, `coordinatorId` | string | Ссылки на сущности |
| `spec`, `customName`, `description`, `department` | string | Описание смены |
| `start`, `finish` | string | Плановые начало/конец |
| `startFact`, `finishFact` | string (date-time) | Фактические начало/конец |
| `startTime`, `finishTime` | string | Время начала/окончания |
| `hours`, `minutes` | number | Длительность |
| `salaryPerHour`, `salaryPerJob`, `salaryPerUnit` | number | Зарплата |
| `paymentPerHour`, `paymentPerJob`, `paymentPerUnit` | number | Выплата |
| `units` | number | Единицы (для сдельных) |
| `monetaryPenalty`, `penalties` | number, Penalty[] | Штрафы |
| `receipt`, `receiptStatus`, `receiptDate`, `receiptId` | string | Чек |
| `deleted`, `deletedAt` | boolean, string | Удаление |
| `createdAt`, `updatedAt` | string | Системные даты |

**Возможные статусы смены (JobStatuses):** `doccheck`, `booked`, `going`, `inprogress`, `completed`, `confirmed`, `checkingin`, `checkingout`, `delayed`, `waiting`, `cancelled`, `failed`, `toolate`, `expired`.

---

### 1.2 Подсчёт смен — `JobController_count`

- **Метод и путь:** `POST /job.count.query`
- **Тело:** `{ "data": { "filters": { /* те же JobFindManyFilters */ } } }`
- **Ответ 200:** `{ "data": { "total": number }, "error": null }`

---

### 1.3 Смена по ID — `JobController_findById`

- **Метод и путь:** `POST /job.find-by-id.query`
- **Тело:** `{ "data": { "id": "<jobId>", "projection": "", "options": { "limit", "skip", "sort" } } }`
- **Ответ 200:** `{ "data": JobEntityOptional, "error": null }`

---

### 1.4 Остальные методы Jobs

| Метод | Путь | Краткое описание |
|-------|------|------------------|
| POST | `/job.create.command` | JobController_create — Создать смены |
| POST | `/job.update.command` | JobController_update — Обновить смены |
| POST | `/job.cancel.command` | JobController_cancel — Отменить смены (`ids`, `reason`) |
| POST | `/job.confirm.command` | JobController_confirm — Подтвердить смены |
| POST | `/job.fail.command` | JobController_fail — Отметить смены как failed |
| POST | `/job.going.command` | JobController_going — Перевести смену в статус «going» |
| POST | `/job.distinct.query` | JobController_distinct — Уникальные значения поля по фильтрам |
| POST | `/job.can-change-status.query` | JobController_canChangeStatus — Проверка возможности смены статуса |
| POST | `/job.status-transition-matrix.query` | JobController_statusTransitionMatrix — Матрица переходов статусов |

Все перечисленные методы с `security: basic` требуют Basic Auth.

---

## 2. Orders (заказы)

Заказы связаны со сменами (у смены есть контекст заказа).

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/order.pre-create.query` | Предварительное создание (валидация) |
| POST | `/order.create.command` | Создание заказов |
| POST | `/order.copy.command` | Копирование заказов |
| POST | `/order.count.query` | Подсчёт заказов |
| POST | `/order.find-many.query` | Поиск заказов (фильтры: OrderFindManyFilters) |
| POST | `/order.update.command` | Обновление заказов |
| POST | `/order.hide.command` | Скрытие заказов |
| POST | `/order.show.command` | Показ заказов |
| POST | `/order.delete.command` | Удаление заказов |
| POST | `/order.restore.command` | Восстановление заказов |

Формат запросов: `{ "data": ..., "meta": { "initiatorType", "initiator"? } }`. Ответы — обёртки `{ "data", "error" }`.

---

## 3. Templates (шаблоны)

Шаблоны смен/заказов.

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/template.pre-create.query` | Предварительное создание |
| POST | `/template.create.command` | Создание шаблонов |
| POST | `/template.update.command` | Обновление шаблонов |
| POST | `/template.count.query` | Подсчёт |
| POST | `/template.distinct.query` | Уникальные значения поля |
| POST | `/template.find-many.query` | Поиск шаблонов |
| POST | `/template.find-by-id.query` | Шаблон по ID |
| POST | `/template.history.query` | История шаблона по ID |
| POST | `/template.delete.command` | Удаление |
| POST | `/template.migrate.command` | Миграция (201 без тела) |

Структура запросов/ответов аналогична: `data` + при необходимости `meta`, ответы в виде `{ "data", "error" }`.

---

## 4. Healthcheck

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/healthcheck/liveness` | Liveness |
| GET | `/healthcheck/readiness` | Readiness |

Без авторизации в спеке.

---

## 5. Рекомендации для интеграции по сменам

1. **Чтение смен:** использовать `POST /job.find-many.query` с нужными `filters` и `options` (limit/skip/sort). При большом объёме — пагинация через `skip`/`limit`.
2. **Подсчёт:** перед выгрузкой или для проверки использовать `POST /job.count.query` с теми же `filters`.
3. **Авторизация:** передавать HTTP Basic Auth во все запросы к эндпоинтам Jobs/Orders/Templates.
4. **Базовый URL и окружение:** уточнить у команды точный base URL и параметр `environment` (например, `test03`) для тестовой среды.
5. **Ошибки:** всегда проверять `error` в ответе; при `error !== null` не полагаться на `data`.

---

## Ссылки

- Swagger UI (QA): `https://spellbook-qa.mygig.ru/api/swagger/toj/?environment=test03`
- Раздел Jobs в Swagger: `#/Jobs/JobController_findMany`

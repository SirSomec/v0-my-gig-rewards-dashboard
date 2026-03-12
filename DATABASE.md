# База данных — MyGig Rewards Dashboard

Документ описывает текущую структуру БД: таблицы, столбцы, связи и назначение данных. СУБД: **PostgreSQL**. ORM: **Drizzle**.

---

## Диаграмма зависимостей (ER)

```mermaid
erDiagram
    levels ||--o{ users : "level_id"
    users ||--o{ transactions : "user_id"
    users ||--o{ quest_progress : "user_id"
    users ||--o{ redemptions : "user_id"
    users ||--o{ strikes : "user_id"
    quests ||--o{ quest_progress : "quest_id"
    store_items ||--o{ redemptions : "store_item_id"
    audit_log }o--|| users : "admin_id (опционально)"

    levels {
        int id PK
        varchar name
        int shifts_required
        int strike_threshold
        int strike_limit_per_week
        int strike_limit_per_month
        jsonb perks
        int sort_order
        timestamps
    }

    users {
        int id PK
        varchar external_id
        varchar name
        varchar email
        varchar avatar_url
        int balance
        int level_id FK
        int shifts_completed
        real reliability_rating
        timestamps
    }

    quests {
        int id PK
        varchar name
        varchar description
        varchar period
        varchar condition_type
        jsonb condition_config
        int reward_coins
        varchar icon
        int is_active
        int is_one_time
        timestamp active_from
        timestamp active_until
        varchar target_type
        int target_group_id
        timestamps
    }

    quest_progress {
        int id PK
        int user_id FK
        int quest_id FK
        varchar period_key
        int progress
        timestamp completed_at
        timestamps
    }

    transactions {
        int id PK
        int user_id FK
        int amount
        varchar type
        varchar source_ref
        varchar title
        varchar description
        varchar location
        varchar client_id
        varchar category
        real hours
        int created_by
        timestamps
    }

    store_items {
        int id PK
        varchar name
        varchar description
        varchar category
        int cost
        varchar icon
        int stock_limit
        timestamp visible_from
        timestamp visible_until
        int is_active
        int sort_order
        jsonb visibility_rules
        timestamps
    }

    redemptions {
        int id PK
        int user_id FK
        int store_item_id FK
        varchar status
        int coins_spent
        timestamp processed_at
        int processed_by
        varchar notes
        timestamp created_at
    }

    strikes {
        int id PK
        int user_id FK
        varchar type
        varchar shift_external_id
        timestamp occurred_at
        timestamp created_at
        timestamp removed_at
        varchar removal_reason
    }

    audit_log {
        int id PK
        int admin_id
        varchar action
        varchar entity_type
        varchar entity_id
        jsonb old_values
        jsonb new_values
        timestamps
    }
```

---

## Общие поля (миксин)

Во всех основных таблицах используются общие временные метки из `base.schema`:

| Поле        | Тип        | Описание                          |
|------------|------------|-----------------------------------|
| `created_at` | timestamp | Время создания записи             |
| `updated_at` | timestamp | Время последнего обновления       |
| `deleted_at` | timestamp | Мягкое удаление (если используется) |

---

## Таблицы и столбцы

### 1. `levels` — уровни пользователей

Хранит уровни геймификации: название, требования по сменам и штрафам, бонусы.

| Столбец               | Тип     | Описание |
|-----------------------|---------|----------|
| `id`                  | int PK  | Идентификатор уровня |
| `name`                | varchar(128) | Название уровня |
| `shifts_required`     | int     | Порог смен **для перехода на этот уровень**. У **базового уровня** (минимальный sort_order) должен быть **0** — выдаётся изначально без условий; в админке при редактировании базового уровня нельзя сохранить значение > 0. |
| `strike_threshold`    | int     | Устаревшее: макс. штрафов за 30 дней (оставлено для совместимости) |
| `strike_limit_per_week`  | int | Не используется: ранее макс. штрафов за неделю; логика заменена на рейтинг надёжности (`users.reliability_rating`). Оставлено в схеме. |
| `strike_limit_per_month` | int | Не используется: ранее макс. штрафов за месяц; логика заменена на рейтинг надёжности. Оставлено в схеме. |
| `perks`               | jsonb   | Массив бонусов: `[{ title, description? }]` |
| `sort_order`          | int     | Порядок отображения (по умолчанию 0) |
| `bonus_multiplier`    | real    | Дополнительный множитель бонусов за смену для уровня (по умолчанию 1) |
| `created_at`, `updated_at`, `deleted_at` | timestamp | Общие метки времени |

**Связи:** один уровень — много пользователей (`users.level_id` → `levels.id`).

---

### 2. `users` — пользователи

Профили сотрудников: баланс монет, уровень, смены, привязка к внешней системе.

| Столбец           | Тип     | Описание |
|-------------------|---------|----------|
| `id`              | int PK  | Внутренний идентификатор |
| `external_id`     | varchar(256) | ID во внешней системе (интеграция) |
| `name`            | varchar(256) | Имя пользователя |
| `email`           | varchar(256) | Email |
| `avatar_url`      | varchar(512) | URL аватара |
| `balance`         | int     | Текущий баланс монет (по умолчанию 0) |
| `level_id`        | int FK  | Ссылка на `levels.id` — текущий уровень |
| `shifts_completed`| int     | Количество завершённых смен (по умолчанию 0). **При смене уровня** (повышение, ручное в админке) **обнуляется**. |
| `reliability_rating` | real | **Рейтинг надёжности** 0–5 (дробное). По умолчанию 4. Увеличивается за выполненную смену (настройка в `system_settings`), уменьшается за прогул и позднюю отмену (отдельные настройки). При снятии штрафа — восстановление на величину снижения. Используется при решении, засчитывать ли смену в прогресс уровня и можно ли автоматически повысить уровень. |
| `created_at`, `updated_at`, `deleted_at` | timestamp | Общие метки времени |

**Связи:**
- многие к одному: `level_id` → `levels.id`;
- один ко многим: `transactions`, `quest_progress`, `redemptions`, `strikes` ссылаются на `users.id`.

---

### 3. `quests` — квесты

Шаблоны заданий: условия, награда монетами, период (ежедневно/еженедельно/ежемесячно), даты активности.

| Столбец           | Тип     | Описание |
|-------------------|---------|----------|
| `id`              | int PK  | Идентификатор квеста |
| `name`            | varchar(256) | Название квеста |
| `description`     | varchar(512) | Описание |
| `period`          | varchar(16) | Период: `daily` \| `weekly` \| `monthly` |
| `condition_type`  | varchar(64) | Тип условия (логика проверки на бэкенде) |
| `condition_config`| jsonb   | Конфиг условия (параметры под тип) |
| `reward_coins`    | int     | Награда в монетах за выполнение |
| `icon`            | varchar(32) | Иконка (по умолчанию `target`) |
| `is_active`       | int     | Активен ли квест (1 = да) |
| `is_one_time`     | int     | Единоразовый: выполнить можно только один раз (0/1) |
| `active_from`     | timestamp | Показывать и учитывать только с этой даты (UTC) |
| `active_until`    | timestamp | После этой даты не показывать |
| `target_type`     | varchar(16) | Кому доступен: `all` \| `group` |
| `target_group_id` | int     | ID группы, если `target_type = group` |
| `created_at`, `updated_at`, `deleted_at` | timestamp | Общие метки времени |

**Связи:** один ко многим с `quest_progress` по `quest_id`.

---

### 4. `quest_progress` — прогресс по квестам

Прогресс пользователя по каждому квесту в рамках периода (день/неделя/месяц) или разового квеста.

| Столбец       | Тип     | Описание |
|---------------|---------|----------|
| `id`          | int PK  | Идентификатор записи прогресса |
| `user_id`     | int FK  | Ссылка на `users.id` (CASCADE при удалении пользователя) |
| `quest_id`    | int FK  | Ссылка на `quests.id` (CASCADE при удалении квеста) |
| `period_key`  | varchar(32) | Ключ периода: `YYYY-MM-DD` (daily/weekly), `YYYY-MM` (monthly), `once` (one-time) |
| `progress`    | int     | Текущее значение прогресса (по умолчанию 0) |
| `completed_at`| timestamp | Время завершения квеста |
| `created_at`, `updated_at` | timestamp | Время создания и обновления (без `deleted_at`) |

**Связи:**
- многие к одному: `user_id` → `users.id`, `quest_id` → `quests.id`.

---

### 5. `transactions` — транзакции монет

История начислений и списаний монет: смены, бонусы, квесты, ручные операции, списания за выкуп.

| Столбец       | Тип     | Описание |
|---------------|---------|----------|
| `id`          | int PK  | Идентификатор транзакции |
| `user_id`     | int FK  | Ссылка на `users.id` (CASCADE) |
| `amount`      | int     | Сумма: положительная — начисление, отрицательная — списание |
| `type`        | varchar(32) | Тип: `shift` \| `bonus` \| `quest` \| `manual_credit` \| `manual_debit` \| `redemption` |
| `source_ref`  | varchar(256) | Внешняя ссылка (ID смены, квеста и т.д.) |
| `title`       | varchar(256) | Заголовок операции |
| `description` | varchar(512) | Описание |
| `location`    | varchar(256) | Локация/место (при необходимости) |
| `client_id`   | varchar(128) | ID или код бренда/клиента (для квестов по сменам в клиенте) |
| `category`    | varchar(128) | Категория/профессия смены (для квестов по категории) |
| `hours`       | real    | Часы в смене (для квестов по часам) |
| `created_by`  | int     | Для ручных операций — ID админа |
| `created_at`, `updated_at`, `deleted_at` | timestamp | Общие метки времени |

**Связи:** многие к одному: `user_id` → `users.id`. Баланс пользователя можно вывести как сумму `amount` по его транзакциям (или хранить денормализованно в `users.balance`).

---

### 6. `store_items` — товары в магазине

Каталог товаров/наград: название, категория, стоимость в монетах, лимит остатка, видимость.

| Столбец         | Тип     | Описание |
|-----------------|---------|----------|
| `id`            | int PK  | Идентификатор товара |
| `name`          | varchar(256) | Название |
| `description`   | varchar(1024) | Описание |
| `category`      | varchar(64) | Категория товара |
| `cost`          | int     | Стоимость в монетах |
| `icon`          | varchar(64) | Иконка (по умолчанию `gift`) |
| `stock_limit`   | int     | Лимит остатка (null = без лимита) |
| `visible_from`  | timestamp | Показывать с этой даты |
| `visible_until` | timestamp | Показывать до этой даты |
| `is_active`     | int     | Активен ли товар (1 = да) |
| `sort_order`    | int     | Порядок отображения |
| `visibility_rules` | jsonb | Доп. правила видимости (гибкая настройка) |
| `created_at`, `updated_at`, `deleted_at` | timestamp | Общие метки времени |

**Связи:** один ко многим с `redemptions` по `store_item_id`.

---

### 7. `redemptions` — выкупы (обмен монет на товар)

Заявки на обмен монет на товар из магазина: статус, сумма, кто обработал.

| Столбец          | Тип     | Описание |
|------------------|---------|----------|
| `id`             | int PK  | Идентификатор выкупа |
| `user_id`        | int FK  | Ссылка на `users.id` (CASCADE) |
| `store_item_id`  | int FK  | Ссылка на `store_items.id` — какой товар выбран |
| `status`         | varchar(32) | Статус: `pending` \| `fulfilled` \| `cancelled` |
| `coins_spent`    | int     | Списано монет |
| `processed_at`   | timestamp | Когда обработан выкуп |
| `processed_by`   | int     | ID обработавшего (админ) |
| `notes`          | varchar(512) | Заметки |
| `created_at`     | timestamp | Время создания (без `updated_at`/`deleted_at` в схеме) |

**Связи:**
- многие к одному: `user_id` → `users.id`, `store_item_id` → `store_items.id`.  
При создании выкупа обычно создаётся транзакция `type = redemption` и списывается баланс у пользователя.

---

### 8. `strikes` — штрафы

Штрафы за no-show, позднюю отмену и т.п. Запись в strikes ведётся для истории и для **снижения рейтинга надёжности** пользователя (`users.reliability_rating`). Величины снижения задаются в `system_settings` (отдельно для прогула и для поздней отмены). При снятии штрафа рейтинг восстанавливается.

| Столбец            | Тип     | Описание |
|--------------------|---------|----------|
| `id`               | int PK  | Идентификатор штрафа |
| `user_id`          | int FK  | Ссылка на `users.id` (CASCADE) |
| `type`             | varchar(32) | Тип: `no_show` \| `late_cancel` |
| `shift_external_id`| varchar(256) | Внешний ID смены (интеграция) |
| `occurred_at`      | timestamp | Когда произошёл инцидент |
| `created_at`       | timestamp | Когда запись создана |
| `removed_at`       | timestamp | Когда штраф снят (рейтинг при снятии восстанавливается) |
| `removal_reason`   | varchar(512) | Причина снятия |

**Связи:** многие к одному: `user_id` → `users.id`. Подсчёт активных штрафов за 30 дней (для отображения в админке) — по `occurred_at` с учётом `removed_at IS NULL`.

---

### 9. `audit_log` — журнал аудита

Лог действий админов: что изменено, по какой сущности, старые и новые значения.

| Столбец       | Тип     | Описание |
|---------------|---------|----------|
| `id`          | int PK  | Идентификатор записи |
| `admin_id`    | int     | ID администратора (опционально, ссылка на пользователя/админа) |
| `action`      | varchar(64) | Код действия (например, `user.balance.update`) |
| `entity_type` | varchar(64) | Тип сущности (например, `user`, `quest`) |
| `entity_id`   | varchar(128) | ID сущности (строка для гибкости) |
| `old_values`  | jsonb   | Старые значения (снимок до изменения) |
| `new_values`  | jsonb   | Новые значения (снимок после изменения) |
| `created_at`, `updated_at`, `deleted_at` | timestamp | Общие метки времени |

**Связи:** логическая связь с пользователем-админом по `admin_id` (в схеме FK может не быть). Остальные таблицы не ссылаются на `audit_log`.

---

### 10. `system_settings` — настройки системы

Ключ-значение настроек, редактируемых в админ-панели (например, множитель бонусов за смену по умолчанию).

| Столбец       | Тип     | Описание |
|---------------|---------|----------|
| `key`         | varchar(64) PK | Ключ настройки (например, `shift_bonus_default_multiplier`) |
| `value`       | jsonb   | Значение (число, строка, объект) |
| `created_at`, `updated_at`, `deleted_at` | timestamp | Общие метки времени |

**Назначение:** ключ `shift_bonus_default_multiplier` — множитель по умолчанию (монет за 1 час смены). Ключи **рейтинга надёжности**: `reliability_rating_increase_per_shift` (прирост за смену), `reliability_rating_decrease_no_show` (снижение за прогул), `reliability_rating_decrease_late_cancel` (снижение за позднюю отмену). Итоговый бонус за смену = ceil(часы) × множитель по умолчанию × множитель уровня лояльности (`levels.bonus_multiplier`).

---

## Сводка связей

| Таблица         | Зависит от                    | От неё зависят                          |
|-----------------|-------------------------------|-----------------------------------------|
| `levels`        | —                             | `users`                                 |
| `users`         | `levels`                      | `transactions`, `quest_progress`, `redemptions`, `strikes` |
| `quests`        | —                             | `quest_progress`                        |
| `quest_progress`| `users`, `quests`             | —                                       |
| `transactions`  | `users`                       | —                                       |
| `store_items`   | —                             | `redemptions`                           |
| `redemptions`   | `users`, `store_items`        | —                                       |
| `strikes`       | `users`                       | —                                       |
| `audit_log`     | — (опционально `admin_id`)    | —                                       |
| `system_settings` | —                            | —                                       |

---

## Назначение данных по доменам

- **Пользователи и уровни:** `users` + `levels` — профиль, баланс, уровень, смены; уровень задаёт требования и лимиты штрафов.
- **Квесты:** `quests` — шаблоны заданий; `quest_progress` — прогресс по квестам в периоде; награды квестов попадают в `transactions` с `type = quest`.
- **Монеты:** `transactions` — полная история движений монет; `users.balance` — текущий баланс (денормализация для быстрого доступа).
- **Магазин:** `store_items` — каталог; `redemptions` — заявки на обмен; списание при выкупе — транзакция `type = redemption`.
- **Дисциплина:** `strikes` — штрафы (история и привязка к смене); при регистрации штрафа снижается `users.reliability_rating`; при снятии штрафа рейтинг восстанавливается. Настройки рейтинга в `system_settings`.
- **Аудит:** `audit_log` — кто, когда и что изменил по сущностям системы.
- **Настройки:** `system_settings` — множитель бонусов за смену по умолчанию; для каждого уровня в `levels.bonus_multiplier` задаётся дополнительный множитель бонусов.

Файлы схем Drizzle: `nestjs-service/src/infra/db/drizzle/schemas/*.schema.ts`.

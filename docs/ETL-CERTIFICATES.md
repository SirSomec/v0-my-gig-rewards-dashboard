# Сертификаты Yandex Cloud для подключения к ETL (MVP)

Подключение к ETL на этапе MVP требует доверия к корневым и промежуточным CA сертификатам Yandex Cloud. Ниже — как их установить/использовать на **Windows** (локальная разработка) и на **Linux** (сервер/CI).

## Учётные данные ETL (env)

В проекте **все переменные окружения задаются в одном файле `.env` в корне репозитория** (рядом с `docker-compose.yml`). В нём задают и переменные ETL, и остальную конфигурацию. Контейнеры (app, api и др.) подхватывают их через `env_file: .env`; контейнер api дополнительно монтирует этот файл в `/app/.env`. Подробнее см. **ARCHITECTURE.md** (раздел «Конфигурация: один .env в корне») и **DEPLOY.md**.

Источник ETL может быть **ClickHouse** (порт 8443, HTTPS API) или **PostgreSQL** (порты 5432/6432). Тип определяется по `ETL_PORT`: при 8443 используется HTTP-интерфейс ClickHouse с заголовками `X-ClickHouse-User` и `X-ClickHouse-Key`, иначе — подключение по протоколу PostgreSQL.

Подключение задаётся переменными окружения бэкенда:

| Переменная | Описание |
|------------|----------|
| `ETL_HOST` | Хост ETL (или БД источника) |
| `ETL_PORT` | Порт: **8443** для ClickHouse (HTTPS API, Yandex Cloud), **5432** или **6432** для PostgreSQL |
| `ETL_USER` | Имя пользователя |
| `ETL_PASSWORD` | Пароль |
| `ETL_DATABASE` | (опционально) Имя БД по умолчанию |
| `ETL_SSL_ROOT_CERT` | (опционально) Путь к CA для TLS. В Docker не задавайте — сертификат Yandex Cloud уже есть в образе по умолчанию. |

Пример в `.env` для **ClickHouse** (Yandex Cloud, порт 8443):

```env
ETL_HOST=rc1a-xxxxx.mdb.yandexcloud.net
ETL_PORT=8443
ETL_USER=myuser
ETL_PASSWORD=secret
ETL_DATABASE=default
# ETL_SSL_ROOT_CERT — не нужна в Docker (сертификат уже в образе).
```

Пример для **PostgreSQL**:

```env
ETL_HOST=etl.example.yandexcloud.net
ETL_PORT=6432
ETL_USER=mygig_ro
ETL_PASSWORD=secret
ETL_DATABASE=etl_db
```

**В Docker** образ API при сборке сам скачивает корневой и промежуточный CA Yandex Cloud в `/app/certs/YandexCloudCA.pem`. Переменная `ETL_SSL_ROOT_CERT` не нужна — при подключении к ETL используется этот файл, если путь не задан.

**Проверка на сервере (Docker):** файл `.env` монтируется в контейнер как `/app/.env`, приложение читает его при старте. **Важно:** на хосте файл должен быть доступен на чтение пользователю в контейнере:
```bash
chmod 644 .env
```
Иначе контейнер api будет уходить в цикл перезапусков (приложение не сможет прочитать .env). После правки `.env` перезапустите api:
```bash
cd /opt/v0-my-gig-rewards-dashboard   # или ваш путь к проекту
docker compose restart api
docker compose exec api env | grep ETL
```
Если переменных нет в выводе `env`, проверьте, что запускаете из каталога, где лежит `.env`. Имена переменных — **строго** в верхнем регистре: `ETL_HOST`, а не `etl_host`.

Строку подключения собирают из переменных в коде; для TLS используется сертификат из `ETL_SSL_ROOT_CERT` или (в Docker) из `/app/certs/YandexCloudCA.pem` по умолчанию.

**Ошибка ECONNRESET при открытии «Данные ETL»:**  
1) Пересоберите **оба** образа и перезапустите — фронт вызывает один запрос `intro`, бэкенд подключается по выбранному протоколу (ClickHouse при порте 8443, PostgreSQL при 5432/6432):
   ```bash
   docker compose build app api
   docker compose up -d app api
   ```
2) **ClickHouse (Yandex):** укажите `ETL_PORT=8443` — используется HTTPS API с заголовками `X-ClickHouse-User` и `X-ClickHouse-Key`.  
3) **PostgreSQL (Yandex Managed):** для защищённого подключения часто указывают порт **6432**. Проверьте в консоли Yandex Cloud хост и порт кластера и при необходимости задайте `ETL_PORT=6432`.

## Зачем нужны сертификаты

Сервисы Yandex Cloud (в т.ч. ETL, БД) используют TLS, подписанный этими CA. Без добавления сертификатов клиент (Node.js, браузер, curl) может выдавать ошибки вида «self-signed certificate» или «unable to verify certificate».

---

## Windows (локальная разработка)

На Windows не обязательно ставить сертификаты в систему — достаточно **скачать PEM-файлы** и указать путь к ним в строке подключения к БД (параметр `sslrootcert`).

### 1. Скачать сертификаты

Из корня репозитория выполните PowerShell-скрипт:

```powershell
cd nestjs-service
.\scripts\download-yandex-certs.ps1
```

Скрипт создаёт папку `certs` и сохраняет туда:
- `RootCA.pem`
- `IntermediateCA.pem`
- `YandexCloudCA.pem` — объединённый файл (удобно передавать в `sslrootcert`)

Либо скачайте вручную:

```powershell
mkdir -Force nestjs-service\certs
Invoke-WebRequest -Uri "https://storage.yandexcloud.net/cloud-certs/RootCA.pem" -OutFile "nestjs-service\certs\RootCA.pem"
Invoke-WebRequest -Uri "https://storage.yandexcloud.net/cloud-certs/IntermediateCA.pem" -OutFile "nestjs-service\certs\IntermediateCA.pem"
```

Объединить в один файл для `sslrootcert`:

```powershell
Get-Content nestjs-service\certs\RootCA.pem, nestjs-service\certs\IntermediateCA.pem | Set-Content nestjs-service\certs\YandexCloudCA.pem
```

### 2. Использование в приложении

В `.env` бэкенда задайте строку подключения к БД с параметром `sslrootcert` (путь — к объединённому или к корневому CA):

**Вариант с абсолютным путём (Windows):**

```env
PG_CONNECTION=postgresql://user:password@host:5432/dbname?sslrootcert=C:\Users\sirso\MyGig\v0-my-gig-rewards-dashboard\nestjs-service\certs\YandexCloudCA.pem
```

**Вариант с относительным путём** (относительно рабочей директории при запуске, например из `nestjs-service/`):

```env
PG_CONNECTION=postgresql://user:password@host:5432/dbname?sslrootcert=./certs/YandexCloudCA.pem
```

Бэкенд (Drizzle) уже поддерживает `sslrootcert`: при наличии этого параметра в URL подключается к PostgreSQL с указанным CA для проверки сертификата сервера.

### 3. (Опционально) Установка в хранилище Windows

Если нужно, чтобы все приложения системы доверяли Yandex Cloud (например, браузер, Postman):

1. Скачайте `RootCA.pem` и `IntermediateCA.pem` (см. выше).
2. Переименуйте в `.crt` или импортируйте как есть.
3. Запустите `certmgr.msc` → «Доверенные корневые центры сертификации» → ПКМ → «Все задачи» → «Импорт» → выберите `RootCA.pem`.
4. Аналогично: «Промежуточные центры сертификации» → импорт `IntermediateCA.pem`.

---

## Linux (сервер / CI / Docker)

Используйте команды из официальной инструкции Yandex Cloud:

```bash
sudo mkdir -p /usr/local/share/ca-certificates/Yandex
sudo wget "https://storage.yandexcloud.net/cloud-certs/RootCA.pem" \
  -O /usr/local/share/ca-certificates/Yandex/RootCA.crt
sudo wget "https://storage.yandexcloud.net/cloud-certs/IntermediateCA.pem" \
  -O /usr/local/share/ca-certificates/Yandex/IntermediateCA.crt
sudo chmod 644 \
  /usr/local/share/ca-certificates/Yandex/RootCA.crt \
  /usr/local/share/ca-certificates/Yandex/IntermediateCA.crt
sudo update-ca-certificates
```

После этого системные клиенты (curl, Node.js и т.д.) будут доверять сертификатам Yandex Cloud.

**В Docker:** если образ собирается на Linux и в нём вызван `update-ca-certificates`, достаточно этих шагов в Dockerfile. Либо монтировать папку с PEM и передавать `sslrootcert` в строку подключения так же, как на Windows.

---

## Безопасность

- Папку `nestjs-service/certs/` добавьте в `.gitignore` — в репозиторий не коммитить скачанные сертификаты (они публичные, но единообразие и меньше шума в коммитах).
- Учётные данные БД/ETL храните только в переменных окружения или в секретах, не в коде.

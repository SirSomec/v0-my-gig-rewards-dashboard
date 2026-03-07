# Сертификаты Yandex Cloud для подключения к ETL (MVP)

Подключение к ETL на этапе MVP требует доверия к корневым и промежуточным CA сертификатам Yandex Cloud. Ниже — как их установить/использовать на **Windows** (локальная разработка) и на **Linux** (сервер/CI).

## Учётные данные ETL (env)

В проекте **один общий .env в корне репозитория** (рядом с `docker-compose.yml`). В нём задают и переменные ETL, и остальную конфигурацию. Контейнер api подхватывает их через `env_file: .env`.

Подключение к источнику данных ETL задаётся переменными окружения бэкенда:

| Переменная | Описание |
|------------|----------|
| `ETL_HOST` | Хост ETL (или БД источника) |
| `ETL_PORT` | Порт (например `5432` для PostgreSQL) |
| `ETL_USER` | Имя пользователя |
| `ETL_PASSWORD` | Пароль |
| `ETL_DATABASE` | (опционально) Имя БД |
| `ETL_SSL_ROOT_CERT` | (опционально) Путь к CA для TLS, например `./certs/YandexCloudCA.pem` |

Пример в `.env`:

```env
ETL_HOST=etl.example.yandexcloud.net
ETL_PORT=5432
ETL_USER=mygig_ro
ETL_PASSWORD=secret
ETL_DATABASE=etl_db
ETL_SSL_ROOT_CERT=./certs/YandexCloudCA.pem
```

Строку подключения (URL) при необходимости собирают из этих переменных в коде; сертификат по `ETL_SSL_ROOT_CERT` используется для проверки TLS при подключении к ETL.

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

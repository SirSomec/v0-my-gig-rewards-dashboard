# Деплой MyGig Rewards Dashboard на Ubuntu (VPS)

Пошаговая инструкция для развёртывания фронтенда на чистом сервере Ubuntu.

---

## Локальная разработка (после клонирования из Git)

Если после `git clone` или `git pull` дашборд показывает **«Failed to fetch»**:

1. **Установите зависимости** — при `npm install` автоматически создаётся `.env` из `.env.example`.
2. **При необходимости отредактируйте `.env`** — задайте `NEXT_PUBLIC_REWARDS_API_URL` (по умолчанию `http://localhost:3001`) и `NEXT_PUBLIC_DEV_USER_ID` (например `1`).
3. **Запустите бэкенд** на порту из `NEXT_PUBLIC_REWARDS_API_URL`, затем выполните `npm run dev`.

Без запущенного бэкенда и без заданного `NEXT_PUBLIC_DEV_USER_ID` дашборд не сможет загрузить данные.

---

## 1. Подключение к серверу

```bash
ssh root@ВАШ_IP
# или
ssh пользователь@ВАШ_IP
```

---

## 2. Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 3. Установка Docker

```bash
# Зависимости
sudo apt install -y ca-certificates curl gnupg

# Ключ и репозиторий Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установка
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Проверка:

```bash
sudo docker run hello-world
```

---

## 4. (Опционально) Работа с Docker без sudo

Чтобы не писать `sudo` перед каждой командой docker:

```bash
sudo usermod -aG docker $USER
# Выйти из SSH и зайти снова, чтобы группа применилась
```

Дальше в инструкции команды даны без `sudo`; если не добавляли пользователя в группу `docker`, добавляйте `sudo` перед `docker` и `docker compose`.

---

## 5. Размещение проекта на сервере

### Вариант А: клонирование из Git

```bash
# Установка Git (если ещё нет)
sudo apt install -y git

cd /opt   # или другой каталог, например /var/www
sudo git clone https://github.com/ВАШ_ОРГАНИЗАЦИЯ/v0-my-gig-rewards-dashboard.git
cd v0-my-gig-rewards-dashboard
```

Для приватного репозитория настройте SSH-ключ или токен и используйте URL вида `git@github.com:...`.

### Вариант Б: копирование архива с локальной машины

**Сначала выполните шаги на своей локальной машине** (Windows: PowerShell или WSL; macOS/Linux: терминал), затем — на сервере.

**На локальной машине** (перейдите в каталог проекта, например `v0-my-gig-rewards-dashboard`):

```bash
# Собрать архив без node_modules и .next
tar --exclude='node_modules' --exclude='.next' --exclude='.git' -czvf mygig-dashboard.tar.gz .

# Скопировать на сервер (подставьте свой IP и пользователя)
scp mygig-dashboard.tar.gz root@ВАШ_IP:/tmp/
```

**На сервере** (после того как архив уже скопирован):

```bash
# Проверить, что архив на месте
ls -la /tmp/mygig-dashboard.tar.gz

sudo mkdir -p /opt/mygig-dashboard
cd /opt/mygig-dashboard
sudo tar -xzvf /tmp/mygig-dashboard.tar.gz
# Убедиться, что в каталоге есть Dockerfile, docker-compose.yml, package.json и т.д.
ls -la
```

---

## 6. Сборка и запуск контейнеров

Запускаются **три контейнера**: фронт (app), бэкенд API (api), БД PostgreSQL (db). Бэкенд устанавливается и работает в отдельном контейнере; при старте API автоматически применяются миграции БД.

**Перед первым запуском** создайте в корне проекта файл `.env` (или скопируйте из `.env.example`). Обязательно задайте:

- `NEXT_PUBLIC_REWARDS_API_URL` — URL, по которому браузер пользователя достучится до API (например `http://ВАШ_IP_СЕРВЕРА:3001`). Не используйте `http://localhost:3001` на продакшене — с другого компьютера API будет недоступен.
- `NEXT_PUBLIC_DEV_USER_ID` — ID тестового пользователя для входа (например `1`).
- `JWT_SECRET` — секрет для JWT (в production задайте свой).

В каталоге проекта на сервере:

```bash
cd /opt/v0-my-gig-rewards-dashboard   # или ваш путь

# Сборка образов (фронт, API, образ БД не собирается — используется postgres:16-alpine)
docker compose build

# Запуск в фоне
docker compose up -d
```

Проверка:

```bash
docker compose ps
# Должны быть контейнеры app, api, db в состоянии running

curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Должно вернуть 200 (фронт)

curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/v1/rewards/me?userId=1
# Должно вернуть 200 (API)
```

Сайт доступен по адресу `http://ВАШ_IP:3000`, API — по `http://ВАШ_IP:3001`.

---

## 7. Открытие портов в файрволе (если включён ufw)

```bash
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
# или, если позже поставите nginx на 80/443:
# sudo ufw allow 80/tcp
# sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

---

## 8. Обновление приложения после изменений

**Задача пользователя:** синхронизировать изменения и обновить контейнеры. Всё остальное (сборка образов, перезапуск) выполняется одним скриптом.

В каталоге проекта на сервере (один раз сделайте скрипт исполняемым, если ещё не делали):

```bash
chmod +x scripts/deploy.sh
```

При каждом обновлении:

```bash
./scripts/deploy.sh
```

Скрипт по очереди:
1. Выполняет `git pull` (если проект клонирован из Git).
2. Собирает образы: `docker compose build`.
3. Перезапускает контейнеры: `docker compose up -d`.

Дополнительные команды вручную не нужны.

По умолчанию в одном `docker compose up -d` поднимаются фронт, API и БД (см. раздел 6). Если нужен **только фронт** без бэкенда (API уже где-то снаружи), в `docker-compose.yml` можно закомментировать сервисы `api` и `db` и задать в `.env` переменную `NEXT_PUBLIC_REWARDS_API_URL` на внешний URL API.

---

## 9. Полезные команды

| Действие              | Команда                         |
|-----------------------|----------------------------------|
| Логи всех контейнеров | `docker compose logs -f`         |
| Логи только API       | `docker compose logs -f api`     |
| Остановить            | `docker compose down`            |
| Запустить снова       | `docker compose up -d`           |
| Статус контейнеров    | `docker compose ps`              |

---

## 10. (Опционально) Nginx как reverse proxy и HTTPS

Если нужен домен и доступ по 80/443 с SSL.

### Установка Nginx и Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Конфиг Nginx

Создайте файл (подставьте свой домен):

```bash
sudo nano /etc/nginx/sites-available/mygig-dashboard
```

Содержимое (без SSL, только проксирование на порт 3000):

```nginx
server {
    listen 80;
    server_name ваш-домен.ru;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Включите сайт и проверьте конфиг:

```bash
sudo ln -s /etc/nginx/sites-available/mygig-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Откройте в файрволе порты 80 и 443:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### SSL-сертификат (Let's Encrypt)

```bash
sudo certbot --nginx -d ваш-домен.ru
```

Следуйте подсказкам. После этого Certbot сам поправит конфиг Nginx для HTTPS.

---

## Итог

- Обновление: `sudo apt update && sudo apt upgrade -y`
- Docker: установка из официального репозитория Docker
- Проект: клонирование Git или распаковка архива в `/opt/...`
- Запуск: `docker compose build && docker compose up -d`
- **Обновление после изменений:** один раз `chmod +x scripts/deploy.sh`, далее при каждом обновлении — `./scripts/deploy.sh` (синхронизация и перезапуск контейнеров выполняются автоматически)
- Доступ: `http://ВАШ_IP:3000` или через Nginx по домену с HTTPS.

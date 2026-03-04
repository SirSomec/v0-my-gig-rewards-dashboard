# Деплой MyGig Rewards Dashboard на Ubuntu (VPS)

Пошаговая инструкция для развёртывания фронтенда на чистом сервере Ubuntu.

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

## 6. Сборка и запуск контейнера

В каталоге проекта на сервере (например `/opt/v0-my-gig-rewards-dashboard` или `/opt/mygig-dashboard`):

```bash
cd /opt/v0-my-gig-rewards-dashboard   # или ваш путь

# Сборка образа
docker compose build

# Запуск в фоне
docker compose up -d
```

Проверка:

```bash
docker compose ps
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Должно вернуть 200
```

Сайт будет доступен по адресу `http://ВАШ_IP:3000`.

---

## 7. Открытие порта в файрволе (если включён ufw)

```bash
sudo ufw allow 3000/tcp
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

### Полный стек (фронт + API + БД) — опционально

Если на том же сервере поднимаете API и PostgreSQL, используйте дополнительный файл `docker-compose.api.yml`. Контейнер API при старте **автоматически применяет миграции БД**, отдельно их запускать не нужно.

```bash
docker compose -f docker-compose.yml -f docker-compose.api.yml build
docker compose -f docker-compose.yml -f docker-compose.api.yml up -d
```

Чтобы и обновление делалось одним скриптом, в `scripts/deploy.sh` можно заменить вызов на:

```bash
docker compose -f docker-compose.yml -f docker-compose.api.yml build
docker compose -f docker-compose.yml -f docker-compose.api.yml up -d
```

Перед первым запуском создайте в корне проекта файл `.env` с переменными для API (например `DATABASE_URL`, `JWT_SECRET`). В `docker-compose.api.yml` для БД заданы логин/пароль/БД: `rewards`/`rewards`/`rewards`.

---

## 9. Полезные команды

| Действие              | Команда                    |
|-----------------------|----------------------------|
| Логи приложения       | `docker compose logs -f`   |
| Остановить            | `docker compose down`      |
| Запустить снова       | `docker compose up -d`     |
| Статус контейнеров    | `docker compose ps`        |

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

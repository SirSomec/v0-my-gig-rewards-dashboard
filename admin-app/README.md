# MyGig Админ-панель

Отдельное приложение панели администратора MyGig Rewards. Запускается на отдельном порту (по умолчанию 3002) или в отдельном контейнере.

## Запуск

```bash
# Установка зависимостей
npm install

# Разработка (порт 3002)
npm run dev

# Сборка и запуск
npm run build
npm start
```

## Переменные окружения

См. `.env.example`:

- `NEXT_PUBLIC_REWARDS_API_URL` — URL бэкенда (NestJS), по умолчанию `http://localhost:3001`
- `NEXT_PUBLIC_ADMIN_SECRET` — секрет для заголовка X-Admin-Key (должен совпадать с `ADMIN_SECRET` на бэкенде)
- `ADMIN_PANEL_PASSWORD` — пароль входа в админку (если не задан — вход без пароля)
- `NEXT_PUBLIC_DASHBOARD_URL` — URL основного дашборда (для ссылки «Дашборд» и «Открыть кабинет от имени»)

## Docker

```bash
docker build -t mygig-admin .
docker run -p 3002:3002 \
  -e NEXT_PUBLIC_REWARDS_API_URL=http://host.docker.internal:3001 \
  -e NEXT_PUBLIC_ADMIN_SECRET=your-secret \
  -e ADMIN_PANEL_PASSWORD=your-password \
  mygig-admin
```

При сборке образа можно передать build-аргументы: `NEXT_PUBLIC_REWARDS_API_URL`, `NEXT_PUBLIC_ADMIN_SECRET`, `NEXT_PUBLIC_DASHBOARD_URL`.

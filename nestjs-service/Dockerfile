# Сборка API (NestJS). При каждом старте контейнера автоматически применяются все неприменённые миграции БД.
FROM node:22-alpine AS builder

WORKDIR /app

# Сначала ставим все зависимости (в т.ч. dev) — для сборки нужен @nestjs/cli
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Продакшен-образ
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 apiuser

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json package-lock.json* ./
# Только production-зависимости для рантайма
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Сертификаты Yandex Cloud для ETL (подключение к БД/источникам в Yandex Cloud)
RUN apk add --no-cache wget \
  && mkdir -p /app/certs \
  && wget -q -O /app/certs/RootCA.pem "https://storage.yandexcloud.net/cloud-certs/RootCA.pem" \
  && wget -q -O /app/certs/IntermediateCA.pem "https://storage.yandexcloud.net/cloud-certs/IntermediateCA.pem" \
  && cat /app/certs/RootCA.pem /app/certs/IntermediateCA.pem > /app/certs/YandexCloudCA.pem \
  && chown -R apiuser:nodejs /app/certs

USER apiuser

EXPOSE 3001

ENV PORT=3001
ENV MIGRATIONS_PATH=/app/migrations

ENTRYPOINT ["/entrypoint.sh"]

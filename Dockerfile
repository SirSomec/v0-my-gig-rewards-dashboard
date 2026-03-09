# Сборка приложения
FROM node:22-alpine AS builder

WORKDIR /app

# Переменные для фронта (API URL, dev-user, админ-ключ, MyGig API) — подставляются при сборке образа
ARG NEXT_PUBLIC_REWARDS_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_DEV_USER_ID=1
ARG NEXT_PUBLIC_ADMIN_SECRET=admin-dev-secret
ARG NEXT_PUBLIC_MYGIG_API_URL
ENV NEXT_PUBLIC_REWARDS_API_URL=$NEXT_PUBLIC_REWARDS_API_URL
ENV NEXT_PUBLIC_DEV_USER_ID=$NEXT_PUBLIC_DEV_USER_ID
ENV NEXT_PUBLIC_ADMIN_SECRET=$NEXT_PUBLIC_ADMIN_SECRET
ENV NEXT_PUBLIC_MYGIG_API_URL=$NEXT_PUBLIC_MYGIG_API_URL

# Кэширование зависимостей (--ignore-scripts: postinstall ensure-env не нужен в образе, .env задаётся через build args)
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm build

# Продакшен-образ
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

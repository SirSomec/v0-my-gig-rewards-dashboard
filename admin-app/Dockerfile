# Сборка админ-приложения
FROM node:22-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_REWARDS_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_ADMIN_SECRET=
ARG NEXT_PUBLIC_DASHBOARD_URL=
ENV NEXT_PUBLIC_REWARDS_API_URL=$NEXT_PUBLIC_REWARDS_API_URL
ENV NEXT_PUBLIC_ADMIN_SECRET=$NEXT_PUBLIC_ADMIN_SECRET
ENV NEXT_PUBLIC_DASHBOARD_URL=$NEXT_PUBLIC_DASHBOARD_URL

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts

COPY . .
RUN mkdir -p public
RUN npm run build

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

EXPOSE 3002

ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

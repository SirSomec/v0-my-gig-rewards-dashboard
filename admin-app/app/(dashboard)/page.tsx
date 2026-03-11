"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { AlertCircle, Info, Users, Gift, Clock, Eye, LayoutDashboard } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useAdminOverview } from "@/hooks/use-admin-overview"

const chartConfig = {
  users: {
    label: "Пользователи",
    color: "hsl(var(--primary))",
  },
  redemptions: {
    label: "Заявки на обмен",
    color: "hsl(var(--chart-2))",
  },
  balance: {
    label: "Бонусы на счетах",
    color: "hsl(var(--primary))",
  },
  value: {
    label: "Значение",
    color: "hsl(var(--primary))",
  },
  spent: {
    label: "Потрачено",
    color: "hsl(var(--destructive))",
  },
  views: {
    label: "Просмотры",
    color: "hsl(var(--chart-3))",
  },
  uniqueUsers: {
    label: "Уникальные пользователи",
    color: "hsl(var(--chart-4))",
  },
}

function formatDateLabel(isoDate: string): string {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
}

export default function DashboardHomePage() {
  const {
    loading,
    error,
    stats,
    userRegistrationsByDay,
    redemptionsByDay,
    totalCoinsInSystem,
    balanceByDay,
    spentByDay,
    topQuests,
    topStoreItems,
    alerts,
    pageViewsOverview,
  } = useAdminOverview()

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Обзор</h1>
          <p className="text-sm text-muted-foreground">
            Сводка по пользователям, заявкам на обмен и состоянию интеграций.
          </p>
        </div>
        {stats && (
          <Badge variant="outline" className="text-xs">
            Всего пользователей: {stats.totalUsers.toLocaleString("ru-RU")}
          </Badge>
        )}
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              Ошибка загрузки данных
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-muted-foreground" />
              Пользователи
            </CardTitle>
            <CardDescription>Общее количество пользователей в системе.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !stats ? (
              <Skeleton className="h-9 w-24 rounded-lg" />
            ) : (
              <p className="text-2xl font-semibold">
                {stats ? stats.totalUsers.toLocaleString("ru-RU") : "—"}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="h-4 w-4 text-muted-foreground" />
              Заявки на обмен
            </CardTitle>
            <CardDescription>Сколько всего заявок на обмен обработано.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !stats ? (
              <Skeleton className="h-9 w-24 rounded-lg" />
            ) : (
              <p className="text-2xl font-semibold">
                {stats ? stats.totalRedemptions.toLocaleString("ru-RU") : "—"}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-muted-foreground" />
              В ожидании обработки
            </CardTitle>
            <CardDescription>Заявки на обмен со статусом «в очереди».</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !stats ? (
              <Skeleton className="h-9 w-24 rounded-lg" />
            ) : (
              <p className="text-2xl font-semibold">
                {stats ? stats.pendingRedemptions.toLocaleString("ru-RU") : "—"}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-muted-foreground" />
              Монеты в системе
            </CardTitle>
            <CardDescription>Суммарный текущий баланс всех пользователей (оценка).</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && totalCoinsInSystem == null ? (
              <Skeleton className="h-9 w-32 rounded-lg" />
            ) : (
              <p className="text-2xl font-semibold">
                {totalCoinsInSystem != null ? totalCoinsInSystem.toLocaleString("ru-RU") : "—"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Аналитика посещаемости: просмотры вкладок пользователями — секция всегда видна */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold tracking-tight">Аналитика посещаемости</h2>
        {pageViewsOverview == null ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-4 w-4 text-muted-foreground" />
                Просмотры вкладок дашборда
              </CardTitle>
              <CardDescription>
                Счётчики посещаемости и просмотра вкладок пользователями (home, history, store, levels).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-48 rounded-lg" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Данные загружаются или пока недоступны. Убедитесь, что бэкенд API обновлён и применена миграция
                  <code className="mx-1 rounded bg-muted px-1">page_views</code>.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    Просмотры вкладок
                  </CardTitle>
                  <CardDescription>Всего просмотров вкладок дашборда за последние 14 дней.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {pageViewsOverview.totalViews.toLocaleString("ru-RU")}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    Уникальные пользователи
                  </CardTitle>
                  <CardDescription>Сколько пользователей открывали вкладки за последние 14 дней.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {pageViewsOverview.totalUniqueUsers.toLocaleString("ru-RU")}
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="min-h-[260px]">
                <CardHeader>
                  <CardTitle className="text-base">Просмотры вкладок по дням</CardTitle>
                  <CardDescription>Последние 14 дней: количество просмотров и уникальных пользователей по дням.</CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  {pageViewsOverview.byDay.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Нет данных за выбранный период.</p>
                  ) : (
                    <ChartContainer
                      config={{
                        views: chartConfig.views,
                        uniqueUsers: chartConfig.uniqueUsers,
                      }}
                      className="h-56"
                    >
                      <BarChart data={pageViewsOverview.byDay}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatDateLabel}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={16}
                        />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="views" fill="var(--color-views)" name="Просмотры" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="uniqueUsers" fill="var(--color-uniqueUsers)" name="Уник. пользователи" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Уникальные пользователи по дням</CardTitle>
                  <CardDescription>Количество уникальных пользователей, открывавших вкладки дашборда по каждому дню (последние 14 дней).</CardDescription>
                </CardHeader>
                <CardContent className="pt-2 space-y-2">
                  {pageViewsOverview.byDay.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Нет данных.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {pageViewsOverview.byDay.map((row) => (
                        <li
                          key={row.date}
                          className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                        >
                          <span className="font-medium">{formatDateLabel(row.date)}</span>
                          <span className="text-xs font-semibold text-primary">
                            {row.uniqueUsers.toLocaleString("ru-RU")} уник. пользователей
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-h-[260px]">
          <CardHeader>
            <CardTitle className="text-base">Новые пользователи по дням</CardTitle>
            <CardDescription>Последние 14 дней по дате регистрации (по выборке первых 100).</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {loading && userRegistrationsByDay.length === 0 ? (
              <Skeleton className="h-40 w-full rounded-lg" />
            ) : userRegistrationsByDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">Недостаточно данных для построения графика.</p>
            ) : (
              <ChartContainer
                config={{
                  users: {
                    label: chartConfig.users.label,
                    color: chartConfig.users.color,
                  },
                }}
                className="h-56"
              >
                <BarChart data={userRegistrationsByDay}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-users)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[260px]">
          <CardHeader>
            <CardTitle className="text-base">Заявки на обмен по дням</CardTitle>
            <CardDescription>Последние 14 дней по дате создания (по выборке первых 100).</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {loading && redemptionsByDay.length === 0 ? (
              <Skeleton className="h-40 w-full rounded-lg" />
            ) : redemptionsByDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">Недостаточно данных для построения графика.</p>
            ) : (
              <ChartContainer
                config={{
                  redemptions: {
                    label: chartConfig.redemptions.label,
                    color: chartConfig.redemptions.color,
                  },
                }}
                className="h-56"
              >
                <BarChart data={redemptionsByDay}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-redemptions)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-h-[260px]">
          <CardHeader>
            <CardTitle className="text-base">Бонусы на счетах по дням</CardTitle>
            <CardDescription>
              Фактическое количество бонусов на счетах пользователей на конец каждого дня (последние 14 дней).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {loading && balanceByDay.length === 0 ? (
              <Skeleton className="h-40 w-full rounded-lg" />
            ) : balanceByDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">Недостаточно данных для построения графика.</p>
            ) : (
              <ChartContainer
                config={{
                  value: {
                    label: chartConfig.balance.label,
                    color: chartConfig.balance.color,
                  },
                }}
                className="h-56"
              >
                <BarChart data={balanceByDay}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[260px]">
          <CardHeader>
            <CardTitle className="text-base">Потраченные бонусы по дням</CardTitle>
            <CardDescription>
              Количество потраченных бонусов по дням (заявки на обмен, последние 14 дней).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {loading && spentByDay.length === 0 ? (
              <Skeleton className="h-40 w-full rounded-lg" />
            ) : spentByDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">Недостаточно данных для построения графика.</p>
            ) : (
              <ChartContainer
                config={{
                  value: {
                    label: chartConfig.spent.label,
                    color: chartConfig.spent.color,
                  },
                }}
                className="h-56"
              >
                <BarChart data={spentByDay}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Топ квестов по награде</CardTitle>
            <CardDescription>Квесты с наибольшим размером награды.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 space-y-2">
            {loading && topQuests.length === 0 ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ) : topQuests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Квесты ещё не настроены.</p>
            ) : (
              <ul className="space-y-1.5">
                {topQuests.map((q) => (
                  <li
                    key={q.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{q.name}</p>
                      {q.description && (
                        <p className="truncate text-xs text-muted-foreground">{q.description}</p>
                      )}
                    </div>
                    <span className="ml-3 shrink-0 text-xs font-semibold text-primary">
                      +{q.rewardCoins.toLocaleString("ru-RU")} коин.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Топ товаров магазина</CardTitle>
            <CardDescription>Самые популярные позиции по числу обменов.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 space-y-2">
            {loading && topStoreItems.length === 0 ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ) : topStoreItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">В магазине ещё нет активных товаров.</p>
            ) : (
              <ul className="space-y-1.5">
                {topStoreItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.name}</p>
                      {item.category && (
                        <p className="truncate text-xs text-muted-foreground">{item.category}</p>
                      )}
                    </div>
                    <div className="ml-3 flex shrink-0 flex-col items-end gap-0.5">
                      <span className="text-xs font-semibold text-primary">
                        {item.redeemedCount?.toLocaleString("ru-RU") ?? 0} обменов
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.cost.toLocaleString("ru-RU")} коин.
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-muted-foreground" />
              Состояние интеграций
            </CardTitle>
            <CardDescription>Краткое состояние ETL, TOJ и мок-сервисов.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a, idx) => (
              <div
                key={`${a.title}-${idx}`}
                className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm"
              >
                {a.type === "error" || a.type === "warning" ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 text-amber-500" />
                ) : (
                  <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">{a.title}</p>
                  {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}


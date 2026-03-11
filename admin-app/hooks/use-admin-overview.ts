"use client"

import { useEffect, useState } from "react"
import {
  adminListUsers,
  adminListRedemptions,
  adminListLevels,
  adminListQuests,
  adminListStoreItems,
  adminEtlExplorerStatus,
  adminMockTojStatus,
  adminTojSyncStatus,
  type AdminLevel,
  type AdminQuest,
  type AdminStoreItem,
} from "@/lib/admin-api"

type TimeSeriesPoint = {
  date: string
  value: number
}

type DailyCoinsPoint = {
  date: string
  earned: number
  spent: number
}
const MAX_ITEMS_FOR_CHART = 1000

type OverviewStats = {
  totalUsers: number
  totalRedemptions: number
  pendingRedemptions: number
}

export type OverviewAlert = {
  type: "info" | "warning" | "error"
  title: string
  description?: string
}

export interface AdminOverviewState {
  loading: boolean
  error: string | null
  stats: OverviewStats | null
  userRegistrationsByDay: TimeSeriesPoint[]
  redemptionsByDay: TimeSeriesPoint[]
  /** Суммарные бонусы в системе (приближённо: сумма текущих балансов пользователей) */
  totalCoinsInSystem: number | null
  /** Ежедневная динамика начисленных и потраченных монет (по последним транзакциям/заявкам) */
  coinsByDay: DailyCoinsPoint[]
  levels: AdminLevel[]
  topQuests: AdminQuest[]
  topStoreItems: AdminStoreItem[]
  alerts: OverviewAlert[]
}

function groupByDate<T extends { createdAt?: string | null }>(
  items: T[],
  options?: { days?: number }
): TimeSeriesPoint[] {
  const days = options?.days ?? 14
  const counts = new Map<string, number>()

  for (const item of items) {
    if (!item.createdAt) continue
    const d = new Date(item.createdAt as string)
    if (Number.isNaN(d.getTime())) continue
    const key = d.toISOString().slice(0, 10)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const today = new Date()
  const result: TimeSeriesPoint[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    result.push({
      date: key,
      value: counts.get(key) ?? 0,
    })
  }

  if (result.every((p) => p.value === 0)) {
    return []
  }

  return result
}

export function useAdminOverview(): AdminOverviewState {
  const [state, setState] = useState<AdminOverviewState>({
    loading: true,
    error: null,
    stats: null,
    userRegistrationsByDay: [],
    redemptionsByDay: [],
    totalCoinsInSystem: null,
    coinsByDay: [],
    levels: [],
    topQuests: [],
    topStoreItems: [],
    alerts: [],
  })

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        // 1. Быстрая часть: только основные метрики (минимум запросов)
        const [usersRes, redemptionsRes, pendingRedemptionsRes] = await Promise.all([
          adminListUsers({ pageSize: 200 }),
          adminListRedemptions({ pageSize: 200 }),
          adminListRedemptions({ status: "pending", pageSize: 1 }),
        ])

        if (cancelled) return

        const stats: OverviewStats = {
          totalUsers: usersRes.total,
          totalRedemptions: redemptionsRes.total,
          pendingRedemptions: pendingRedemptionsRes.total ?? 0,
        }

        // Ограничиваем объём данных, используемых для построения графиков,
        // чтобы не взрывать память, даже если бэкенд вернёт очень большую выборку.
        const usersForCharts = (usersRes.items ?? []).slice(0, MAX_ITEMS_FOR_CHART)
        const redemptionsForCharts = (redemptionsRes.items ?? []).slice(0, MAX_ITEMS_FOR_CHART)

        const userRegistrationsByDay = groupByDate(usersForCharts)
        const redemptionsByDay = groupByDate(redemptionsForCharts)

        // Подготовим локальную карту «сколько обменов по каждому товару»
        const redemptionCounts = new Map<number, number>()
        for (const r of redemptionsForCharts) {
          if (!r.storeItemId) continue
          const key = r.storeItemId
          redemptionCounts.set(key, (redemptionCounts.get(key) ?? 0) + 1)
        }

        // Приблизительный общий объём монет в обороте: сумма текущих балансов
        const totalCoinsInSystem =
          usersRes.items?.reduce((acc, u) => acc + (u.balance ?? 0), 0) ?? null

        // Графики по начисленным и потраченным монетам:
        // - начислено: положительные суммы из транзакций типов shift/bonus/quest/manual_credit
        // - потрачено: стоимость заявок на обмен (coinsSpent) из redemptions
        const today = new Date()
        const days = 14
        const coinsByDayMap = new Map<string, { earned: number; spent: number }>()

        // Потраченные монеты (по заявкам на обмен)
        for (const r of redemptionsForCharts) {
          if (!r.createdAt) continue
          const d = new Date(r.createdAt)
          if (Number.isNaN(d.getTime())) continue
          const key = d.toISOString().slice(0, 10)
          const entry = coinsByDayMap.get(key) ?? { earned: 0, spent: 0 }
          entry.spent += r.coinsSpent ?? 0
          coinsByDayMap.set(key, entry)
        }

        // Начисленные монеты по дням мы позже будем приближённо считать
        // как разницу балансов, но для простоты сейчас оставим 0,
        // чтобы не показывать некорректные значения.
        const coinsByDay: DailyCoinsPoint[] = []
        for (let i = days - 1; i >= 0; i -= 1) {
          const d = new Date(today)
          d.setDate(today.getDate() - i)
          const key = d.toISOString().slice(0, 10)
          const entry = coinsByDayMap.get(key) ?? { earned: 0, spent: 0 }
          coinsByDay.push({
            date: key,
            earned: entry.earned,
            spent: entry.spent,
          })
        }

        // Обновляем основные данные и снимаем общий лоадер
        setState((prev) => ({
          ...prev,
          loading: false,
          error: null,
          stats,
          userRegistrationsByDay,
          redemptionsByDay,
          totalCoinsInSystem,
          coinsByDay,
        }))

        // 2. Тихая дозагрузка: уровни, квесты, магазин и статусы интеграций
        void (async () => {
          try {
            const [levels, quests, storeItems, etlStatus, mockTojStatus, tojSyncStatus] = await Promise.all([
              adminListLevels(),
              adminListQuests(),
              adminListStoreItems(),
              adminEtlExplorerStatus().catch(() => null),
              adminMockTojStatus().catch(() => null),
              adminTojSyncStatus().catch(() => null),
            ])

            if (cancelled) return

            const alerts: OverviewAlert[] = []

            if (etlStatus && !etlStatus.configured) {
              alerts.push({
                type: "warning",
                title: "ETL-подключение не настроено",
                description: "Некоторые данные из внешних источников могут быть недоступны.",
              })
            }

            if (tojSyncStatus && !tojSyncStatus.syncEnabled) {
              alerts.push({
                type: "info",
                title: "Синхронизация TOJ отключена",
                description: "Новые смены из TOJ сейчас не импортируются автоматически.",
              })
            }

            if (mockTojStatus && !mockTojStatus.configured) {
              alerts.push({
                type: "info",
                title: "Мок TOJ не сконфигурирован",
                description: 'Раздел "Мок TOJ" доступен только после настройки подключения.',
              })
            }

            const topQuests = [...quests]
              .slice(0, MAX_ITEMS_FOR_CHART)
              .sort((a, b) => b.rewardCoins - a.rewardCoins)
              .slice(0, 5)

            // «Счётчик обменов» в обзоре считаем по последним заявкам,
            // которые уже загружены в redemptionsForCharts.
            const topStoreItems = [...storeItems]
              .slice(0, MAX_ITEMS_FOR_CHART)
              .map((item) => ({
                ...item,
                redeemedCount: redemptionCounts.get(item.id) ?? 0,
              }))
              .sort((a, b) => (b.redeemedCount ?? 0) - (a.redeemedCount ?? 0))
              .slice(0, 5)

            setState((prev) => ({
              ...prev,
              levels,
              topQuests,
              topStoreItems,
              alerts,
            }))
          } catch {
            // Ошибки фоновой дозагрузки не блокируют основной дашборд
          }
        })()
      } catch (e) {
        if (cancelled) return
        setState((prev) => ({
          ...prev,
          loading: false,
          error: e instanceof Error ? e.message : "Не удалось загрузить данные обзора",
        }))
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}


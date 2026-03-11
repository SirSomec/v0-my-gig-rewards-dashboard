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
          adminListUsers({ pageSize: 50 }),
          adminListRedemptions({ pageSize: 50 }),
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

        // Обновляем основные данные и снимаем общий лоадер
        setState((prev) => ({
          ...prev,
          loading: false,
          error: null,
          stats,
          userRegistrationsByDay,
          redemptionsByDay,
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

            const topQuests = [...quests].slice(0, MAX_ITEMS_FOR_CHART).sort((a, b) => b.rewardCoins - a.rewardCoins).slice(0, 5)

            const topStoreItems = [...storeItems]
              .slice(0, MAX_ITEMS_FOR_CHART)
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


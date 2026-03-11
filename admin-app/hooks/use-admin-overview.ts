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
        const [
          usersRes,
          redemptionsRes,
          pendingRedemptionsRes,
          levels,
          quests,
          storeItems,
          etlStatus,
          mockTojStatus,
          tojSyncStatus,
        ] = await Promise.all([
          adminListUsers({ pageSize: 100 }),
          adminListRedemptions({ pageSize: 100 }),
          adminListRedemptions({ status: "pending", pageSize: 1 }),
          adminListLevels(),
          adminListQuests(),
          adminListStoreItems(),
          adminEtlExplorerStatus().catch(() => null),
          adminMockTojStatus().catch(() => null),
          adminTojSyncStatus().catch(() => null),
        ])

        if (cancelled) return

        const stats: OverviewStats = {
          totalUsers: usersRes.total,
          totalRedemptions: redemptionsRes.total,
          pendingRedemptions: pendingRedemptionsRes.total ?? 0,
        }

        const userRegistrationsByDay = groupByDate(usersRes.items)
        const redemptionsByDay = groupByDate(redemptionsRes.items)

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

        const topQuests = [...quests].sort((a, b) => b.rewardCoins - a.rewardCoins).slice(0, 5)

        const topStoreItems = [...storeItems]
          .sort((a, b) => (b.redeemedCount ?? 0) - (a.redeemedCount ?? 0))
          .slice(0, 5)

        setState({
          loading: false,
          error: null,
          stats,
          userRegistrationsByDay,
          redemptionsByDay,
          levels,
          topQuests,
          topStoreItems,
          alerts,
        })
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


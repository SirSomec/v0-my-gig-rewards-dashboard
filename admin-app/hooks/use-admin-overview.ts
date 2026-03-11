"use client"

import { useEffect, useState } from "react"
import {
  adminListUsers,
  adminListRedemptions,
  adminListLevels,
  adminListQuests,
  adminListStoreItems,
  adminGetCoinsOverview,
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
  /** Суммарные бонусы в системе (с API или сумма балансов пользователей до загрузки) */
  totalCoinsInSystem: number | null
  /** Фактическое количество бонусов на счетах пользователей на конец каждого дня */
  balanceByDay: TimeSeriesPoint[]
  /** Количество потраченных бонусов по дням */
  spentByDay: TimeSeriesPoint[]
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
    balanceByDay: [],
    spentByDay: [],
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

        // Приблизительный общий объём монет: сумма текущих балансов (до загрузки coins-overview)
        const totalCoinsInSystem =
          usersRes.items?.reduce((acc, u) => acc + (u.balance ?? 0), 0) ?? null

        // Обновляем основные данные и снимаем общий лоадер
        setState((prev) => ({
          ...prev,
          loading: false,
          error: null,
          stats,
          userRegistrationsByDay,
          redemptionsByDay,
          totalCoinsInSystem,
          balanceByDay: prev.balanceByDay,
          spentByDay: prev.spentByDay,
        }))

        // 2. Тихая дозагрузка: обзор монет (баланс/траты по дням), уровни, квесты, магазин, статусы
        void (async () => {
          try {
            const [coinsOverview, levels, quests, storeItems, etlStatus, mockTojStatus, tojSyncStatus] =
              await Promise.all([
                adminGetCoinsOverview(14).catch(() => null),
                adminListLevels(),
                adminListQuests(),
                adminListStoreItems(),
                adminEtlExplorerStatus().catch(() => null),
                adminMockTojStatus().catch(() => null),
                adminTojSyncStatus().catch(() => null),
              ])

            if (cancelled) return

            const balanceByDay: TimeSeriesPoint[] =
              coinsOverview?.byDay?.map((d) => ({ date: d.date, value: d.balanceAtEndOfDay })) ?? []
            const spentByDay: TimeSeriesPoint[] =
              coinsOverview?.byDay?.map((d) => ({ date: d.date, value: d.spentThatDay })) ?? []
            const totalFromApi = coinsOverview?.totalBalanceToday ?? null

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
              ...(totalFromApi != null && { totalCoinsInSystem: totalFromApi }),
              balanceByDay,
              spentByDay,
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


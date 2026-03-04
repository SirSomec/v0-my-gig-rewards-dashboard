"use client"

import { useState, useEffect, useCallback } from "react"
import {
  fetchMe,
  fetchTransactions,
  fetchQuests,
  fetchStore,
  createRedemption as apiCreateRedemption,
  devLogin,
  getDevUserId,
  isLoggedIn,
  clearToken,
  type MeResponse,
  type TransactionResponse,
  type QuestResponse,
  type StoreItemResponse,
} from "@/lib/rewards-api"
import type { EarningEntry } from "@/components/mygig/earning-history"
import type { Quest } from "@/components/mygig/quests"
import type { StoreItem } from "@/components/mygig/redemption-store"
import { format, isToday, isYesterday } from "date-fns"
import { ru } from "date-fns/locale"

export interface DashboardUser {
  name: string
  level: string
  nextLevel: string
  balance: number
  shiftsCompleted: number
  shiftsRequired: number
  shiftsRemaining: number
  avatarUrl?: string
  strikesCount: number
  strikesThreshold: number | null
}

function mapMe(m: MeResponse): DashboardUser {
  return {
    name: m.name ?? "Пользователь",
    level: m.levelName,
    nextLevel: m.nextLevelName ?? "—",
    balance: m.balance,
    shiftsCompleted: m.shiftsCompleted,
    shiftsRequired: m.shiftsRequired,
    shiftsRemaining: Math.max(0, m.shiftsRequired - m.shiftsCompleted),
    avatarUrl: m.avatarUrl ?? undefined,
    strikesCount: m.strikesCount,
    strikesThreshold: m.strikesThreshold,
  }
}

function mapType(t: string): "shift" | "bonus" | "quest" | "redemption" {
  if (t === "shift" || t === "bonus" || t === "quest" || t === "redemption") return t
  return "bonus"
}

function formatTransactionDate(iso: string): string {
  const d = new Date(iso)
  if (isToday(d)) return "Сегодня"
  if (isYesterday(d)) return "Вчера"
  return format(d, "d MMM", { locale: ru })
}

function mapTransaction(t: TransactionResponse): EarningEntry {
  const isRedemption = t.type === "redemption"
  return {
    id: String(t.id),
    title: t.title ?? (isRedemption ? "Покупка в магазине" : "Начисление"),
    location: t.location ?? "—",
    date: formatTransactionDate(t.createdAt),
    amount: t.amount,
    type: mapType(t.type),
  }
}

const questIconMap: Record<string, Quest["icon"]> = {
  streak: "streak",
  target: "target",
  calendar: "calendar",
  trophy: "trophy",
}

function mapQuest(q: QuestResponse): Quest {
  return {
    id: String(q.id),
    title: q.name,
    description: q.description ?? "",
    progress: q.progress,
    total: q.total,
    reward: q.reward,
    icon: questIconMap[q.icon] ?? "target",
    completed: q.completed,
    period: q.period === "daily" ? "daily" : "weekly",
  }
}

const storeIconMap: Record<string, StoreItem["icon"]> = {
  discount: "discount",
  booster: "booster",
  merch: "merch",
  gift: "gift",
}

function mapStoreItem(s: StoreItemResponse): StoreItem & { numericId: number } {
  return {
    id: String(s.id),
    numericId: s.id,
    name: s.name,
    description: s.description ?? "",
    cost: s.cost,
    icon: storeIconMap[s.icon] ?? "gift",
    category: s.category,
    stockLimit: s.stockLimit ?? undefined,
    redeemedCount: s.redeemedCount ?? 0,
  }
}

export interface UseRewardsDashboardResult {
  user: DashboardUser | null
  transactions: EarningEntry[]
  quests: Quest[]
  storeItems: (StoreItem & { numericId: number })[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  purchaseItem: (storeItemId: number) => Promise<void>
  /** Выход (dev): сброс токена и повторная загрузка (по ?userId= или повторный dev-login) */
  logout: () => void
  isLoggedIn: boolean
}

export function useRewardsDashboard(): UseRewardsDashboardResult {
  const [user, setUser] = useState<DashboardUser | null>(null)
  const [transactions, setTransactions] = useState<EarningEntry[]>([])
  const [quests, setQuests] = useState<Quest[]>([])
  const [storeItems, setStoreItems] = useState<(StoreItem & { numericId: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [meRes, transactionsRes, questsRes, storeRes] = await Promise.all([
        fetchMe(),
        fetchTransactions(),
        fetchQuests(),
        fetchStore(),
      ])
      setUser(mapMe(meRes))
      setTransactions(transactionsRes.map(mapTransaction))
      setQuests(questsRes.map(mapQuest))
      setStoreItems(storeRes.map(mapStoreItem))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки данных")
      setUser(null)
      setTransactions([])
      setQuests([])
      setStoreItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const devId = getDevUserId()
      if (devId && !isLoggedIn()) {
        try {
          await devLogin(parseInt(devId, 10))
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Ошибка входа (dev-login)")
            setLoading(false)
          }
          return
        }
      }
      await load()
    }
    init()
    return () => {
      cancelled = true
    }
  }, [load])

  const purchaseItem = useCallback(
    async (storeItemId: number) => {
      await apiCreateRedemption(storeItemId)
      await load()
    },
    [load]
  )

  const logout = useCallback(() => {
    clearToken()
    void load()
  }, [load])

  return {
    user,
    transactions,
    quests,
    storeItems,
    loading,
    error,
    refetch: load,
    purchaseItem,
    logout,
    isLoggedIn: isLoggedIn(),
  }
}

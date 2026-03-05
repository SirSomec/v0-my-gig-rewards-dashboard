"use client"

import { useState, useEffect, useCallback } from "react"
import {
  fetchMe,
  fetchTransactions,
  fetchStrikes,
  fetchQuests,
  fetchStore,
  fetchLevels,
  createRedemption as apiCreateRedemption,
  devLogin,
  getDevUserId,
  isLoggedIn,
  clearToken,
  type MeResponse,
  type TransactionResponse,
  type StrikeResponse,
  type QuestResponse,
  type StoreItemResponse,
  type LevelResponse,
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
  strikesCountWeek: number
  strikesCountMonth: number
  strikesLimitPerWeek: number | null
  strikesLimitPerMonth: number | null
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
    strikesCountWeek: m.strikesCountWeek ?? 0,
    strikesCountMonth: m.strikesCountMonth ?? 0,
    strikesLimitPerWeek: m.strikesLimitPerWeek ?? null,
    strikesLimitPerMonth: m.strikesLimitPerMonth ?? null,
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

function mapTransaction(t: TransactionResponse): EarningEntry & { _sortAt?: string } {
  const isRedemption = t.type === "redemption"
  return {
    id: `tx-${t.id}`,
    title: t.title ?? (isRedemption ? "Покупка в магазине" : "Начисление"),
    location: t.location ?? "—",
    date: formatTransactionDate(t.createdAt),
    amount: t.amount,
    type: mapType(t.type),
    _sortAt: t.createdAt,
  }
}

function mapStrike(s: StrikeResponse): EarningEntry & { _sortAt?: string } {
  const typeLabel = s.type === "no_show" ? "Прогул" : s.type === "late_cancel" ? "Поздняя отмена" : s.type
  const shiftPart = s.shiftExternalId ? ` (смена #${s.shiftExternalId})` : ""
  return {
    id: `strike-${s.id}`,
    title: `Штраф: ${typeLabel}${shiftPart}`,
    location: "—",
    date: formatTransactionDate(s.occurredAt),
    amount: 0,
    type: "strike",
    shiftExternalId: s.shiftExternalId,
    _sortAt: s.occurredAt,
  }
}

function mergeAndSortHistory(
  txEntries: (EarningEntry & { _sortAt?: string })[],
  strikeEntries: (EarningEntry & { _sortAt?: string })[]
): EarningEntry[] {
  const merged = [...txEntries, ...strikeEntries]
  merged.sort((a, b) => {
    const tA = a._sortAt ? new Date(a._sortAt).getTime() : 0
    const tB = b._sortAt ? new Date(b._sortAt).getTime() : 0
    return tB - tA
  })
  return merged.map(({ _sortAt: _, ...e }) => e)
}

const questIconMap: Record<string, Quest["icon"]> = {
  streak: "streak",
  target: "target",
  calendar: "calendar",
  trophy: "trophy",
}

function mapQuest(q: QuestResponse): Quest {
  const period =
    q.period === "daily"
      ? "daily"
      : q.period === "weekly"
        ? "weekly"
        : q.period === "monthly"
          ? "monthly"
          : "daily";
  return {
    id: String(q.id),
    title: q.name,
    description: q.description ?? "",
    progress: q.progress,
    total: q.total,
    reward: q.reward,
    icon: questIconMap[q.icon] ?? "target",
    completed: q.completed,
    period,
    isOneTime: q.isOneTime,
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
  /** Перки текущего уровня пользователя (из API уровней), синхронно с админкой */
  currentLevelPerks: Array<{ title: string; description?: string; icon?: string }>
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
  const [levels, setLevels] = useState<LevelResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [meRes, transactionsRes, strikesRes, questsRes, storeRes, levelsRes] = await Promise.all([
        fetchMe(),
        fetchTransactions(),
        fetchStrikes(),
        fetchQuests(),
        fetchStore(),
        fetchLevels(),
      ])
      setUser(mapMe(meRes))
      setLevels(levelsRes)
      const txEntries = transactionsRes.map(mapTransaction)
      const strikeEntries = strikesRes
        .filter((s) => !s.removedAt)
        .map(mapStrike)
      setTransactions(mergeAndSortHistory(txEntries, strikeEntries))
      setQuests(questsRes.map(mapQuest))
      setStoreItems(storeRes.map(mapStoreItem))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки данных")
      setUser(null)
      setTransactions([])
      setQuests([])
      setStoreItems([])
      setLevels([])
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

  const currentLevelPerks =
    user && levels.length > 0
      ? (levels.find((l) => l.name === user.level)?.perks ?? [])
      : []

  return {
    user,
    transactions,
    quests,
    storeItems,
    currentLevelPerks,
    loading,
    error,
    refetch: load,
    purchaseItem,
    logout,
    isLoggedIn: isLoggedIn(),
  }
}

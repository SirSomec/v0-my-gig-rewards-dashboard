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
  clearAllAuth,
  setViewAsUserId,
  type MeResponse,
  type TransactionResponse,
  type StrikeResponse,
  type QuestResponse,
  type StoreItemResponse,
  type LevelResponse,
} from "@/lib/rewards-api"
import {
  isMyGigAuthEnabled,
} from "@/lib/mygig-auth"
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
  /** Порог смен текущего уровня */
  shiftsRequired: number
  /** Порог смен следующего уровня (для перехода). null = максимальный уровень */
  nextLevelShiftsRequired: number | null
  /** Сколько ещё смен до перехода на следующий уровень */
  shiftsRemaining: number
  avatarUrl?: string
  strikesCountWeek: number
  strikesCountMonth: number
  strikesLimitPerWeek: number | null
  strikesLimitPerMonth: number | null
  /** true, если новые квесты ограничены до конца месяца (достигнут порог бонусов) */
  questsLimitedByCap?: boolean
}

function mapMe(m: MeResponse): DashboardUser {
  const nextTarget = m.nextLevelShiftsRequired ?? null
  const shiftsRemaining = nextTarget != null ? Math.max(0, nextTarget - m.shiftsCompleted) : 0
  return {
    name: m.name ?? "Пользователь",
    level: m.levelName,
    nextLevel: m.nextLevelName ?? "—",
    balance: m.balance,
    shiftsCompleted: m.shiftsCompleted,
    shiftsRequired: m.shiftsRequired,
    nextLevelShiftsRequired: nextTarget,
    shiftsRemaining,
    avatarUrl: m.avatarUrl ?? undefined,
    strikesCountWeek: m.strikesCountWeek ?? 0,
    strikesCountMonth: m.strikesCountMonth ?? 0,
    strikesLimitPerWeek: m.strikesLimitPerWeek ?? null,
    strikesLimitPerMonth: m.strikesLimitPerMonth ?? null,
    questsLimitedByCap: m.questsLimitedByCap ?? false,
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
  /** Выход: сброс токена и всех учётных данных на устройстве, сброс состояния дашборда. */
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

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setError(null)
      setLoading(true)
    }
    try {
      const meRes: MeResponse = await fetchMe()
      const [transactionsRes, strikesRes, questsRes, storeRes, levelsRes] = await Promise.all([
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
      if (!silent) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки данных")
        setUser(null)
        setTransactions([])
        setQuests([])
        setStoreItems([])
        setLevels([])
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const myGigEnabled = isMyGigAuthEnabled()
      if (myGigEnabled && !isLoggedIn()) {
        setLoading(false)
        return
      }
      // Переход из админки «Сменить»: ?userId= в URL — сохраняем в localStorage и делаем dev-login; только если MyGig не используется
      if (typeof window !== "undefined" && !myGigEnabled) {
        const params = new URLSearchParams(window.location.search)
        const userIdFromUrl = params.get("userId")
        if (userIdFromUrl != null && userIdFromUrl !== "") {
          const id = parseInt(userIdFromUrl, 10)
          if (!Number.isNaN(id) && id >= 1) {
            try {
              await devLogin(id)
              setViewAsUserId(id)
              window.history.replaceState({}, "", window.location.pathname)
            } catch (e) {
              if (!cancelled) {
                setError(e instanceof Error ? e.message : "Ошибка входа (dev-login)")
                setLoading(false)
              }
              return
            }
          }
        }
      }
      // При обычной загрузке/обновлении: если нет токена, но сохранён «кабинет от имени» — входим под ним (только без MyGig)
      if (!myGigEnabled) {
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
      }
      await load()
    }
    init()
    return () => {
      cancelled = true
    }
  }, [load])

  // Автообновление при возврате на вкладку (активность в другом окне/табе или возврат в приложение)
  useEffect(() => {
    if (typeof document === "undefined") return
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void load(true)
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [load])

  // Периодическое обновление данных, пока вкладка видима (каждые 60 сек), чтобы подхватывать внешнюю активность
  useEffect(() => {
    if (typeof document === "undefined") return
    const REFRESH_INTERVAL_MS = 60_000
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(true)
      }
    }, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [load])

  const purchaseItem = useCallback(
    async (storeItemId: number) => {
      await apiCreateRedemption(storeItemId)
      await load()
    },
    [load]
  )

  const logout = useCallback(() => {
    clearAllAuth()
    setUser(null)
    setTransactions([])
    setQuests([])
    setStoreItems([])
    setLevels([])
    setError(null)
    setLoading(false)
  }, [])

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

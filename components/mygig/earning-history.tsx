"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Briefcase, MapPin, AlertTriangle, ArrowUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { GigCoinIcon } from "./gig-coin-icon"

export interface EarningEntry {
  id: string
  title: string
  location: string
  date: string
  /** Сумма с знаком: положительная — начисление, отрицательная — списание (покупка). Для штрафа не используется */
  amount: number
  type: "shift" | "bonus" | "quest" | "redemption" | "strike"
  /** Для type=strike: ID смены, за которую получен штраф */
  shiftExternalId?: string | null
}

const INITIAL_PAGE_SIZE = 20
const LOAD_MORE_SIZE = 10
const SCROLL_TO_TOP_THRESHOLD = 200

interface EarningHistoryProps {
  entries: EarningEntry[]
  /** Режим полной истории: начальная выборка и подгрузка по скроллу */
  initialPageSize?: number
  loadMoreSize?: number
  /** Заголовок блока (для вкладки «История» можно другой) */
  title?: string
  /** Показывать ли кнопку «Все» (на главной — да, на вкладке История — нет) */
  showViewAll?: boolean
  /** Колбэк при нажатии на «Все» (переход на вкладку История) */
  onViewAllClick?: () => void
}

export function EarningHistory({
  entries,
  initialPageSize,
  loadMoreSize = LOAD_MORE_SIZE,
  title = "Последняя активность",
  showViewAll = true,
  onViewAllClick,
}: EarningHistoryProps) {
  const isPaginated = initialPageSize != null && initialPageSize > 0
  const [visibleCount, setVisibleCount] = useState(() =>
    isPaginated ? Math.min(initialPageSize, entries.length) : entries.length
  )
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const visibleEntries = entries.slice(0, visibleCount)
  const hasMore = isPaginated && visibleCount < entries.length

  // Сброс видимой выборки при смене списка entries (например, при переключении вкладки)
  useEffect(() => {
    if (isPaginated) {
      setVisibleCount(Math.min(initialPageSize!, entries.length))
    } else {
      setVisibleCount(entries.length)
    }
  }, [entries.length, initialPageSize, isPaginated])

  // Подгрузка по скроллу: IntersectionObserver на sentinel внизу списка
  useEffect(() => {
    if (!hasMore || !sentinelRef.current || !scrollRef.current) return
    const el = sentinelRef.current
    const root = scrollRef.current
    const observer = new IntersectionObserver(
      (e) => {
        if (e[0]?.isIntersecting)
          setVisibleCount((n) => Math.min(n + (loadMoreSize ?? LOAD_MORE_SIZE), entries.length))
      },
      { root, rootMargin: "100px", threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, entries.length, loadMoreSize])

  // Показ кнопки «Вверх» при прокрутке вниз
  useEffect(() => {
    if (!isPaginated || !scrollRef.current) return
    const root = scrollRef.current
    const onScroll = () => {
      setShowScrollToTop(root.scrollTop > SCROLL_TO_TOP_THRESHOLD)
    }
    root.addEventListener("scroll", onScroll, { passive: true })
    return () => root.removeEventListener("scroll", onScroll)
  }, [isPaginated])

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const listContent = (
    <div className="flex flex-col gap-1.5 sm:gap-2">
      {visibleEntries.map((entry, i) => (
        <motion.div
          key={entry.id}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: Math.min(i * 0.08, 0.5) }}
          className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl ${entry.type === "strike" ? "bg-destructive/10" : "bg-secondary/40"}`}
        >
          <div className={`flex-shrink-0 p-1.5 sm:p-2 rounded-lg ${entry.type === "strike" ? "bg-destructive/20 text-destructive" : "bg-accent/15 text-accent"}`}>
            {entry.type === "strike" ? <AlertTriangle size={18} /> : <Briefcase size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs sm:text-sm font-medium truncate ${entry.type === "strike" ? "text-destructive" : "text-foreground"}`}>{entry.title}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin size={10} className="text-muted-foreground flex-shrink-0" />
              <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{entry.location}</span>
              <span className="text-[11px] text-muted-foreground/50 mx-1">{"/"}</span>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground">{entry.date}</span>
            </div>
          </div>
          {entry.type !== "strike" && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <GigCoinIcon size={14} />
              <span
                className={
                  entry.amount < 0
                    ? "text-xs sm:text-sm font-bold text-destructive tabular-nums"
                    : "text-xs sm:text-sm font-bold text-success tabular-nums"
                }
              >
                {entry.amount >= 0 ? `+${entry.amount}` : entry.amount}
              </span>
            </div>
          )}
        </motion.div>
      ))}
      {isPaginated && hasMore && <div ref={sentinelRef} className="h-2 flex-shrink-0" aria-hidden />}
    </div>
  )

  return (
    <Card className="bg-card border-border relative">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <h2 className="text-xs sm:text-sm font-semibold text-foreground">{title}</h2>
          {showViewAll && (
            <button
              type="button"
              onClick={onViewAllClick}
              className="text-xs text-accent hover:text-accent/80 font-medium transition-colors"
            >
              Все
            </button>
          )}
        </div>

        {isPaginated ? (
          <div
            ref={scrollRef}
            className="overflow-y-auto max-h-[55vh] sm:max-h-[65vh] -mx-1 px-1 scroll-smooth relative"
            style={{ scrollBehavior: "smooth" }}
          >
            {listContent}
          </div>
        ) : (
          listContent
        )}

        <AnimatePresence>
          {isPaginated && showScrollToTop && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={scrollToTop}
              className="absolute bottom-16 right-4 sm:bottom-20 sm:right-6 z-10 p-2 sm:p-2.5 rounded-full bg-accent text-accent-foreground shadow-lg hover:bg-accent/90 transition-colors"
              aria-label="В начало списка"
            >
              <ArrowUp size={20} />
            </motion.button>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

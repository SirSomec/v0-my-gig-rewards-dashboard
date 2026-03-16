"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { motion } from "framer-motion"
import {
  ShoppingBag,
  Percent,
  Rocket,
  Gift,
  Clock3,
  CircleCheckBig,
  CircleX,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GigCoinIcon } from "./gig-coin-icon"

function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: "discount" | "booster" | "merch" | "gift";
  category: string;
  /** Для вызова API обмена (опционально) */
  numericId?: number;
  /** Общий лимит тиража (null = без лимита) */
  stockLimit?: number | null;
  /** Сколько уже выкуплено (pending + fulfilled) */
  redeemedCount?: number;
}

export interface StoreRedemption {
  id: string
  numericId: number
  storeItemId: number
  itemName: string
  itemCategory: string
  itemIcon: StoreItem["icon"]
  status: "pending" | "fulfilled" | "cancelled"
  coinsSpent: number
  createdAt: string
  processedAt: string | null
  notes: string | null
}

const iconMap = {
  discount: Percent,
  booster: Rocket,
  merch: ShoppingBag,
  gift: Gift,
}

const statusMap = {
  pending: {
    label: "В обработке",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    Icon: Clock3,
  },
  fulfilled: {
    label: "Выполнено",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    Icon: CircleCheckBig,
  },
  cancelled: {
    label: "Отменено",
    className: "bg-destructive/10 text-destructive",
    Icon: CircleX,
  },
} as const

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Дата неизвестна"
  return format(d, "d MMM yyyy, HH:mm", { locale: ru })
}

interface RedemptionStoreProps {
  items: StoreItem[]
  redemptions: StoreRedemption[]
  userBalance: number
  /** Вызов при нажатии «Купить»; после успешного обмена баланс обновится через refetch */
  onPurchase?: (storeItemId: number) => Promise<void>
  /** ID товара, по которому идёт запрос обмена (для блокировки кнопки) */
  purchasingId?: number | null
}

export function RedemptionStore({
  items,
  redemptions,
  userBalance,
  onPurchase,
  purchasingId,
}: RedemptionStoreProps) {
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const busy = loadingId ?? purchasingId ?? null

  const handleBuy = async (item: StoreItem) => {
    const id = item.numericId ?? parseInt(item.id, 10)
    if (Number.isNaN(id) || !onPurchase) return
    setLoadingId(id)
    try {
      await onPurchase(id)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <h2 className="text-xs sm:text-sm font-semibold text-foreground">Магазин наград</h2>
          <div className="flex items-center gap-1">
            <GigCoinIcon size={14} />
            <span className="text-xs font-semibold text-coin-foreground tabular-nums">
              {formatNumber(userBalance)}
            </span>
          </div>
        </div>

        <Tabs defaultValue="catalog" className="gap-3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="catalog">Товары</TabsTrigger>
            <TabsTrigger value="purchases">Мои покупки</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog">
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Товары пока не добавлены.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {items.map((item, i) => {
                  const Icon = iconMap[item.icon]
                  const inStock =
                    item.stockLimit == null || (item.redeemedCount ?? 0) < item.stockLimit
                  const canAfford = userBalance >= item.cost
                  const canBuy = inStock && canAfford

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: i * 0.08 }}
                      className={`flex flex-col p-2.5 sm:p-3 bg-muted rounded-xl border border-border hover:border-primary/20 transition-colors ${!inStock ? "opacity-75" : ""}`}
                    >
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                        <div className="p-1 sm:p-1.5 rounded-lg bg-accent/15 text-accent shrink-0">
                          <Icon size={16} />
                        </div>
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs font-semibold text-foreground leading-tight mb-0.5">{item.name}</p>
                      <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-snug mb-1.5 sm:mb-2 flex-1 min-h-0 line-clamp-2">{item.description}</p>
                      {item.stockLimit != null && (
                        <p className="text-[9px] sm:text-[10px] text-muted-foreground mb-1.5 sm:mb-2">
                          {inStock
                            ? `Осталось: ${item.stockLimit - (item.redeemedCount ?? 0)} из ${item.stockLimit}`
                            : "Нет в наличии"}
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant={canBuy ? "default" : "secondary"}
                        disabled={!canBuy || busy !== null}
                        className={`w-full h-6 sm:h-7 text-[10px] sm:text-[11px] font-semibold rounded-lg ${
                          canBuy
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-secondary text-muted-foreground"
                        }`}
                        onClick={() => canBuy && (item.numericId ?? item.id) && handleBuy(item)}
                      >
                        {busy === (item.numericId ?? parseInt(item.id, 10)) ? (
                          <span className="animate-pulse">...</span>
                        ) : !inStock ? (
                          "Нет в наличии"
                        ) : (
                          <>
                            <GigCoinIcon size={12} />
                            <span className="ml-0.5 sm:ml-1">{item.cost}</span>
                          </>
                        )}
                      </Button>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="purchases">
            {redemptions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                У вас пока нет покупок в магазине.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {redemptions.map((redemption, index) => {
                  const Icon = iconMap[redemption.itemIcon]
                  const status = statusMap[redemption.status]
                  const StatusIcon = status.Icon

                  return (
                    <motion.div
                      key={redemption.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      className="rounded-xl border border-border bg-muted p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <div className="p-1.5 rounded-lg bg-accent/15 text-accent shrink-0">
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {redemption.itemName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {redemption.itemCategory} · {formatDateTime(redemption.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <GigCoinIcon size={12} />
                          <span className="text-xs font-semibold tabular-nums">
                            {formatNumber(redemption.coinsSpent)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] sm:text-xs font-medium ${status.className}`}>
                          <StatusIcon size={12} />
                          {status.label}
                        </span>
                        {redemption.processedAt && (
                          <span className="text-[10px] sm:text-xs text-muted-foreground text-right">
                            Обновлено: {formatDateTime(redemption.processedAt)}
                          </span>
                        )}
                      </div>

                      {redemption.notes && (
                        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                          {redemption.notes}
                        </p>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

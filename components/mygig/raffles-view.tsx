"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { Ticket, Trophy, Users, Clock3 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GigCoinIcon } from "./gig-coin-icon"
import type { DashboardMyRaffleEntry, DashboardRaffle } from "@/hooks/use-rewards-dashboard"

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Дата неизвестна"
  return format(date, "d MMM yyyy, HH:mm", { locale: ru })
}

const statusLabel: Record<DashboardRaffle["status"], string> = {
  draft: "Черновик",
  active: "Активен",
  drawing: "Идет выбор победителей",
  completed: "Завершен",
  completed_without_entries: "Завершен без участников",
  cancelled: "Отменен",
}

interface RafflesViewProps {
  raffles: DashboardRaffle[]
  myRaffles: DashboardMyRaffleEntry[]
  userBalance: number
  onPurchase: (raffleId: number, quantity?: number) => Promise<void>
}

export function RafflesView({ raffles, myRaffles, userBalance, onPurchase }: RafflesViewProps) {
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activeRaffles = useMemo(
    () => raffles.filter((raffle) => raffle.status === "active" || raffle.status === "drawing"),
    [raffles]
  )
  const completedRaffles = useMemo(
    () => raffles.filter((raffle) => raffle.status === "completed" || raffle.status === "completed_without_entries"),
    [raffles]
  )

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <h2 className="text-xs sm:text-sm font-semibold text-foreground">Розыгрыши</h2>
          <div className="flex items-center gap-1">
            <GigCoinIcon size={14} />
            <span className="text-xs font-semibold text-coin-foreground tabular-nums">{userBalance}</span>
          </div>
        </div>

        <Tabs defaultValue="active" className="gap-3">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">Активные</TabsTrigger>
            <TabsTrigger value="mine">Мои билеты</TabsTrigger>
            <TabsTrigger value="completed">Архив</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-2">
            {activeRaffles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Сейчас нет активных розыгрышей.
              </div>
            ) : (
              activeRaffles.map((raffle) => {
                const now = Date.now()
                const startsAtMs = new Date(raffle.startsAt).getTime()
                const endsAtMs = new Date(raffle.endsAt).getTime()
                const notStarted = Number.isFinite(startsAtMs) && now < startsAtMs
                const alreadyEnded = Number.isFinite(endsAtMs) && now > endsAtMs
                const canAfford = userBalance >= raffle.ticketPrice
                const limitReached =
                  raffle.maxTicketsPerUser != null && raffle.myTicketsCount >= raffle.maxTicketsPerUser
                const canBuy = raffle.status === "active" && !notStarted && !alreadyEnded && canAfford && !limitReached

                return (
                  <div key={raffle.id} className="rounded-xl border border-border bg-muted p-3 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{raffle.title}</p>
                          <p className="text-xs text-muted-foreground">{raffle.description}</p>
                        </div>
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                          {statusLabel[raffle.status]}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Clock3 size={12} /> До {formatDateTime(raffle.endsAt)}</span>
                        <span className="inline-flex items-center gap-1"><Users size={12} /> Билетов: {raffle.totalTickets}</span>
                        <span className="inline-flex items-center gap-1"><Ticket size={12} /> Моих: {raffle.myTicketsCount}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground">Призы</p>
                      <div className="space-y-2">
                        {raffle.prizes.map((prize) => (
                          <div key={prize.id} className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 text-xs">
                            <div className="flex items-center gap-3 min-w-0">
                              {prize.imageUrl ? (
                                <img
                                  src={prize.imageUrl}
                                  alt={prize.title}
                                  className="h-12 w-12 rounded-md object-cover border border-border shrink-0"
                                />
                              ) : null}
                              <span className="truncate">{prize.title}</span>
                            </div>
                            <span className="text-muted-foreground shrink-0">x{prize.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      disabled={!canBuy || loadingId !== null}
                      onClick={async () => {
                        setError(null)
                        setLoadingId(raffle.id)
                        try {
                          await onPurchase(raffle.id, 1)
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Не удалось купить билет")
                        } finally {
                          setLoadingId(null)
                        }
                      }}
                    >
                      {loadingId === raffle.id ? "Покупаем..." : (
                        <>
                          <GigCoinIcon size={14} />
                          <span className="ml-1">Купить билет за {raffle.ticketPrice}</span>
                        </>
                      )}
                    </Button>
                    {!canAfford && (
                      <p className="text-[11px] text-muted-foreground">Недостаточно монет для покупки билета.</p>
                    )}
                    {notStarted && (
                      <p className="text-[11px] text-muted-foreground">
                        Розыгрыш еще не начался. Старт: {formatDateTime(raffle.startsAt)}.
                      </p>
                    )}
                    {alreadyEnded && (
                      <p className="text-[11px] text-muted-foreground">
                        Время покупки билетов уже закончилось.
                      </p>
                    )}
                    {limitReached && (
                      <p className="text-[11px] text-muted-foreground">Вы достигли лимита билетов на этот розыгрыш.</p>
                    )}
                  </div>
                )
              })
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </TabsContent>

          <TabsContent value="mine" className="space-y-2">
            {myRaffles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                У вас пока нет билетов в розыгрышах.
              </div>
            ) : (
              myRaffles.map((entry) => (
                <div key={entry.raffleId} className="rounded-xl border border-border bg-muted p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{entry.raffleTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {statusLabel[entry.status]} · до {formatDateTime(entry.endsAt)}
                      </p>
                    </div>
                    {entry.isWinner && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        <Trophy size={12} />
                        Вы выиграли
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground">
                    Билетов: {entry.ticketsCount} · Номера: {entry.ticketNumbers.join(", ")}
                  </p>
                  {entry.winners.length > 0 && (
                    <div className="space-y-1">
                      {entry.winners.map((winner) => (
                        <div key={winner.id} className="rounded-lg bg-background px-3 py-2 text-xs">
                          {winner.prizeTitle}: {winner.userName ?? `#${winner.userId}`} (билет #{winner.ticketNumber})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-2">
            {completedRaffles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Завершенных розыгрышей пока нет.
              </div>
            ) : (
              completedRaffles.map((raffle) => (
                <div key={raffle.id} className="rounded-xl border border-border bg-muted p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{raffle.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {statusLabel[raffle.status]} · завершен {formatDateTime(raffle.completedAt ?? raffle.endsAt)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">Билетов: {raffle.totalTickets}</span>
                  </div>
                  {raffle.winners.length > 0 ? (
                    <div className="space-y-1">
                      {raffle.winners.map((winner) => (
                        <div key={winner.id} className="rounded-lg bg-background px-3 py-2 text-xs">
                          {winner.prizeTitle}: {winner.userName ?? `#${winner.userId}`} (билет #{winner.ticketNumber})
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">В этом розыгрыше не было участников.</p>
                  )}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

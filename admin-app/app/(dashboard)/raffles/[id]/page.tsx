"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { adminDrawRaffle, adminGetRaffle, type AdminRaffleDetail } from "@/lib/admin-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminRaffleDetailPage() {
  const params = useParams<{ id: string }>()
  const raffleId = Number(params.id)
  const [raffle, setRaffle] = useState<AdminRaffleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!Number.isFinite(raffleId)) return
    setLoading(true)
    adminGetRaffle(raffleId)
      .then(setRaffle)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false))
  }, [raffleId])

  if (loading) {
    return <Skeleton className="h-48 w-full rounded-lg" />
  }

  if (!raffle) {
    return <p className="text-sm text-destructive">{error ?? "Розыгрыш не найден"}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{raffle.title}</h1>
          <p className="text-sm text-muted-foreground">
            Статус: {raffle.status} · билетов: {raffle.totalTickets} · участников: {raffle.uniqueParticipants}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/raffles">Назад</Link>
          </Button>
          <Button
            disabled={raffle.status === "completed" || raffle.status === "completed_without_entries"}
            onClick={async () => {
              try {
                await adminDrawRaffle(raffle.id)
                const updated = await adminGetRaffle(raffle.id)
                setRaffle(updated)
              } catch (e) {
                setError(e instanceof Error ? e.message : "Ошибка")
              }
            }}
          >
            Завершить розыгрыш
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm"><span className="font-medium">Описание:</span> {raffle.description || "—"}</p>
          <p className="text-sm"><span className="font-medium">Период:</span> {raffle.startsAt} - {raffle.endsAt}</p>
          <p className="text-sm"><span className="font-medium">Цена билета:</span> {raffle.ticketPrice}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="font-medium">Призы</h2>
          {raffle.prizes.map((prize) => (
            <div key={prize.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              {prize.title} · x{prize.quantity}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="font-medium">Победители</h2>
          {raffle.winners.length === 0 ? (
            <p className="text-sm text-muted-foreground">Победители еще не определены.</p>
          ) : (
            raffle.winners.map((winner) => (
              <div key={winner.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                {winner.prizeTitle}: {winner.userName ?? `#${winner.userId}`} (билет #{winner.ticketNumber})
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="font-medium">Участники</h2>
          {raffle.participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Участников пока нет.</p>
          ) : (
            raffle.participants.map((participant) => (
              <div key={participant.userId} className="rounded-lg border border-border px-3 py-2 text-sm">
                {participant.userName ?? `#${participant.userId}`} · билетов {participant.ticketsCount} · номера {participant.ticketNumbers.join(", ")}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

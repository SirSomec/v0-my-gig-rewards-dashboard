"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  adminDownloadRaffleTicketsExcel,
  adminDrawRaffle,
  adminGetRaffle,
  adminListRaffleTicketsForDraw,
  adminSubmitManualRaffleWinners,
  type AdminRaffleDetail,
  type AdminRaffleTicketForDraw,
} from "@/lib/admin-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function buildPrizeSlots(prizes: AdminRaffleDetail["prizes"]) {
  const sorted = [...prizes].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id,
  )
  const out: { prizeId: number; prizeTitle: string }[] = []
  for (const p of sorted) {
    for (let q = 0; q < p.quantity; q++) {
      out.push({ prizeId: p.id, prizeTitle: p.title })
    }
  }
  return out
}

export default function AdminRaffleDetailPage() {
  const params = useParams<{ id: string }>()
  const raffleId = Number(params.id)
  const [raffle, setRaffle] = useState<AdminRaffleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tickets, setTickets] = useState<AdminRaffleTicketForDraw[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [manualTicketIds, setManualTicketIds] = useState<number[]>([])
  const [manualSaving, setManualSaving] = useState(false)
  const [exportingTickets, setExportingTickets] = useState(false)

  const reload = useCallback(async () => {
    const updated = await adminGetRaffle(raffleId)
    setRaffle(updated)
    return updated
  }, [raffleId])

  useEffect(() => {
    if (!Number.isFinite(raffleId)) return
    setLoading(true)
    adminGetRaffle(raffleId)
      .then(setRaffle)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false))
  }, [raffleId])

  const prizeSlots = useMemo(
    () => (raffle ? buildPrizeSlots(raffle.prizes) : []),
    [raffle],
  )

  useEffect(() => {
    setManualTicketIds(Array(prizeSlots.length).fill(0))
  }, [prizeSlots.length, raffleId, raffle?.status])

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true)
    try {
      const { tickets: list } = await adminListRaffleTicketsForDraw(raffleId)
      setTickets(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить билеты")
    } finally {
      setTicketsLoading(false)
    }
  }, [raffleId])

  useEffect(() => {
    if (
      !raffle ||
      raffle.winnerSelectionMode !== "manual" ||
      raffle.status !== "drawing" ||
      raffle.winners.length > 0
    ) {
      return
    }
    void loadTickets()
  }, [raffle, loadTickets])

  const ticketsForSlot = useCallback(
    (slotIndex: number) => {
      const picked = new Set(
        manualTicketIds
          .map((id, j) => (j !== slotIndex && id > 0 ? id : null))
          .filter((id): id is number => id != null),
      )
      return tickets.filter((t) => !picked.has(t.ticketId))
    },
    [tickets, manualTicketIds],
  )

  const raffleEnded =
    raffle != null && new Date(raffle.endsAt).getTime() <= Date.now()

  const showAutoDrawButton =
    raffle != null &&
    raffle.winnerSelectionMode === "random" &&
    raffle.status !== "cancelled" &&
    raffle.status !== "completed" &&
    raffle.status !== "completed_without_entries"

  const showManualAdvanceButton =
    raffle != null &&
    raffle.winnerSelectionMode === "manual" &&
    raffle.status === "active" &&
    raffleEnded

  const showManualWinnerForm =
    raffle != null &&
    raffle.winnerSelectionMode === "manual" &&
    raffle.status === "drawing" &&
    raffle.winners.length === 0 &&
    prizeSlots.length > 0

  const manualSelectionsComplete =
    prizeSlots.length > 0 && manualTicketIds.every((id) => id > 0)

  const submitManualWinners = async () => {
    if (!raffle || !manualSelectionsComplete) return
    setManualSaving(true)
    setError(null)
    try {
      const assignments = prizeSlots.map((slot, i) => ({
        prizeId: slot.prizeId,
        ticketId: manualTicketIds[i]!,
      }))
      await adminSubmitManualRaffleWinners(raffle.id, assignments)
      await reload()
      setTickets([])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setManualSaving(false)
    }
  }

  if (loading) {
    return <Skeleton className="h-48 w-full rounded-lg" />
  }

  if (!raffle) {
    return <p className="text-sm text-destructive">{error ?? "Розыгрыш не найден"}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">{raffle.title}</h1>
          <p className="text-sm text-muted-foreground">
            Статус: {raffle.status} · билетов: {raffle.totalTickets} · участников:{" "}
            {raffle.uniqueParticipants}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/raffles">Назад</Link>
          </Button>
          <Button
            variant="outline"
            disabled={exportingTickets}
            onClick={() => {
              setExportingTickets(true)
              setError(null)
              adminDownloadRaffleTicketsExcel(raffle.id)
                .catch((e) =>
                  setError(e instanceof Error ? e.message : "Не удалось скачать Excel"),
                )
                .finally(() => setExportingTickets(false))
            }}
          >
            {exportingTickets ? "Скачивание…" : "Скачать билеты (Excel)"}
          </Button>
          {showAutoDrawButton && (
            <Button
              disabled={!raffleEnded}
              onClick={async () => {
                try {
                  setError(null)
                  await adminDrawRaffle(raffle.id)
                  await reload()
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Ошибка")
                }
              }}
            >
              Завершить и провести жеребьёвку
            </Button>
          )}
          {showManualAdvanceButton && (
            <Button
              onClick={async () => {
                try {
                  setError(null)
                  await adminDrawRaffle(raffle.id)
                  await reload()
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Ошибка")
                }
              }}
            >
              {raffle.totalTickets > 0
                ? "Зафиксировать окончание и выбрать победителей"
                : "Завершить без участников"}
            </Button>
          )}
        </div>
      </div>

      {!raffleEnded && (showAutoDrawButton || showManualAdvanceButton) && (
        <p className="text-sm text-muted-foreground">
          Действия завершения доступны после окончания периода приёма билетов ({raffle.endsAt}).
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm">
            <span className="font-medium">Описание:</span> {raffle.description || "—"}
          </p>
          <p className="text-sm">
            <span className="font-medium">Период:</span> {raffle.startsAt} - {raffle.endsAt}
          </p>
          <p className="text-sm">
            <span className="font-medium">Цена билета:</span> {raffle.ticketPrice}
          </p>
          <p className="text-sm">
            <span className="font-medium">Лимит билетов на пользователя:</span>{" "}
            {raffle.maxTicketsPerUser != null ? raffle.maxTicketsPerUser : "нет (без ограничения)"}
          </p>
          <p className="text-sm">
            <span className="font-medium">Победители:</span>{" "}
            {raffle.winnerSelectionMode === "manual"
              ? "вручную (выбор билетов администратором)"
              : "случайная жеребьёвка"}
          </p>
        </CardContent>
      </Card>

      {showManualWinnerForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <h2 className="font-medium">Ручной выбор победителей</h2>
              <p className="text-sm text-muted-foreground">
                Для каждого выигрышного слота выберите один билет. Один билет нельзя назначить дважды.
              </p>
            </div>
            {ticketsLoading ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : (
              <div className="space-y-4">
                {prizeSlots.map((slot, index) => (
                  <div key={`${slot.prizeId}-${index}`} className="grid gap-2">
                    <Label>
                      Слот {index + 1}: {slot.prizeTitle}
                    </Label>
                    <Select
                      value={manualTicketIds[index] > 0 ? String(manualTicketIds[index]) : "__unset__"}
                      onValueChange={(v) => {
                        setManualTicketIds((prev) => {
                          const next = [...prev]
                          if (v === "__unset__") next[index] = 0
                          else {
                            const id = parseInt(v, 10)
                            next[index] = Number.isFinite(id) ? id : 0
                          }
                          return next
                        })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите билет" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unset__">Выберите билет</SelectItem>
                        {ticketsForSlot(index).map((t) => (
                          <SelectItem key={t.ticketId} value={String(t.ticketId)}>
                            №{t.ticketNumber} · {t.userName ?? `user #${t.userId}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <Button
                  disabled={!manualSelectionsComplete || manualSaving}
                  onClick={() => void submitManualWinners()}
                >
                  {manualSaving ? "Сохранение..." : "Сохранить победителей и завершить розыгрыш"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                {winner.prizeTitle}: {winner.userName ?? `#${winner.userId}`} (билет #
                {winner.ticketNumber})
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
              <div
                key={participant.userId}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                {participant.userName ?? `#${participant.userId}`} · билетов{" "}
                {participant.ticketsCount} · номера {participant.ticketNumbers.join(", ")}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

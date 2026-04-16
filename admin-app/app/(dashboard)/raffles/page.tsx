"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  adminCreateRaffle,
  adminDeleteRaffle,
  adminDrawRaffle,
  adminListRaffles,
  adminUpdateRaffle,
  type AdminRaffle,
  type CreateRaffleBody,
} from "@/lib/admin-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type RaffleForm = CreateRaffleBody & { status?: AdminRaffle["status"] }

const MAX_PRIZE_IMAGE_SIZE_BYTES = 1_500_000

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("Не удалось прочитать файл"))
    }
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"))
    reader.readAsDataURL(file)
  })
}

const emptyForm: RaffleForm = {
  title: "",
  description: "",
  status: "active",
  ticketPrice: 10,
  maxTicketsPerUser: 1,
  winnersCount: 1,
  coverImageUrl: "",
  isVisible: 1,
  startsAt: "",
  endsAt: "",
  prizes: [{ title: "", description: "", imageUrl: "", quantity: 1, sortOrder: 0 }],
}

export default function AdminRafflesPage() {
  const [items, setItems] = useState<AdminRaffle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminRaffle | null>(null)
  const [form, setForm] = useState<RaffleForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const syncWinnersCount = (prizes: RaffleForm["prizes"]) =>
    prizes.reduce((sum, prize) => sum + (Number(prize.quantity) || 0), 0)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    adminListRaffles()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (item: AdminRaffle) => {
    setEditing(item)
    setForm((prev) => ({
      ...prev,
      title: item.title,
      description: "",
      ticketPrice: item.ticketPrice,
      maxTicketsPerUser: null,
      winnersCount: item.winnersCount,
      coverImageUrl: "",
      isVisible: item.isVisible ? 1 : 0,
      startsAt: item.startsAt.slice(0, 16),
      endsAt: item.endsAt.slice(0, 16),
      status: item.status,
      prizes: [],
    }))
    setDialogOpen(true)
  }

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      if (editing) {
        await adminUpdateRaffle(editing.id, {
          ...form,
          prizes: form.prizes.length > 0 ? form.prizes : undefined,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        })
      } else {
        await adminCreateRaffle({
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
        })
      }
      setDialogOpen(false)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setSaving(false)
    }
  }

  const handlePrizeImageChange = async (index: number, file: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Можно загружать только изображения")
      return
    }
    if (file.size > MAX_PRIZE_IMAGE_SIZE_BYTES) {
      setError("Изображение слишком большое. Используйте файл до 1.5 МБ")
      return
    }
    try {
      const imageUrl = await readFileAsDataUrl(file)
      setForm((f) => ({
        ...f,
        prizes: f.prizes.map((prize, prizeIndex) =>
          prizeIndex === index ? { ...prize, imageUrl } : prize
        ),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить изображение")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Розыгрыши</h1>
        <Button onClick={openCreate}>Создать розыгрыш</Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <Link href={`/raffles/${item.id}`} className="font-medium hover:underline">
                    {item.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {item.status} · билет {item.ticketPrice} · участников {item.uniqueParticipants} · билетов {item.totalTickets}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.startsAt} - {item.endsAt}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/raffles/${item.id}`}>Открыть</Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(item)}>Изменить</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={item.status === "completed" || item.status === "completed_without_entries"}
                    onClick={async () => {
                      try {
                        await adminDrawRaffle(item.id)
                        load()
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Ошибка")
                      }
                    }}
                  >
                    Завершить
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      try {
                        await adminDeleteRaffle(item.id)
                        load()
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Ошибка")
                      }
                    }}
                  >
                    Удалить
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать розыгрыш" : "Новый розыгрыш"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="title">Название</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Описание</Label>
              <Input id="description" value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ticketPrice">Цена билета</Label>
                <Input id="ticketPrice" type="number" min={1} value={form.ticketPrice} onChange={(e) => setForm((f) => ({ ...f, ticketPrice: Number(e.target.value) || 1 }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="winnersCount">Кол-во победителей</Label>
                <Input id="winnersCount" type="number" min={1} value={form.winnersCount} onChange={(e) => setForm((f) => ({ ...f, winnersCount: Number(e.target.value) || 1 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startsAt">Начало</Label>
                <Input id="startsAt" type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endsAt">Окончание</Label>
                <Input id="endsAt" type="datetime-local" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Призы</Label>
              {form.prizes.map((prize, index) => (
                <div key={index} className="rounded-lg border border-border p-3 space-y-3">
                  <div className="grid grid-cols-[1fr_120px_40px] gap-2">
                    <Input
                      placeholder="Название приза"
                      value={prize.title}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        prizes: f.prizes.map((p, i) => i === index ? { ...p, title: e.target.value } : p),
                      }))}
                    />
                    <Input
                      type="number"
                      min={1}
                      value={prize.quantity}
                      onChange={(e) => setForm((f) => {
                        const prizes = f.prizes.map((p, i) => i === index ? { ...p, quantity: Number(e.target.value) || 1 } : p)
                        return { ...f, prizes, winnersCount: syncWinnersCount(prizes) }
                      })}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setForm((f) => {
                        const prizes = f.prizes.filter((_, i) => i !== index)
                        return { ...f, prizes, winnersCount: syncWinnersCount(prizes) }
                      })}
                      disabled={form.prizes.length === 1}
                    >
                      -
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`prize-image-${index}`}>Картинка приза</Label>
                    <Input
                      id={`prize-image-${index}`}
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handlePrizeImageChange(index, e.target.files?.[0] ?? null)}
                    />
                    {prize.imageUrl ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={prize.imageUrl}
                          alt={prize.title || `Приз ${index + 1}`}
                          className="h-16 w-16 rounded-md border border-border object-cover"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              prizes: f.prizes.map((p, i) => i === index ? { ...p, imageUrl: "" } : p),
                            }))
                          }
                        >
                          Удалить картинку
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Поддерживаются изображения до 1.5 МБ.
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm((f) => {
                  const prizes = [...f.prizes, { title: "", description: "", imageUrl: "", quantity: 1, sortOrder: f.prizes.length }]
                  return { ...f, prizes, winnersCount: syncWinnersCount(prizes) }
                })}
              >
                Добавить приз
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.isVisible} onCheckedChange={(checked) => setForm((f) => ({ ...f, isVisible: checked ? 1 : 0 }))} />
              <Label className="font-normal">Показывать пользователям</Label>
            </div>
            <div className="grid gap-2">
              <Label>Статус</Label>
              <Select value={form.status ?? (editing?.status ?? "active")} onValueChange={(value) => setForm((f) => ({ ...f, status: value as AdminRaffle["status"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["draft", "active", "cancelled"].map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import {
  adminListRedemptions,
  adminUpdateRedemption,
  type AdminRedemption,
} from "@/lib/admin-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { format } from "date-fns"

const statuses = ["pending", "fulfilled", "cancelled"] as const

export default function AdminRedemptionsPage() {
  const [items, setItems] = useState<AdminRedemption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    adminListRedemptions(statusFilter || undefined)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [statusFilter])

  const handleUpdate = (id: number, status: "fulfilled" | "cancelled", returnCoins?: boolean) => {
    setUpdatingId(id)
    adminUpdateRedemption(id, status, { returnCoins })
      .then(() => load())
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setUpdatingId(null))
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Заявки на обмен</h1>
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Все</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{r.itemName}</p>
                    <p className="text-xs text-muted-foreground">
                      User #{r.userId} · {r.coinsSpent} монет · {format(new Date(r.createdAt), "dd.MM.yyyy HH:mm")}
                    </p>
                    <p className="text-xs text-muted-foreground">Статус: {r.status}</p>
                  </div>
                  {r.status === "pending" && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={updatingId === r.id}
                        onClick={() => handleUpdate(r.id, "fulfilled")}
                      >
                        Выполнено
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updatingId === r.id}
                        onClick={() => handleUpdate(r.id, "cancelled", true)}
                      >
                        Отмена
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">Нет заявок</p>
          )}
        </div>
      )}
    </div>
  )
}

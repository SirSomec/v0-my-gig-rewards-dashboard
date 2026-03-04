"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { adminGetUser } from "@/lib/admin-api"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminUserDetailPage() {
  const params = useParams()
  const id = Number(params.id)
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (Number.isNaN(id)) return
    let cancelled = false
    setLoading(true)
    adminGetUser(id)
      .then(setData)
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  if (Number.isNaN(id)) return <p className="text-destructive">Неверный ID</p>
  if (error) return <p className="text-destructive">{error}</p>
  if (loading || !data) return <Skeleton className="h-64 w-full rounded-lg" />

  const user = data as Record<string, unknown>
  const strikes = (user.strikes as Record<string, unknown>[]) ?? []
  const recentTransactions = (user.recentTransactions as Record<string, unknown>[]) ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Пользователь #{user.id}</h1>
      <Card>
        <CardHeader className="pb-2">
          <p className="font-medium">{String(user.name ?? user.email ?? "—")}</p>
          <p className="text-xs text-muted-foreground">Email: {String(user.email ?? "—")}</p>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Баланс: <strong>{Number(user.balance)}</strong> монет</p>
          <p>Уровень: {String(user.levelName ?? "—")}</p>
          <p>Завершено смен: {Number(user.shiftsCompleted)}</p>
          <p>Штрафов за 30 дней: {Number(user.strikesCount30d ?? 0)}</p>
        </CardContent>
      </Card>
      {strikes.length > 0 && (
        <Card>
          <CardHeader className="py-2 text-sm font-medium">Штрафы</CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {strikes.map((s: Record<string, unknown>, i: number) => (
                <li key={i}>
                  {String(s.type)} — {String(s.occurredAt)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="py-2 text-sm font-medium">Последние транзакции</CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1">
            {recentTransactions.slice(0, 10).map((t: Record<string, unknown>, i: number) => (
              <li key={i}>
                {String(t.type)} {Number(t.amount) >= 0 ? "+" : ""}{Number(t.amount)} — {String(t.title ?? "")}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

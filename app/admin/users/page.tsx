"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { adminListUsers } from "@/lib/admin-api"
import type { AdminUser } from "@/lib/admin-api"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    adminListUsers(search || undefined, 50)
      .then((data) => {
        if (!cancelled) setUsers(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [search])

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Пользователи</h1>
      <Input
        placeholder="Поиск по ID, имени, email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <Link key={u.id} href={`/admin/users/${u.id}`}>
              <Card className="hover:bg-secondary/50 transition-colors">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{u.name ?? `User #${u.id}`}</p>
                    <p className="text-xs text-muted-foreground">
                      ID: {u.id} · {u.levelName ?? "—"} · {u.shiftsCompleted} смен
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">{u.balance} монет</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {users.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">Нет пользователей</p>
          )}
        </div>
      )}
    </div>
  )
}

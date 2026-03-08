"use client"

import { useState, useEffect } from "react"
import { adminListUsers } from "@/lib/admin-api"
import type { AdminUser } from "@/lib/admin-api"
import { switchDashboardToUser } from "@/lib/rewards-api"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ViewAsUser() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>("")

  useEffect(() => {
    setLoading(true)
    adminListUsers({ pageSize: 100 })
      .then((r) => setUsers(r.items))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [])

  const handleSwitchUser = () => {
    const id = selectedId ? parseInt(selectedId, 10) : 0
    if (Number.isNaN(id) || id < 1) return
    switchDashboardToUser(id)
  }

  const canSwitch = selectedId && !Number.isNaN(parseInt(selectedId, 10)) && parseInt(selectedId, 10) >= 1

  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL
  if (!dashboardUrl) return null

  return (
    <div className="space-y-2 pt-2 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground">
        Разработка: кабинет от имени
      </p>
      {loading ? (
        <p className="text-xs text-muted-foreground">Загрузка пользователей…</p>
      ) : (
        <>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className={cn(
              "w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs",
              "focus:outline-none focus:ring-2 focus:ring-ring"
            )}
            aria-label="Выберите пользователя"
          >
            <option value="">— выбрать —</option>
            {users.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.name || u.email || `ID ${u.id}`}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            onClick={handleSwitchUser}
            disabled={!canSwitch}
          >
            Сменить
          </Button>
        </>
      )}
    </div>
  )
}

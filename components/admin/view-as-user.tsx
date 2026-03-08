"use client"

import { useState, useEffect, useCallback } from "react"
import { adminListUsers } from "@/lib/admin-api"
import type { AdminUser } from "@/lib/admin-api"
import { devLogin, setViewAsUserId } from "@/lib/rewards-api"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ViewAsUserProps {
  /** После смены пользователя вызвать refetch, чтобы обновить данные кабинета */
  onSwitch: () => void
}

export function ViewAsUser({ onSwitch }: ViewAsUserProps) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>("")
  const [switching, setSwitching] = useState(false)

  const loadUsers = useCallback(() => {
    setLoading(true)
    adminListUsers({ pageSize: 100 })
      .then((r) => setUsers(r.items))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleSwitch = async () => {
    const id = selectedId ? parseInt(selectedId, 10) : 0
    if (!id || Number.isNaN(id)) return
    setSwitching(true)
    try {
      await devLogin(id)
      setViewAsUserId(id)
      onSwitch()
    } finally {
      setSwitching(false)
    }
  }

  if (!process.env.NEXT_PUBLIC_ADMIN_SECRET) return null

  return (
    <div className="px-3 py-2 bg-muted/30 border-b border-border">
      <div className="space-y-2">
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
            onClick={handleSwitch}
            disabled={!selectedId || switching}
          >
            {switching ? "…" : "Сменить"}
          </Button>
        </>
      )}
      </div>
    </div>
  )
}

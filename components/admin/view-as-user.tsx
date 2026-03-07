"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { adminListUsers } from "@/lib/admin-api"
import type { AdminUser } from "@/lib/admin-api"
import { devLogin, setViewAsUserId, getViewAsUserId, clearToken } from "@/lib/rewards-api"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ViewAsUser() {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>("")
  const [actionLoading, setActionLoading] = useState(false)
  const viewAsId = getViewAsUserId()

  const loadUsers = useCallback(() => {
    setLoading(true)
    adminListUsers(undefined, 100)
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    if (viewAsId && !selectedId) setSelectedId(viewAsId)
  }, [viewAsId, selectedId])

  const handleOpenCabinet = async () => {
    const id = selectedId ? parseInt(selectedId, 10) : 0
    if (!id || Number.isNaN(id)) return
    setActionLoading(true)
    try {
      setViewAsUserId(id)
      await devLogin(id)
      router.push("/")
    } catch {
      setActionLoading(false)
    } finally {
      setActionLoading(false)
    }
  }

  const handleClear = () => {
    setViewAsUserId(null)
    clearToken()
    setSelectedId("")
  }

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
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={handleOpenCabinet}
              disabled={!selectedId || actionLoading}
            >
              {actionLoading ? "…" : "Открыть кабинет"}
            </Button>
            {viewAsId && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground"
                onClick={handleClear}
              >
                Сбросить
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

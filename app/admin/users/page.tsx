"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  adminListUsers,
  adminGetEtlUserByExternalId,
  adminCreateUser,
} from "@/lib/admin-api"
import type { AdminUser } from "@/lib/admin-api"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [externalId, setExternalId] = useState("")
  const [firstname, setFirstname] = useState("")
  const [lastname, setLastname] = useState("")
  const [loadEtlLoading, setLoadEtlLoading] = useState(false)
  const [loadEtlError, setLoadEtlError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const loadUsers = useCallback(() => {
    setLoading(true)
    setError(null)
    adminListUsers(search || undefined, 50)
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleOpenDialog = () => {
    setDialogOpen(true)
    setExternalId("")
    setFirstname("")
    setLastname("")
    setLoadEtlError(null)
    setCreateError(null)
  }

  const handleLoadFromEtl = () => {
    const id = externalId.trim()
    if (!id) return
    setLoadEtlLoading(true)
    setLoadEtlError(null)
    adminGetEtlUserByExternalId(id)
      .then((u) => {
        setFirstname(u.firstname ?? "")
        setLastname(u.lastname ?? "")
      })
      .catch((e) => setLoadEtlError(e instanceof Error ? e.message : "Ошибка загрузки из ETL"))
      .finally(() => setLoadEtlLoading(false))
  }

  const handleCreate = () => {
    const id = externalId.trim()
    if (!id) return
    setCreateLoading(true)
    setCreateError(null)
    adminCreateUser({
      externalId: id,
      firstname: firstname.trim() || undefined,
      lastname: lastname.trim() || undefined,
    })
      .then(({ id: newId }) => {
        setDialogOpen(false)
        loadUsers()
        router.push(`/admin/users/${newId}`)
      })
      .catch((e) => setCreateError(e instanceof Error ? e.message : "Ошибка создания"))
      .finally(() => setCreateLoading(false))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Пользователи</h1>
        <Button onClick={handleOpenDialog}>Добавить пользователя</Button>
      </div>
      <Input
        placeholder="Поиск по ID, имени, email, external_id..."
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
                      ID: {u.id}
                      {u.externalId != null && u.externalId !== "" && ` · external: ${u.externalId}`}
                      {" · "}{u.levelName ?? "—"} · {u.shiftsCompleted} смен
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый пользователь</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Введите ID пользователя основной системы. Имя и фамилия подгружаются из ETL (таблица etl.mg_users) и отображаются в личном кабинете.
          </p>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="externalId">ID пользователя основной системы</Label>
              <div className="flex gap-2">
                <Input
                  id="externalId"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  placeholder="например, 12345"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleLoadFromEtl}
                  disabled={loadEtlLoading || !externalId.trim()}
                >
                  {loadEtlLoading ? "Загрузка…" : "Загрузить из ETL"}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="firstname">Имя</Label>
                <Input
                  id="firstname"
                  value={firstname}
                  onChange={(e) => setFirstname(e.target.value)}
                  placeholder="из ETL"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastname">Фамилия</Label>
                <Input
                  id="lastname"
                  value={lastname}
                  onChange={(e) => setLastname(e.target.value)}
                  placeholder="из ETL"
                />
              </div>
            </div>
            {loadEtlError && (
              <p className="text-sm text-destructive">{loadEtlError}</p>
            )}
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createLoading || !externalId.trim()}
            >
              {createLoading ? "Создание…" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

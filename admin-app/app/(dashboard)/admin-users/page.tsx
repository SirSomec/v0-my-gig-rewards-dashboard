"use client"

import { useState, useEffect, useCallback } from "react"
import {
  adminListAdminUsers,
  adminCreateAdminUser,
  adminUpdateAdminUser,
  adminDeleteAdminUser,
  adminAuthMe,
  ADMIN_PERMISSION_KEYS,
  type AdminPanelUser,
  type AdminSessionUser,
  type AdminPermissionKey,
} from "@/lib/admin-api"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const PERMISSION_LABELS: Record<AdminPermissionKey, string> = {
  overview: "Обзор",
  users: "Пользователи",
  redemptions: "Заявки на обмен",
  store: "Магазин",
  quests: "Квесты",
  user_groups: "Группы пользователей",
  quest_moderation: "Модерация квестов",
  levels: "Уровни",
  settings: "Настройки",
  balance: "Ручные начисления",
  audit: "Аудит",
  admin_users: "Пользователи админки",
  mock_toj: "Мок TOJ",
  dev: "Мок: смены и штрафы",
  etl_explorer: "Данные ETL",
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [session, setSession] = useState<AdminSessionUser | null | undefined>(undefined)
  const [list, setList] = useState<AdminPanelUser[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [permissions, setPermissions] = useState<AdminPermissionKey[]>([])
  const [isActive, setIsActive] = useState(1)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const canManage = session?.isSuper || session?.permissions?.includes("admin_users")

  useEffect(() => {
    adminAuthMe().then(setSession)
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    adminListAdminUsers()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (canManage !== false) load()
  }, [canManage, load])

  useEffect(() => {
    if (session !== undefined && !canManage) {
      router.replace("/")
    }
  }, [session, canManage, router])

  const openCreate = () => {
    setEditingId(null)
    setEmail("")
    setPassword("")
    setName("")
    setPermissions([])
    setIsActive(1)
    setSubmitError(null)
    setDialogOpen(true)
  }

  const openEdit = (u: AdminPanelUser) => {
    setEditingId(u.id)
    setEmail(u.email)
    setPassword("")
    setName(u.name ?? "")
    setPermissions(u.permissions ?? [])
    setIsActive(u.isActive)
    setSubmitError(null)
    setDialogOpen(true)
  }

  const togglePermission = (key: AdminPermissionKey) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    )
  }

  const handleSubmit = () => {
    if (editingId !== null) {
      setSubmitLoading(true)
      setSubmitError(null)
      adminUpdateAdminUser(editingId, {
        name: name.trim() || null,
        isActive,
        permissions,
        ...(password ? { password } : {}),
      })
        .then(() => {
          setDialogOpen(false)
          load()
        })
        .catch((e) => setSubmitError(e instanceof Error ? e.message : "Ошибка"))
        .finally(() => setSubmitLoading(false))
    } else {
      if (!email.trim() || !password) {
        setSubmitError("Укажите email и пароль")
        return
      }
      setSubmitLoading(true)
      setSubmitError(null)
      adminCreateAdminUser({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
        permissions,
      })
        .then(() => {
          setDialogOpen(false)
          load()
        })
        .catch((e) => setSubmitError(e instanceof Error ? e.message : "Ошибка"))
        .finally(() => setSubmitLoading(false))
    }
  }

  const handleDelete = () => {
    if (deleteId == null) return
    setDeleteLoading(true)
    adminDeleteAdminUser(deleteId)
      .then(() => {
        setDeleteId(null)
        load()
      })
      .finally(() => setDeleteLoading(false))
  }

  if (session === undefined || (session && !canManage)) {
    return (
      <div className="flex items-center justify-center py-12">
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Пользователи админки</h1>
        <Button onClick={openCreate}>Добавить</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Суперадмин задаётся в .env (ADMIN_SUPER_EMAIL, ADMIN_SUPER_PASSWORD). Остальные пользователи — здесь; права ограничивают видимость разделов меню.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Имя</TableHead>
                  <TableHead>Активен</TableHead>
                  <TableHead>Права</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(list ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-muted-foreground">{u.id}</TableCell>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>{u.name ?? "—"}</TableCell>
                    <TableCell>{u.isActive ? "Да" : "Нет"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                      {(u.permissions ?? []).length
                        ? (u.permissions ?? []).map((p) => PERMISSION_LABELS[p] ?? p).join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                          Изменить
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setDeleteId(u.id)}
                        >
                          Удалить
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {list?.length === 0 && !error && (
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                Нет пользователей (кроме суперадмина из .env)
              </p>
            </CardContent>
          )}
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId !== null ? "Редактировать пользователя" : "Новый пользователь"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                disabled={editingId !== null}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">
                Пароль {editingId !== null && "(оставьте пустым, чтобы не менять)"}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="минимум 6 символов"
                autoComplete={editingId !== null ? "new-password" : "new-password"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Имя (необязательно)</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Отображаемое имя"
              />
            </div>
            <div className="grid gap-2">
              <Label>Права доступа к разделам</Label>
              <div className="grid grid-cols-2 gap-2 border rounded-lg p-3 max-h-48 overflow-y-auto">
                {ADMIN_PERMISSION_KEYS.map((key) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={permissions.includes(key)}
                      onCheckedChange={() => togglePermission(key)}
                    />
                    <span>{PERMISSION_LABELS[key]}</span>
                  </label>
                ))}
              </div>
            </div>
            {editingId !== null && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isActive"
                  checked={isActive === 1}
                  onCheckedChange={(v) => setIsActive(v ? 1 : 0)}
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Активен (может входить в админку)
                </Label>
              </div>
            )}
            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                submitLoading ||
                !email.trim() ||
                (editingId === null && !password)
              }
            >
              {submitLoading ? "Сохранение…" : editingId !== null ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить пользователя?</AlertDialogTitle>
            <AlertDialogDescription>
              Пользователь больше не сможет входить в админ-панель. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? "Удаление…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

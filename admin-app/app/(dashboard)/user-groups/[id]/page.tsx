"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  adminListGroupMembers,
  adminUpdateUserGroup,
  adminAddGroupMember,
  adminRemoveGroupMember,
  adminImportGroupMembers,
  adminListUsers,
  type AdminUserGroupMember,
} from "@/lib/admin-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function AdminUserGroupDetailPage() {
  const params = useParams()
  const id = typeof params.id === "string" ? parseInt(params.id, 10) : NaN
  const [group, setGroup] = useState<{ id: number; name: string; description: string | null } | null>(null)
  const [members, setMembers] = useState<AdminUserGroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: "", description: "" })
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [userSearch, setUserSearch] = useState("")
  const [userSearchResults, setUserSearchResults] = useState<{ id: number; name: string | null; email: string | null }[]>([])
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const [addingUserId, setAddingUserId] = useState<number | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState("")
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ added: number; totalRequested: number; resolved: number } | null>(null)

  const load = useCallback(() => {
    if (Number.isNaN(id) || id < 1) return
    setLoading(true)
    setError(null)
    adminListGroupMembers(id)
      .then((res) => {
        setGroup(res.group)
        setMembers(res.items)
        setEditForm({ name: res.group.name, description: res.group.description ?? "" })
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!addDialogOpen) return
    const t = userSearch.trim()
    if (t.length < 1) {
      setUserSearchResults([])
      return
    }
    const timer = setTimeout(() => {
      setUserSearchLoading(true)
      adminListUsers({ search: t, page: 1, pageSize: 20 })
        .then((r) => setUserSearchResults(r.items))
        .catch(() => setUserSearchResults([]))
        .finally(() => setUserSearchLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [addDialogOpen, userSearch])

  const handleSaveGroup = () => {
    if (!group) return
    if (!editForm.name.trim()) {
      setError("Введите название группы")
      return
    }
    setSaving(true)
    setError(null)
    adminUpdateUserGroup(group.id, {
      name: editForm.name.trim(),
      description: editForm.description.trim() || null,
    })
      .then(() => {
        setEditOpen(false)
        load()
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setSaving(false))
  }

  const handleAddMember = (userId: number) => {
    if (!group) return
    setAddingUserId(userId)
    adminAddGroupMember(group.id, userId)
      .then(() => {
        load()
        setAddDialogOpen(false)
        setUserSearch("")
        setUserSearchResults([])
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setAddingUserId(null))
  }

  const handleRemoveMember = (userId: number) => {
    if (!group) return
    adminRemoveGroupMember(group.id, userId)
      .then(load)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
  }

  const handleImport = () => {
    if (!group) return
    const lines = importText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (lines.length === 0) {
      setError("Введите хотя бы один идентификатор (id, email или external_id) — по одному на строку")
      return
    }
    setImporting(true)
    setError(null)
    setImportResult(null)
    adminImportGroupMembers(group.id, lines)
      .then((res) => {
        setImportResult(res)
        load()
        setImportText("")
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setImporting(false))
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = (reader.result as string) ?? ""
      setImportText((prev) => (prev ? `${prev}\n${text}` : text))
    }
    reader.readAsText(file, "UTF-8")
    e.target.value = ""
  }

  if (Number.isNaN(id) || id < 1) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">Неверный ID группы</p>
        <Button asChild variant="outline">
          <Link href="/user-groups">К списку групп</Link>
        </Button>
      </div>
    )
  }

  if (loading && !group) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">Группа не найдена</p>
        <Button asChild variant="outline">
          <Link href="/user-groups">К списку групп</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button asChild variant="ghost" size="sm">
          <Link href="/user-groups">← Группы</Link>
        </Button>
      </div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">{group.name}</h1>
          {group.description ? (
            <p className="text-sm text-muted-foreground">{group.description}</p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          Редактировать группу
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-medium">Участники ({members.length})</h2>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                Добавить участника
              </Button>
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                Импорт из файла
              </Button>
            </div>
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Нет участников. Добавьте по одному или импортируйте из файла (по одному идентификатору на строку: id, email или external_id).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Имя</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>{m.userId}</TableCell>
                    <TableCell>{m.userName ?? "—"}</TableCell>
                    <TableCell>{m.email ?? "—"}</TableCell>
                    <TableCell>{m.externalId ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveMember(m.userId)}
                      >
                        Удалить
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Редактировать группу</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Название</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Название группы"
              />
            </div>
            <div className="grid gap-2">
              <Label>Описание</Label>
              <Input
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Описание"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveGroup} disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить участника</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Поиск по имени, email или ID. Выберите пользователя из списка.
          </p>
          <Input
            placeholder="Поиск…"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="mt-2"
          />
          <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-1">
            {userSearchLoading && <p className="text-sm text-muted-foreground">Поиск…</p>}
            {!userSearchLoading && userSearchResults.length === 0 && userSearch.trim() && (
              <p className="text-sm text-muted-foreground">Ничего не найдено</p>
            )}
            {!userSearchLoading &&
              userSearchResults.map((u) => {
                const alreadyIn = members.some((m) => m.userId === u.id)
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-muted/60"
                  >
                    <span className="text-sm">
                      #{u.id} · {u.name ?? "—"} {u.email ? `(${u.email})` : ""}
                    </span>
                    <Button
                      size="sm"
                      disabled={alreadyIn || addingUserId === u.id}
                      onClick={() => handleAddMember(u.id)}
                    >
                      {alreadyIn ? "В группе" : addingUserId === u.id ? "…" : "Добавить"}
                    </Button>
                  </div>
                )
              })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(open) => !open && setImportResult(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Импорт участников из файла</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Укажите по одному идентификатору на строку: ID пользователя, email или external_id. Можно вставить текст или загрузить файл (CSV или текстовый).
          </p>
          <div className="grid gap-2">
            <Label>Идентификаторы (по одному на строку)</Label>
            <textarea
              className="min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="1&#10;user@example.com&#10;ext_123"
            />
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                onChange={handleImportFile}
                className="max-w-xs"
              />
              <span className="text-xs text-muted-foreground">
                Загрузить файл (содержимое добавится в поле выше)
              </span>
            </div>
          </div>
          {importResult && (
            <p className="text-sm text-muted-foreground rounded bg-muted p-2">
              Добавлено: {importResult.added}, распознано: {importResult.resolved} из {importResult.totalRequested} строк.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Закрыть
            </Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Импорт…" : "Импортировать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  adminListUserGroups,
  adminCreateUserGroup,
  adminUpdateUserGroup,
  adminDeleteUserGroup,
  type AdminUserGroup,
} from "@/lib/admin-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function AdminUserGroupsPage() {
  const [groups, setGroups] = useState<AdminUserGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<AdminUserGroup | null>(null)
  const [form, setForm] = useState({ name: "", description: "" })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUserGroup | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    adminListUserGroups()
      .then(setGroups)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditingGroup(null)
    setForm({ name: "", description: "" })
    setDialogOpen(true)
  }

  const openEdit = (g: AdminUserGroup) => {
    setEditingGroup(g)
    setForm({
      name: g.name,
      description: g.description ?? "",
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setError("Введите название группы")
      return
    }
    setSaving(true)
    setError(null)
    const promise = editingGroup
      ? adminUpdateUserGroup(editingGroup.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
        })
      : adminCreateUserGroup({
          name: form.name.trim(),
          description: form.description.trim() || null,
        })
    promise
      .then(() => {
        setDialogOpen(false)
        load()
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setSaving(false))
  }

  const handleDelete = (g: AdminUserGroup) => {
    setError(null)
    adminDeleteUserGroup(g.id)
      .then(() => {
        setDeleteConfirm(null)
        load()
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Группы пользователей</h1>
      <p className="text-sm text-muted-foreground">
        Группы используются для привязки квестов (квест только для участников группы). Создайте группу, добавьте участников по одному или импортом из файла.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={openCreate}>Создать группу</Button>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <Card key={g.id}>
              <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium">{g.name}</p>
                  {g.description ? (
                    <p className="text-xs text-muted-foreground">{g.description}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Участников: {g.memberCount ?? 0}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/user-groups/${g.id}`}>Участники</Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(g)}>
                    Изменить
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeleteConfirm(g)}
                  >
                    Удалить
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {groups.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">Нет групп. Создайте группу и добавьте участников.</p>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? "Редактировать группу" : "Создать группу"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="group-name">Название</Label>
              <Input
                id="group-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Название группы"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="group-desc">Описание (необязательно)</Label>
              <Input
                id="group-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Описание"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Сохранение…" : editingGroup ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить группу?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Группа «{deleteConfirm?.name}» будет удалена. Квесты, привязанные к этой группе, перестанут показываться участникам. Удалить?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

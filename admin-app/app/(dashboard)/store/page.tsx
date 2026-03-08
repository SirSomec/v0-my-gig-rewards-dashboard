"use client"

import { useState, useEffect, useCallback } from "react"
import {
  adminListStoreItems,
  adminCreateStoreItem,
  adminUpdateStoreItem,
  adminDeleteStoreItem,
  type AdminStoreItem,
  type CreateStoreItemBody,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

const CATEGORIES = [
  { value: "discount", label: "Скидка" },
  { value: "booster", label: "Бустер" },
  { value: "merch", label: "Мерч" },
  { value: "gift", label: "Подарок" },
] as const

const ICONS = [
  { value: "gift", label: "Подарок" },
  { value: "discount", label: "Скидка" },
  { value: "booster", label: "Бустер" },
  { value: "merch", label: "Мерч" },
] as const

const emptyForm: CreateStoreItemBody & { id?: number } = {
  name: "",
  description: "",
  category: "gift",
  cost: 0,
  icon: "gift",
  stockLimit: undefined,
  isActive: 1,
  sortOrder: 0,
}

export default function AdminStorePage() {
  const [items, setItems] = useState<AdminStoreItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminStoreItem | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    adminListStoreItems()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditingItem(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (item: AdminStoreItem) => {
    setEditingItem(item)
    setForm({
      name: item.name,
      description: item.description ?? "",
      category: item.category,
      cost: item.cost,
      icon: item.icon,
      stockLimit: item.stockLimit ?? undefined,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setError("Введите название")
      return
    }
    if (form.cost < 0) {
      setError("Цена не может быть отрицательной")
      return
    }
    setSaving(true)
    setError(null)
    const body: CreateStoreItemBody = {
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      category: form.category,
      cost: Number(form.cost) || 0,
      icon: form.icon,
      stockLimit: form.stockLimit != null && form.stockLimit !== "" ? Number(form.stockLimit) : undefined,
      isActive: form.isActive ? 1 : 0,
      sortOrder: Number(form.sortOrder) || 0,
    }
    const promise = editingItem
      ? adminUpdateStoreItem(editingItem.id, body)
      : adminCreateStoreItem(body)
    promise
      .then(() => {
        setDialogOpen(false)
        load()
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setSaving(false))
  }

  const handleDelete = (id: number) => {
    setDeleteId(id)
  }

  const confirmDelete = () => {
    if (deleteId == null) return
    setDeleting(true)
    adminDeleteStoreItem(deleteId)
      .then(() => {
        setDeleteId(null)
        load()
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setDeleting(false))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Магазин (товары)</h1>
        <Button onClick={openCreate}>Добавить товар</Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.category} · {item.cost} монет
                    {item.isActive === 0 && " · скрыт"}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                    Изменить
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(item.id)}
                  >
                    Удалить
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">Нет товаров</p>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Редактировать товар" : "Новый товар"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Название</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Название товара"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Описание</Label>
              <Input
                id="description"
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Описание (необязательно)"
              />
            </div>
            <div className="grid gap-2">
              <Label>Категория</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category: v as typeof form.category }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cost">Цена (монет)</Label>
                <Input
                  id="cost"
                  type="number"
                  min={0}
                  value={form.cost}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cost: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sortOrder">Порядок</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sortOrder: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Иконка</Label>
              <Select
                value={form.icon}
                onValueChange={(v) => setForm((f) => ({ ...f, icon: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stockLimit">Лимит количества (необяз.)</Label>
              <Input
                id="stockLimit"
                type="number"
                min={0}
                value={form.stockLimit ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    stockLimit: e.target.value === "" ? undefined : Number(e.target.value),
                  }))
                }
                placeholder="Пусто — без лимита"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                checked={!!form.isActive}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isActive: checked ? 1 : 0 }))
                }
              />
              <Label htmlFor="isActive" className="font-normal">
                Товар активен (отображается в магазине)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Сохранение…" : editingItem ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить товар?</AlertDialogTitle>
            <AlertDialogDescription>
              Товар будет скрыт (мягкое удаление). Заявки на этот товар сохранятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Удаление…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

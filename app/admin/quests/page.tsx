"use client"

import { useState, useEffect, useCallback } from "react"
import {
  adminListQuests,
  adminCreateQuest,
  adminUpdateQuest,
  adminDeleteQuest,
  type AdminQuest,
  type CreateQuestBody,
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

const PERIODS = [
  { value: "daily", label: "Ежедневный" },
  { value: "weekly", label: "Еженедельный" },
] as const

const CONDITION_TYPES = [
  { value: "shifts_count", label: "Количество смен (за период)" },
] as const

const ICONS = [
  { value: "target", label: "Цель" },
  { value: "star", label: "Звезда" },
  { value: "zap", label: "Молния" },
  { value: "trophy", label: "Трофей" },
  { value: "gift", label: "Подарок" },
] as const

function conditionConfigToTotal(config: Record<string, unknown> | null): number {
  if (!config || typeof config.total !== "number") return 1
  return Math.max(1, config.total)
}

const emptyForm: CreateQuestBody & { id?: number } = {
  name: "",
  description: "",
  period: "daily",
  conditionType: "shifts_count",
  conditionConfig: { total: 1 },
  rewardCoins: 10,
  icon: "target",
  isActive: 1,
  targetType: "all",
  targetGroupId: null,
}

export default function AdminQuestsPage() {
  const [quests, setQuests] = useState<AdminQuest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingQuest, setEditingQuest] = useState<AdminQuest | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    adminListQuests()
      .then(setQuests)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditingQuest(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (quest: AdminQuest) => {
    setEditingQuest(quest)
    const total = conditionConfigToTotal(quest.conditionConfig)
    setForm({
      name: quest.name,
      description: quest.description ?? "",
      period: quest.period as "daily" | "weekly",
      conditionType: quest.conditionType,
      conditionConfig: { total },
      rewardCoins: quest.rewardCoins,
      icon: (quest.icon ?? "target") as "target" | "star" | "zap" | "trophy" | "gift",
      isActive: quest.isActive,
      targetType: (quest.targetType ?? "all") as "all" | "group",
      targetGroupId: quest.targetGroupId,
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setError("Введите название квеста")
      return
    }
    if (form.rewardCoins < 0) {
      setError("Награда не может быть отрицательной")
      return
    }
    const total = Math.max(1, Number((form.conditionConfig as { total?: number })?.total) || 1)
    const body: CreateQuestBody = {
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      period: form.period,
      conditionType: form.conditionType,
      conditionConfig: { total },
      rewardCoins: Number(form.rewardCoins) || 0,
      icon: form.icon,
      isActive: form.isActive ? 1 : 0,
      targetType: form.targetType,
      targetGroupId: form.targetGroupId ?? null,
    }
    setSaving(true)
    setError(null)
    const promise = editingQuest
      ? adminUpdateQuest(editingQuest.id, body)
      : adminCreateQuest(body)
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
    adminDeleteQuest(deleteId)
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
        <h1 className="text-lg font-semibold">Квесты</h1>
        <Button onClick={openCreate}>Добавить квест</Button>
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
          {quests.map((q) => {
            const total = conditionConfigToTotal(q.conditionConfig)
            return (
              <Card key={q.id}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{q.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {q.period === "daily" ? "Ежедневный" : "Еженедельный"} · {q.conditionType} (цель: {total}) · {q.rewardCoins} монет
                      {q.isActive === 0 && " · отключён"}
                    </p>
                    {q.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {q.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(q)}>
                      Изменить
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(q.id)}
                    >
                      Отключить
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {quests.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">Нет квестов</p>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingQuest ? "Редактировать квест" : "Новый квест"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="quest-name">Название</Label>
              <Input
                id="quest-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Название квеста"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quest-desc">Описание</Label>
              <Input
                id="quest-desc"
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Описание (необязательно)"
              />
            </div>
            <div className="grid gap-2">
              <Label>Период</Label>
              <Select
                value={form.period}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, period: v as "daily" | "weekly" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Тип условия</Label>
              <Select
                value={form.conditionType}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, conditionType: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_TYPES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.conditionType === "shifts_count" && (
              <div className="grid gap-2">
                <Label htmlFor="condition-total">Цель (кол-во смен за период)</Label>
                <Input
                  id="condition-total"
                  type="number"
                  min={1}
                  value={(form.conditionConfig as { total?: number })?.total ?? 1}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      conditionConfig: {
                        total: Math.max(1, Number(e.target.value) || 1),
                      },
                    }))
                  }
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="rewardCoins">Награда (монет)</Label>
                <Input
                  id="rewardCoins"
                  type="number"
                  min={0}
                  value={form.rewardCoins}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      rewardCoins: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Иконка</Label>
                <Select
                  value={form.icon ?? "target"}
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
            </div>
            <div className="grid gap-2">
              <Label>Привязка</Label>
              <Select
                value={form.targetType ?? "all"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    targetType: v as "all" | "group",
                    targetGroupId: v === "group" ? form.targetGroupId : null,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все пользователи</SelectItem>
                  <SelectItem value="group">Группа (targetGroupId)</SelectItem>
                </SelectContent>
              </Select>
              {form.targetType === "group" && (
                <Input
                  type="number"
                  min={1}
                  placeholder="ID группы"
                  value={form.targetGroupId ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      targetGroupId: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="quest-active"
                checked={!!form.isActive}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isActive: checked ? 1 : 0 }))
                }
              />
              <Label htmlFor="quest-active" className="font-normal">
                Квест активен (отображается в дашборде)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Сохранение…" : editingQuest ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отключить квест?</AlertDialogTitle>
            <AlertDialogDescription>
              Квест будет скрыт из дашборда (isActive=0). Прогресс пользователей сохранится.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Отключение…" : "Отключить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

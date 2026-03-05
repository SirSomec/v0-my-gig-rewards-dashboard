"use client"

import { useState, useEffect, useCallback } from "react"
import {
  adminListLevels,
  adminUpdateLevel,
  type AdminLevel,
  type UpdateLevelBody,
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

function perksToJson(perks: Array<{ title: string; description?: string }>): string {
  if (!perks?.length) return "[]"
  return JSON.stringify(perks, null, 2)
}

function parsePerksJson(value: string): Array<{ title: string; description?: string }> {
  const t = value.trim()
  if (!t) return []
  try {
    const arr = JSON.parse(t)
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (p): p is { title: string; description?: string } =>
        p && typeof p === "object" && typeof (p as { title?: unknown }).title === "string"
    )
  } catch {
    return []
  }
}

export default function AdminLevelsPage() {
  const [levels, setLevels] = useState<AdminLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLevel, setEditingLevel] = useState<AdminLevel | null>(null)
  const [form, setForm] = useState({
    name: "",
    shiftsRequired: 0,
    strikeLimitPerWeek: "" as number | "",
    strikeLimitPerMonth: "" as number | "",
    sortOrder: 0,
    perksJson: "[]",
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    adminListLevels()
      .then(setLevels)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openEdit = (level: AdminLevel) => {
    setEditingLevel(level)
    setForm({
      name: level.name,
      shiftsRequired: level.shiftsRequired,
      strikeLimitPerWeek: level.strikeLimitPerWeek ?? "",
      strikeLimitPerMonth: level.strikeLimitPerMonth ?? "",
      sortOrder: level.sortOrder,
      perksJson: perksToJson(level.perks ?? []),
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!editingLevel) return
    if (!form.name.trim()) {
      setError("Введите название уровня")
      return
    }
    if (form.shiftsRequired < 0) {
      setError("Порог смен не может быть отрицательным")
      return
    }
    const perks = parsePerksJson(form.perksJson)
    const body: UpdateLevelBody = {
      name: form.name.trim(),
      shiftsRequired: Number(form.shiftsRequired) ?? 0,
      strikeLimitPerWeek: form.strikeLimitPerWeek === "" ? null : Number(form.strikeLimitPerWeek),
      strikeLimitPerMonth: form.strikeLimitPerMonth === "" ? null : Number(form.strikeLimitPerMonth),
      sortOrder: Number(form.sortOrder) ?? 0,
      perks,
    }
    setSaving(true)
    setError(null)
    adminUpdateLevel(editingLevel.id, body)
      .then(() => {
        setDialogOpen(false)
        load()
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setSaving(false))
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Уровни лояльности</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {levels.map((l) => (
            <Card key={l.id}>
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Смен до уровня: {l.shiftsRequired} · Лимит штрафов: неделя {l.strikeLimitPerWeek ?? "—"}, месяц {l.strikeLimitPerMonth ?? "—"} · #{l.sortOrder}
                  </p>
                  {l.perks?.length ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Перки: {l.perks.map((p) => p.title).join(", ")}
                    </p>
                  ) : null}
                </div>
                <Button size="sm" variant="outline" onClick={() => openEdit(l)}>
                  Изменить
                </Button>
              </CardContent>
            </Card>
          ))}
          {levels.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">Нет уровней</p>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Редактировать уровень</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="level-name">Название</Label>
              <Input
                id="level-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Название уровня"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="shiftsRequired">Порог смен</Label>
              <Input
                id="shiftsRequired"
                type="number"
                min={0}
                value={form.shiftsRequired}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    shiftsRequired: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="strikeLimitPerWeek">Лимит штрафов за неделю</Label>
                <Input
                  id="strikeLimitPerWeek"
                  type="number"
                  min={0}
                  value={form.strikeLimitPerWeek}
                  onChange={(e) => {
                    const v = e.target.value
                    setForm((f) => ({
                      ...f,
                      strikeLimitPerWeek: v === "" ? "" : Number(v),
                    }))
                  }}
                  placeholder="—"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="strikeLimitPerMonth">Лимит штрафов за месяц</Label>
                <Input
                  id="strikeLimitPerMonth"
                  type="number"
                  min={0}
                  value={form.strikeLimitPerMonth}
                  onChange={(e) => {
                    const v = e.target.value
                    setForm((f) => ({
                      ...f,
                      strikeLimitPerMonth: v === "" ? "" : Number(v),
                    }))
                  }}
                  placeholder="—"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sortOrder">Порядок отображения</Label>
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
            <div className="grid gap-2">
              <Label htmlFor="perksJson">Перки (JSON)</Label>
              <textarea
                id="perksJson"
                className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.perksJson}
                onChange={(e) =>
                  setForm((f) => ({ ...f, perksJson: e.target.value }))
                }
                placeholder='[{"title": "Бонус 5%"}, {"title": "Приоритет", "description": "Ранний доступ к сменам"}]'
              />
              <p className="text-xs text-muted-foreground">
                Массив объектов: {"{ \"title\": \"...\", \"description\": \"...\" }"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

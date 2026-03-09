"use client"

import { useState, useEffect, useCallback } from "react"
import {
  adminListQuests,
  adminCreateQuest,
  adminUpdateQuest,
  adminDeleteQuest,
  adminListUserGroups,
  type AdminQuest,
  type AdminUserGroup,
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
  { value: "monthly", label: "Ежемесячный" },
] as const

const CONDITION_TYPES = [
  { value: "shifts_count", label: "Количество смен (за период)" },
  { value: "shifts_series", label: "Серия смен (без прогулов и поздних отмен)" },
  { value: "bookings_count", label: "Забронированные смены (за период)" },
  { value: "manual_confirmation", label: "Ручное подтверждение (администратором)" },
  { value: "shifts_count_client", label: "Смены в конкретном клиенте (бренде)" },
  { value: "shifts_count_clients", label: "Смены в нескольких клиентах" },
  { value: "shifts_count_category", label: "Смены в конкретной категории (профессии)" },
  { value: "hours_count", label: "Выполнение часов" },
  { value: "hours_count_client", label: "Часы в конкретном клиенте" },
  { value: "hours_count_clients", label: "Часы в нескольких клиентах" },
] as const

const ICONS = [
  { value: "target", label: "Цель" },
  { value: "star", label: "Звезда" },
  { value: "zap", label: "Молния" },
  { value: "trophy", label: "Трофей" },
  { value: "gift", label: "Подарок" },
] as const

type ConditionConfigForm = {
  total?: number
  totalHours?: number
  clientId?: string
  clientIds?: string[]
  category?: string
}

function conditionConfigToTotal(config: Record<string, unknown> | null, conditionType?: string): number {
  if (!config) return 1
  if (
    conditionType === "hours_count" ||
    conditionType === "hours_count_client" ||
    conditionType === "hours_count_clients"
  ) {
    return typeof config.totalHours === "number" ? Math.max(0.1, config.totalHours) : 1
  }
  if (conditionType === "shifts_series" || conditionType === "manual_confirmation") {
    return typeof config.total === "number" ? Math.max(1, config.total) : 1
  }
  return typeof config.total === "number" ? Math.max(1, config.total) : 1
}

function conditionConfigToDisplay(config: Record<string, unknown> | null, conditionType?: string): string {
  if (!config) return "1"
  if (
    conditionType === "hours_count" ||
    conditionType === "hours_count_client" ||
    conditionType === "hours_count_clients"
  ) {
    const h = config.totalHours ?? 1
    return `${h} ч`
  }
  if (conditionType === "shifts_series") {
    const t = config.total ?? 1
    return `${t} смен подряд без прогулов и поздних отмен`
  }
  if (conditionType === "manual_confirmation") {
    return "по подтверждению администратора"
  }
  const t = config.total ?? 1
  const parts = [String(t)]
  if (config.clientId) parts.push(`клиент: ${config.clientId}`)
  if (Array.isArray(config.clientIds) && config.clientIds.length) parts.push(`клиенты: ${config.clientIds.join(", ")}`)
  if (config.category) parts.push(`кат.: ${config.category}`)
  return parts.join(", ")
}

const emptyForm: CreateQuestBody & {
  id?: number
  activeUntilEndOfPeriod?: boolean
  conditionConfig?: ConditionConfigForm
} = {
  name: "",
  description: "",
  period: "daily",
  conditionType: "shifts_count",
  conditionConfig: { total: 1 },
  rewardCoins: 10,
  icon: "target",
  isActive: 1,
  isOneTime: 0,
  activeUntilEndOfPeriod: false,
  targetType: "all",
  targetGroupId: null,
}

export default function AdminQuestsPage() {
  const [quests, setQuests] = useState<AdminQuest[]>([])
  const [userGroups, setUserGroups] = useState<AdminUserGroup[]>([])
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
    Promise.all([adminListQuests(), adminListUserGroups()])
      .then(([q, g]) => {
        setQuests(q)
        setUserGroups(g)
      })
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
    const period = (quest.period === "daily" || quest.period === "weekly" || quest.period === "monthly")
      ? quest.period
      : "daily"
    const c = quest.conditionConfig || {}
    const config: ConditionConfigForm = {
      total: typeof c.total === "number" ? c.total : 1,
      totalHours: typeof c.totalHours === "number" ? c.totalHours : undefined,
      clientId: typeof c.clientId === "string" ? c.clientId : undefined,
      clientIds: Array.isArray(c.clientIds) ? c.clientIds.filter((x): x is string => typeof x === "string") : undefined,
      category: typeof c.category === "string" ? c.category : undefined,
    }
    setForm({
      name: quest.name,
      description: quest.description ?? "",
      period,
      conditionType: quest.conditionType,
      conditionConfig: config,
      rewardCoins: quest.rewardCoins,
      icon: (quest.icon ?? "target") as "target" | "star" | "zap" | "trophy" | "gift",
      isActive: quest.isActive,
      isOneTime: quest.isOneTime ?? 0,
      activeFrom: quest.activeFrom ?? undefined,
      activeUntil: quest.activeUntil ?? undefined,
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
    const cfg = form.conditionConfig || {}
    const isHours =
      form.conditionType === "hours_count" ||
      form.conditionType === "hours_count_client" ||
      form.conditionType === "hours_count_clients"
    const conditionConfig: Record<string, unknown> = {}
    if (isHours) {
      conditionConfig.totalHours = Math.max(0.1, Number(cfg.totalHours) || 1)
    } else {
      conditionConfig.total = Math.max(1, Number(cfg.total) || 1)
    }
    if (cfg.clientId?.trim()) conditionConfig.clientId = cfg.clientId.trim()
    if (Array.isArray(cfg.clientIds) && cfg.clientIds.length) conditionConfig.clientIds = cfg.clientIds
    if (cfg.category?.trim()) conditionConfig.category = cfg.category.trim()
    const body: CreateQuestBody & { activeUntilEndOfPeriod?: boolean } = {
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      period: form.period,
      conditionType: form.conditionType,
      conditionConfig,
      rewardCoins: Number(form.rewardCoins) || 0,
      icon: form.icon,
      isActive: form.isActive ? 1 : 0,
      isOneTime: form.isOneTime ? 1 : 0,
      targetType: form.targetType,
      targetGroupId: form.targetGroupId ?? null,
    }
    if (!editingQuest && form.activeUntilEndOfPeriod) {
      (body as { activeUntilEndOfPeriod?: boolean }).activeUntilEndOfPeriod = true
    }
    if (form.activeFrom) (body as CreateQuestBody).activeFrom = form.activeFrom
    if (form.activeUntil) (body as CreateQuestBody).activeUntil = form.activeUntil
    setSaving(true)
    setError(null)
    const promise = editingQuest
      ? adminUpdateQuest(editingQuest.id, body)
      : adminCreateQuest(body as CreateQuestBody)
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
            const displayTarget = conditionConfigToDisplay(q.conditionConfig, q.conditionType)
            return (
              <Card key={q.id}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{q.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {q.period === "daily"
                        ? "Ежедневный"
                        : q.period === "weekly"
                          ? "Еженедельный"
                          : q.period === "monthly"
                            ? "Ежемесячный"
                            : q.period}{" "}
                      {q.isOneTime === 1 && "· единоразовый "}
                      · {q.conditionType} (цель: {displayTarget}) · {q.rewardCoins} монет
                      {q.isActive === 0 && " · отключён"}
                      {q.activeUntil && (
                        <> · до {new Date(q.activeUntil).toLocaleString("ru", { dateStyle: "short", timeStyle: "short" })}</>
                      )}
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
                  setForm((f) => ({ ...f, period: v as "daily" | "weekly" | "monthly" }))
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
                  value={(form.conditionConfig as ConditionConfigForm)?.total ?? 1}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      conditionConfig: { ...f.conditionConfig, total: Math.max(1, Number(e.target.value) || 1) },
                    }))
                  }
                />
              </div>
            )}
            {form.conditionType === "shifts_series" && (
              <div className="grid gap-2">
                <Label htmlFor="condition-series-total">Цель (смен подряд без прогулов и поздних отмен)</Label>
                <Input
                  id="condition-series-total"
                  type="number"
                  min={1}
                  value={(form.conditionConfig as ConditionConfigForm)?.total ?? 1}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      conditionConfig: { ...f.conditionConfig, total: Math.max(1, Number(e.target.value) || 1) },
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Серия обнуляется при любом прогуле (no-show) или поздней отмене смены в течение периода.
                </p>
              </div>
            )}
            {form.conditionType === "manual_confirmation" && (
              <p className="text-sm text-muted-foreground">
                Выполнение квеста подтверждается вручную в разделе «Модерация квестов». Пользователь видит квест с прогрессом 0/1 до подтверждения админом.
              </p>
            )}
            {form.conditionType === "bookings_count" && (
              <div className="grid gap-2">
                <Label htmlFor="condition-bookings-total">Цель (кол-во забронированных смен за период)</Label>
                <Input
                  id="condition-bookings-total"
                  type="number"
                  min={1}
                  value={(form.conditionConfig as ConditionConfigForm)?.total ?? 1}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      conditionConfig: { ...f.conditionConfig, total: Math.max(1, Number(e.target.value) || 1) },
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Учитываются смены в статусе «booked» в TOJ; дата бронирования фиксируется при синхронизации и не обнуляется при смене статуса.
                </p>
              </div>
            )}
            {(form.conditionType === "shifts_count_client" || form.conditionType === "hours_count_client") && (
              <>
                {form.conditionType === "shifts_count_client" && (
                  <div className="grid gap-2">
                    <Label htmlFor="condition-total-client">Цель (кол-во смен)</Label>
                    <Input
                      id="condition-total-client"
                      type="number"
                      min={1}
                      value={(form.conditionConfig as ConditionConfigForm)?.total ?? 1}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          conditionConfig: { ...f.conditionConfig, total: Math.max(1, Number(e.target.value) || 1) },
                        }))
                      }
                    />
                  </div>
                )}
                {form.conditionType === "hours_count_client" && (
                  <div className="grid gap-2">
                    <Label htmlFor="condition-totalhours-client">Цель (часов)</Label>
                    <Input
                      id="condition-totalhours-client"
                      type="number"
                      min={0.1}
                      step={0.5}
                      value={(form.conditionConfig as ConditionConfigForm)?.totalHours ?? 1}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          conditionConfig: { ...f.conditionConfig, totalHours: Math.max(0.1, Number(e.target.value) || 1) },
                        }))
                      }
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="condition-clientId">ID или код клиента (бренда)</Label>
                  <Input
                    id="condition-clientId"
                    value={(form.conditionConfig as ConditionConfigForm)?.clientId ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        conditionConfig: { ...f.conditionConfig, clientId: e.target.value.trim() || undefined },
                      }))
                    }
                    placeholder="Например: acme"
                  />
                </div>
              </>
            )}
            {(form.conditionType === "shifts_count_clients" || form.conditionType === "hours_count_clients") && (
              <>
                {form.conditionType === "shifts_count_clients" && (
                  <div className="grid gap-2">
                    <Label htmlFor="condition-total-clients">Цель (кол-во смен)</Label>
                    <Input
                      id="condition-total-clients"
                      type="number"
                      min={1}
                      value={(form.conditionConfig as ConditionConfigForm)?.total ?? 1}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          conditionConfig: { ...f.conditionConfig, total: Math.max(1, Number(e.target.value) || 1) },
                        }))
                      }
                    />
                  </div>
                )}
                {form.conditionType === "hours_count_clients" && (
                  <div className="grid gap-2">
                    <Label htmlFor="condition-totalhours-clients">Цель (часов)</Label>
                    <Input
                      id="condition-totalhours-clients"
                      type="number"
                      min={0.1}
                      step={0.5}
                      value={(form.conditionConfig as ConditionConfigForm)?.totalHours ?? 1}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          conditionConfig: { ...f.conditionConfig, totalHours: Math.max(0.1, Number(e.target.value) || 1) },
                        }))
                      }
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="condition-clientIds">Коды клиентов (через запятую)</Label>
                  <Input
                    id="condition-clientIds"
                    value={((form.conditionConfig as ConditionConfigForm)?.clientIds ?? []).join(", ")}
                    onChange={(e) => {
                      const ids = e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                      setForm((f) => ({ ...f, conditionConfig: { ...f.conditionConfig, clientIds: ids } }))
                    }}
                    placeholder="acme, beta, gamma"
                  />
                </div>
              </>
            )}
            {form.conditionType === "shifts_count_category" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="condition-total-cat">Цель (кол-во смен)</Label>
                  <Input
                    id="condition-total-cat"
                    type="number"
                    min={1}
                    value={(form.conditionConfig as ConditionConfigForm)?.total ?? 1}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        conditionConfig: { ...f.conditionConfig, total: Math.max(1, Number(e.target.value) || 1) },
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="condition-category">Категория (профессия)</Label>
                  <Input
                    id="condition-category"
                    value={(form.conditionConfig as ConditionConfigForm)?.category ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        conditionConfig: { ...f.conditionConfig, category: e.target.value.trim() || undefined },
                      }))
                    }
                    placeholder="Например: курьер"
                  />
                </div>
              </>
            )}
            {form.conditionType === "hours_count" && (
              <div className="grid gap-2">
                <Label htmlFor="condition-totalHours">Цель (часов за период)</Label>
                <Input
                  id="condition-totalHours"
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={(form.conditionConfig as ConditionConfigForm)?.totalHours ?? 1}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      conditionConfig: { ...f.conditionConfig, totalHours: Math.max(0.1, Number(e.target.value) || 1) },
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
                  <SelectItem value="group">Группа пользователей</SelectItem>
                </SelectContent>
              </Select>
              {form.targetType === "group" && (
                <Select
                  value={form.targetGroupId != null ? String(form.targetGroupId) : ""}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      targetGroupId: v === "" ? null : Number(v),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите группу" />
                  </SelectTrigger>
                  <SelectContent>
                    {userGroups.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.name}
                        {(g.memberCount ?? 0) > 0 ? ` (${g.memberCount} чел.)` : ""}
                      </SelectItem>
                    ))}
                    {userGroups.length === 0 && (
                      <p className="px-2 py-1.5 text-sm text-muted-foreground">
                        Нет групп — создайте в разделе «Группы пользователей»
                      </p>
                    )}
                  </SelectContent>
                </Select>
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
            <div className="flex items-center gap-2">
              <Checkbox
                id="quest-once"
                checked={!!form.isOneTime}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isOneTime: checked ? 1 : 0 }))
                }
              />
              <Label htmlFor="quest-once" className="font-normal">
                Единоразовый (пользователь может выполнить только один раз)
              </Label>
            </div>
            {!editingQuest && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="quest-end-of-period"
                  checked={!!form.activeUntilEndOfPeriod}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, activeUntilEndOfPeriod: !!checked }))
                  }
                />
                <Label htmlFor="quest-end-of-period" className="font-normal">
                  Отключить в конце текущего периода ({form.period === "daily" ? "дня" : form.period === "weekly" ? "недели" : "месяца"})
                </Label>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="activeFrom">Активен с (необяз.)</Label>
                <Input
                  id="activeFrom"
                  type="datetime-local"
                  value={form.activeFrom ? form.activeFrom.slice(0, 16) : ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, activeFrom: e.target.value ? new Date(e.target.value).toISOString() : undefined }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="activeUntil">Активен до (необяз.)</Label>
                <Input
                  id="activeUntil"
                  type="datetime-local"
                  value={form.activeUntil ? form.activeUntil.slice(0, 16) : ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, activeUntil: e.target.value ? new Date(e.target.value).toISOString() : undefined }))
                  }
                />
              </div>
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

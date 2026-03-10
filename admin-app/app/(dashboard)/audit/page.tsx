"use client"

import { useState, useEffect } from "react"
import { adminListAuditLog, type AdminAuditEntry } from "@/lib/admin-api"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PAGE_SIZES = [25, 50, 100, 200]
const ACTION_OPTIONS = [
  { value: "", label: "Все действия" },
  { value: "user_level_change", label: "Изменение уровня пользователя" },
  { value: "manual_transaction", label: "Ручное начисление/списание" },
  { value: "strike_removed", label: "Снятие штрафа" },
  { value: "late_cancel_applied", label: "Штраф «поздняя отмена»" },
  { value: "store_item_create", label: "Создание товара магазина" },
  { value: "store_item_update", label: "Редактирование товара магазина" },
  { value: "store_item_delete", label: "Удаление товара магазина" },
  { value: "level_update", label: "Редактирование уровня" },
  { value: "bonus_settings_update", label: "Изменение настроек бонусов" },
  { value: "quest_create", label: "Создание квеста" },
  { value: "quest_update", label: "Редактирование квеста" },
  { value: "quest_delete", label: "Удаление квеста" },
  { value: "user_group_create", label: "Создание группы пользователей" },
  { value: "user_group_update", label: "Редактирование группы" },
  { value: "user_group_delete", label: "Удаление группы" },
  { value: "group_member_add", label: "Добавление в группу" },
  { value: "group_member_remove", label: "Удаление из группы" },
  { value: "group_member_import", label: "Импорт участников группы" },
  { value: "redemption_update", label: "Изменение заявки" },
  { value: "redemption_bulk_update", label: "Массовое изменение заявок" },
]
const ENTITY_OPTIONS = [
  { value: "", label: "Все сущности" },
  { value: "user", label: "Пользователь" },
  { value: "transaction", label: "Транзакция" },
  { value: "strike", label: "Штраф" },
  { value: "store_item", label: "Товар магазина" },
  { value: "level", label: "Уровень" },
  { value: "system_settings", label: "Настройки системы" },
  { value: "quest", label: "Квест" },
  { value: "user_group", label: "Группа пользователей" },
  { value: "user_group_member", label: "Участник группы" },
  { value: "redemption", label: "Заявка" },
]

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleString("ru-RU")
  } catch {
    return s
  }
}

export default function AdminAuditPage() {
  const [data, setData] = useState<{
    items: AdminAuditEntry[];
    total: number;
    page: number;
    pageSize: number;
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [action, setAction] = useState("")
  const [entityType, setEntityType] = useState("")

  const load = () => {
    setLoading(true)
    adminListAuditLog({ page, pageSize, action: action || undefined, entityType: entityType || undefined })
      .then(setData)
      .catch(() => setData({ items: [], total: 0, page: 1, pageSize }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [page, pageSize, action, entityType])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 0

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Журнал аудита</h1>
      <p className="text-sm text-muted-foreground">
        Кто из администраторов совершил действие (колонка «Администратор»). Колонка «external_id» заполняется при любом отношении к пользователю: изменение уровня, начисления/списания, штрафы, заявки на обмен, участники групп и т.д.
      </p>

      <Card>
        <CardHeader className="py-2 text-sm font-medium">Фильтры</CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Действие:</span>
            <Select value={action || "all"} onValueChange={(v) => setAction(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((o) => (
                  <SelectItem key={o.value || "all"} value={o.value || "all"}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Сущность:</span>
            <Select value={entityType || "all"} onValueChange={(v) => setEntityType(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value || "all"} value={o.value || "all"}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">На странице:</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            Обновить
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          ) : !data || data.items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Записей нет</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left font-medium">Дата</th>
                      <th className="p-2 text-left font-medium">Администратор</th>
                      <th className="p-2 text-left font-medium">Действие</th>
                      <th className="p-2 text-left font-medium">Сущность</th>
                      <th className="p-2 text-left font-medium">ID</th>
                      <th className="p-2 text-left font-medium">external_id</th>
                      <th className="p-2 text-left font-medium">Детали</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="p-2 text-muted-foreground">{formatDate(row.createdAt)}</td>
                        <td className="p-2">{row.adminDisplay ?? "—"}</td>
                        <td className="p-2">{row.action}</td>
                        <td className="p-2">{row.entityType ?? "—"}</td>
                        <td className="p-2">{row.entityId ?? "—"}</td>
                        <td className="p-2 font-mono text-muted-foreground">{row.entityExternalId ?? "—"}</td>
                        <td className="p-2 max-w-[280px] truncate" title={JSON.stringify(row.newValues ?? row.oldValues ?? {})}>
                          {row.newValues
                            ? Object.entries(row.newValues)
                                .map(([k, v]) => `${k}: ${String(v)}`)
                                .join(", ")
                            : row.oldValues
                              ? "было: " + Object.entries(row.oldValues).map(([k, v]) => `${k}=${String(v)}`).join(", ")
                              : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-2 p-2 border-t">
                <span className="text-xs text-muted-foreground">
                  Всего: {data.total} · стр. {data.page} из {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Назад
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Вперёд
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

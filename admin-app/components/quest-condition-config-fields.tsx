"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/** Локальное состояние параметров условия квеста (как в API condition_config). */
export type QuestConditionConfigForm = {
  total?: number
  totalHours?: number
  clientId?: string
  clientIds?: string[]
  category?: string
}

export function conditionConfigFormFromServer(
  config: Record<string, unknown> | null | undefined,
): QuestConditionConfigForm {
  const c = config || {}
  return {
    total: typeof c.total === "number" ? c.total : 1,
    totalHours: typeof c.totalHours === "number" ? c.totalHours : 1,
    clientId: typeof c.clientId === "string" ? c.clientId : "",
    clientIds: Array.isArray(c.clientIds)
      ? c.clientIds.filter((x): x is string => typeof x === "string")
      : [],
    category: typeof c.category === "string" ? c.category : "",
  }
}

export function buildQuestConditionConfig(
  conditionType: string,
  form: QuestConditionConfigForm,
): { ok: true; config: Record<string, unknown> } | { ok: false; message: string } {
  const cfg = form
  const isHours =
    conditionType === "hours_count" ||
    conditionType === "hours_count_client" ||
    conditionType === "hours_count_clients"

  if (conditionType === "manual_confirmation") {
    return { ok: true, config: {} }
  }

  const conditionConfig: Record<string, unknown> = {}

  if (isHours) {
    conditionConfig.totalHours = Math.max(0.1, Number(cfg.totalHours) || 1)
  } else {
    conditionConfig.total = Math.max(1, Number(cfg.total) || 1)
  }

  const clientIdTrim = (cfg.clientId ?? "").trim()
  const ids = (cfg.clientIds ?? []).map((s) => s.trim()).filter(Boolean)
  const catTrim = (cfg.category ?? "").trim()

  if (conditionType === "shifts_count_client" || conditionType === "hours_count_client") {
    if (!clientIdTrim) return { ok: false, message: "Укажите ID или код клиента (бренда)" }
    conditionConfig.clientId = clientIdTrim
  }
  if (conditionType === "shifts_count_clients" || conditionType === "hours_count_clients") {
    if (ids.length === 0) return { ok: false, message: "Укажите хотя бы один код клиента (через запятую)" }
    conditionConfig.clientIds = ids
  }
  if (conditionType === "shifts_count_category") {
    if (!catTrim) return { ok: false, message: "Укажите категорию (профессию)" }
    conditionConfig.category = catTrim
  }

  return { ok: true, config: conditionConfig }
}

type QuestConditionConfigFieldsProps = {
  conditionType: string
  value: QuestConditionConfigForm
  onChange: (next: QuestConditionConfigForm) => void
  disabled?: boolean
  /** Префикс id для полей (a11y). */
  idPrefix?: string
}

export function QuestConditionConfigFields({
  conditionType,
  value,
  onChange,
  disabled,
  idPrefix = "qcc",
}: QuestConditionConfigFieldsProps) {
  const pid = (name: string) => `${idPrefix}-${name}`
  const patch = (partial: Partial<QuestConditionConfigForm>) => onChange({ ...value, ...partial })

  return (
    <div className="grid gap-4 border border-border rounded-lg p-3 bg-muted/30">
      <p className="text-xs font-medium text-foreground">Параметры условия</p>

      {conditionType === "shifts_count" && (
        <div className="grid gap-2">
          <Label htmlFor={pid("total")}>Цель: смен за период</Label>
          <Input
            id={pid("total")}
            type="number"
            min={1}
            disabled={disabled}
            value={value.total ?? 1}
            onChange={(e) => patch({ total: Math.max(1, Number(e.target.value) || 1) })}
            className="w-32"
          />
        </div>
      )}

      {conditionType === "shifts_series" && (
        <div className="grid gap-2">
          <Label htmlFor={pid("series-total")}>Цель: смен подряд без прогулов и поздних отмен</Label>
          <Input
            id={pid("series-total")}
            type="number"
            min={1}
            disabled={disabled}
            value={value.total ?? 1}
            onChange={(e) => patch({ total: Math.max(1, Number(e.target.value) || 1) })}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">
            Серия обнуляется при прогуле или поздней отмене в течение периода.
          </p>
        </div>
      )}

      {conditionType === "manual_confirmation" && (
        <p className="text-xs text-muted-foreground">
          Выполнение подтверждается вручную в разделе «Модерация квестов».
        </p>
      )}

      {conditionType === "bookings_count" && (
        <div className="grid gap-2">
          <Label htmlFor={pid("bookings")}>Цель: забронированных смен за период</Label>
          <Input
            id={pid("bookings")}
            type="number"
            min={1}
            disabled={disabled}
            value={value.total ?? 1}
            onChange={(e) => patch({ total: Math.max(1, Number(e.target.value) || 1) })}
            className="w-32"
          />
        </div>
      )}

      {(conditionType === "shifts_count_client" || conditionType === "hours_count_client") && (
        <>
          {conditionType === "shifts_count_client" && (
            <div className="grid gap-2">
              <Label htmlFor={pid("total-client")}>Цель: смен</Label>
              <Input
                id={pid("total-client")}
                type="number"
                min={1}
                disabled={disabled}
                value={value.total ?? 1}
                onChange={(e) => patch({ total: Math.max(1, Number(e.target.value) || 1) })}
                className="w-32"
              />
            </div>
          )}
          {conditionType === "hours_count_client" && (
            <div className="grid gap-2">
              <Label htmlFor={pid("hours-client")}>Цель: часов</Label>
              <Input
                id={pid("hours-client")}
                type="number"
                min={0.1}
                step={0.5}
                disabled={disabled}
                value={value.totalHours ?? 1}
                onChange={(e) => patch({ totalHours: Math.max(0.1, Number(e.target.value) || 1) })}
                className="w-32"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor={pid("clientId")}>ID или код клиента (бренда)</Label>
            <Input
              id={pid("clientId")}
              disabled={disabled}
              value={value.clientId ?? ""}
              onChange={(e) => patch({ clientId: e.target.value })}
              placeholder="Например: acme"
            />
          </div>
        </>
      )}

      {(conditionType === "shifts_count_clients" || conditionType === "hours_count_clients") && (
        <>
          {conditionType === "shifts_count_clients" && (
            <div className="grid gap-2">
              <Label htmlFor={pid("total-clients")}>Цель: смен</Label>
              <Input
                id={pid("total-clients")}
                type="number"
                min={1}
                disabled={disabled}
                value={value.total ?? 1}
                onChange={(e) => patch({ total: Math.max(1, Number(e.target.value) || 1) })}
                className="w-32"
              />
            </div>
          )}
          {conditionType === "hours_count_clients" && (
            <div className="grid gap-2">
              <Label htmlFor={pid("hours-clients")}>Цель: часов</Label>
              <Input
                id={pid("hours-clients")}
                type="number"
                min={0.1}
                step={0.5}
                disabled={disabled}
                value={value.totalHours ?? 1}
                onChange={(e) => patch({ totalHours: Math.max(0.1, Number(e.target.value) || 1) })}
                className="w-32"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor={pid("clientIds")}>Коды клиентов (через запятую)</Label>
            <Input
              id={pid("clientIds")}
              disabled={disabled}
              value={(value.clientIds ?? []).join(", ")}
              onChange={(e) => {
                const ids = e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                patch({ clientIds: ids })
              }}
              placeholder="acme, beta, gamma"
            />
          </div>
        </>
      )}

      {conditionType === "shifts_count_category" && (
        <>
          <div className="grid gap-2">
            <Label htmlFor={pid("total-cat")}>Цель: смен</Label>
            <Input
              id={pid("total-cat")}
              type="number"
              min={1}
              disabled={disabled}
              value={value.total ?? 1}
              onChange={(e) => patch({ total: Math.max(1, Number(e.target.value) || 1) })}
              className="w-32"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={pid("category")}>Категория (профессия)</Label>
            <Input
              id={pid("category")}
              disabled={disabled}
              value={value.category ?? ""}
              onChange={(e) => patch({ category: e.target.value })}
              placeholder="Например: курьер"
            />
          </div>
        </>
      )}

      {conditionType === "hours_count" && (
        <div className="grid gap-2">
          <Label htmlFor={pid("totalHours")}>Цель: часов за период</Label>
          <Input
            id={pid("totalHours")}
            type="number"
            min={0.1}
            step={0.5}
            disabled={disabled}
            value={value.totalHours ?? 1}
            onChange={(e) => patch({ totalHours: Math.max(0.1, Number(e.target.value) || 1) })}
            className="w-32"
          />
        </div>
      )}
    </div>
  )
}

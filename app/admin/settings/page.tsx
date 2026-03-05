"use client"

import { useState, useEffect, useCallback } from "react"
import {
  adminGetBonusSettings,
  adminUpdateBonusSettings,
} from "@/lib/admin-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

export default function AdminSettingsPage() {
  const [shiftBonusDefaultMultiplier, setShiftBonusDefaultMultiplier] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const load = useCallback(() => {
    setLoading(true)
    adminGetBonusSettings()
      .then((r) => setShiftBonusDefaultMultiplier(String(r.shiftBonusDefaultMultiplier)))
      .catch(() => toast({ title: "Ошибка загрузки настроек", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = () => {
    const v = Number(shiftBonusDefaultMultiplier)
    if (Number.isNaN(v) || v < 0) {
      toast({ title: "Укажите неотрицательное число", variant: "destructive" })
      return
    }
    setSaving(true)
    adminUpdateBonusSettings({ shiftBonusDefaultMultiplier: v })
      .then((r) => {
        setShiftBonusDefaultMultiplier(String(r.shiftBonusDefaultMultiplier))
        toast({ title: "Настройки сохранены" })
      })
      .catch((e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }))
      .finally(() => setSaving(false))
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Настройки</h1>

      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-medium">Бонусы за смены</h2>
          <p className="text-xs text-muted-foreground">
            Множитель по умолчанию: сколько монет начисляется за один час смены (длительность округляется вверх до целого часа). Итоговый бонус = ceil(часы) × множитель по умолчанию × множитель уровня лояльности.
          </p>
          {loading ? (
            <Skeleton className="h-10 w-32" />
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="grid gap-2">
                <Label htmlFor="shiftBonusDefaultMultiplier">Множитель по умолчанию (монет за 1 час)</Label>
                <Input
                  id="shiftBonusDefaultMultiplier"
                  type="number"
                  min={0}
                  step={1}
                  value={shiftBonusDefaultMultiplier}
                  onChange={(e) => setShiftBonusDefaultMultiplier(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Сохранение…" : "Сохранить"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

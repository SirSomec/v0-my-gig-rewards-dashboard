"use client"

import { useState, useEffect, useCallback } from "react"
import {
  adminGetBonusSettings,
  adminUpdateBonusSettings,
  adminGetReliabilityRatingSettings,
  adminUpdateReliabilityRatingSettings,
  adminGetLoyaltyPreRegistration,
  adminSetLoyaltyPreRegistration,
} from "@/lib/admin-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

export default function AdminSettingsPage() {
  const [shiftBonusDefaultMultiplier, setShiftBonusDefaultMultiplier] = useState<string>("")
  const [questMonthlyBonusCap, setQuestMonthlyBonusCap] = useState<string>("")
  const [reliabilityRatingIncreasePerShift, setReliabilityRatingIncreasePerShift] = useState<string>("")
  const [reliabilityRatingDecreaseNoShow, setReliabilityRatingDecreaseNoShow] = useState<string>("")
  const [reliabilityRatingDecreaseLateCancel, setReliabilityRatingDecreaseLateCancel] = useState<string>("")
  const [reliabilityMinRatingToCountShiftForLevel, setReliabilityMinRatingToCountShiftForLevel] = useState<string>("")
  const [reliabilityMinRatingToUpgradeLevel, setReliabilityMinRatingToUpgradeLevel] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingReliability, setSavingReliability] = useState(false)
  const [loyaltyPreRegistrationEnabled, setLoyaltyPreRegistrationEnabled] = useState(false)
  const [savingPreReg, setSavingPreReg] = useState(false)
  const { toast } = useToast()

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([adminGetBonusSettings(), adminGetReliabilityRatingSettings(), adminGetLoyaltyPreRegistration()])
      .then(([bonus, reliability, preReg]) => {
        setShiftBonusDefaultMultiplier(String(bonus.shiftBonusDefaultMultiplier))
        setQuestMonthlyBonusCap(String(bonus.questMonthlyBonusCap))
        setLoyaltyPreRegistrationEnabled(!!preReg.enabled)
        setReliabilityRatingIncreasePerShift(String(reliability.reliabilityRatingIncreasePerShift))
        setReliabilityRatingDecreaseNoShow(String(reliability.reliabilityRatingDecreaseNoShow))
        setReliabilityRatingDecreaseLateCancel(String(reliability.reliabilityRatingDecreaseLateCancel))
        setReliabilityMinRatingToCountShiftForLevel(
          String(reliability.reliabilityMinRatingToCountShiftForLevel ?? 0)
        )
        setReliabilityMinRatingToUpgradeLevel(
          String(reliability.reliabilityMinRatingToUpgradeLevel ?? 0)
        )
      })
      .catch(() => toast({ title: "Ошибка загрузки настроек", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = () => {
    const v = Number(shiftBonusDefaultMultiplier)
    if (Number.isNaN(v) || v < 0) {
      toast({ title: "Укажите неотрицательное число для множителя", variant: "destructive" })
      return
    }
    const capNum = questMonthlyBonusCap.trim() === "" ? 0 : Number(questMonthlyBonusCap)
    if (questMonthlyBonusCap.trim() !== "" && (Number.isNaN(capNum) || capNum < 0)) {
      toast({ title: "Порог квестов должен быть неотрицательным числом", variant: "destructive" })
      return
    }
    setSaving(true)
    adminUpdateBonusSettings({
      shiftBonusDefaultMultiplier: v,
      questMonthlyBonusCap: capNum,
    })
      .then((r) => {
        setShiftBonusDefaultMultiplier(String(r.shiftBonusDefaultMultiplier))
        setQuestMonthlyBonusCap(String(r.questMonthlyBonusCap))
        toast({ title: "Настройки сохранены" })
      })
      .catch((e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }))
      .finally(() => setSaving(false))
  }

  const handleSaveReliability = () => {
    const inc = Number(reliabilityRatingIncreasePerShift)
    const noShow = Number(reliabilityRatingDecreaseNoShow)
    const lateCancel = Number(reliabilityRatingDecreaseLateCancel)
    const minRatingCountShift = Number(reliabilityMinRatingToCountShiftForLevel)
    const minRatingUpgradeLevel = Number(reliabilityMinRatingToUpgradeLevel)
    if (Number.isNaN(inc) || inc < 0) {
      toast({ title: "Прирост рейтинга за смену — неотрицательное число", variant: "destructive" })
      return
    }
    if (Number.isNaN(noShow) || noShow < 0) {
      toast({ title: "Снижение за прогул — неотрицательное число", variant: "destructive" })
      return
    }
    if (Number.isNaN(lateCancel) || lateCancel < 0) {
      toast({ title: "Снижение за позднюю отмену — неотрицательное число", variant: "destructive" })
      return
    }
    if (Number.isNaN(minRatingCountShift) || minRatingCountShift < 0 || minRatingCountShift > 5) {
      toast({
        title: "Минимальный рейтинг для учёта смены в уровень должен быть в диапазоне 0–5",
        variant: "destructive",
      })
      return
    }
    if (Number.isNaN(minRatingUpgradeLevel) || minRatingUpgradeLevel < 0 || minRatingUpgradeLevel > 5) {
      toast({
        title: "Минимальный рейтинг для повышения уровня должен быть в диапазоне 0–5",
        variant: "destructive",
      })
      return
    }
    setSavingReliability(true)
    adminUpdateReliabilityRatingSettings({
      reliabilityRatingIncreasePerShift: inc,
      reliabilityRatingDecreaseNoShow: noShow,
      reliabilityRatingDecreaseLateCancel: lateCancel,
      reliabilityMinRatingToCountShiftForLevel: minRatingCountShift,
      reliabilityMinRatingToUpgradeLevel: minRatingUpgradeLevel,
    })
      .then((r) => {
        setReliabilityRatingIncreasePerShift(String(r.reliabilityRatingIncreasePerShift))
        setReliabilityRatingDecreaseNoShow(String(r.reliabilityRatingDecreaseNoShow))
        setReliabilityRatingDecreaseLateCancel(String(r.reliabilityRatingDecreaseLateCancel))
        setReliabilityMinRatingToCountShiftForLevel(String(r.reliabilityMinRatingToCountShiftForLevel ?? 0))
        setReliabilityMinRatingToUpgradeLevel(String(r.reliabilityMinRatingToUpgradeLevel ?? 0))
        toast({ title: "Настройки рейтинга сохранены" })
      })
      .catch((e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }))
      .finally(() => setSavingReliability(false))
  }

  const handlePreRegToggle = (checked: boolean) => {
    setSavingPreReg(true)
    adminSetLoyaltyPreRegistration(checked)
      .then((r) => {
        setLoyaltyPreRegistrationEnabled(checked)
        if (r.updated > 0) {
          toast({ title: `Предварительная регистрация выключена. Заявок переведено в участники: ${r.updated}` })
        } else {
          toast({ title: checked ? "Предварительная регистрация включена" : "Предварительная регистрация выключена" })
        }
      })
      .catch((e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }))
      .finally(() => setSavingPreReg(false))
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Настройки</h1>

      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-medium">Предварительная регистрация в программе лояльности</h2>
          <p className="text-xs text-muted-foreground">
            Если включено, при первом входе пользователь видит экран с условиями и кнопку «Зарегистрироваться». Заявка попадает в раздел «Пользователи»; пока админ не одобрит, пользователь видит заглушку. При выключении все ожидающие заявки автоматически переводятся в участники.
          </p>
          {loading ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <div className="flex items-center gap-2">
              <Checkbox
                id="loyaltyPreReg"
                checked={loyaltyPreRegistrationEnabled}
                onCheckedChange={(c) => handlePreRegToggle(c === true)}
                disabled={savingPreReg}
              />
              <Label htmlFor="loyaltyPreReg" className="cursor-pointer">
                Включить предварительную регистрацию
              </Label>
            </div>
          )}
        </CardContent>
      </Card>

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

      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-medium">Ограничение выдачи квестов по бонусам</h2>
          <p className="text-xs text-muted-foreground">
            При достижении пользователем суммы начисленных бонусов за месяц (смены + квесты) этого порога новые квесты не выдаются до конца месяца. Уже назначенные квесты остаются доступны для выполнения. Бонусы за смены начисляются без ограничений. 0 = без ограничения.
          </p>
          {loading ? (
            <Skeleton className="h-10 w-32" />
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="grid gap-2">
                <Label htmlFor="questMonthlyBonusCap">Порог бонусов за месяц (0 = без ограничения)</Label>
                <Input
                  id="questMonthlyBonusCap"
                  type="number"
                  min={0}
                  step={1}
                  value={questMonthlyBonusCap}
                  onChange={(e) => setQuestMonthlyBonusCap(e.target.value)}
                  className="w-32"
                  placeholder="0"
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Сохранение…" : "Сохранить"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-medium">Рейтинг надёжности</h2>
          <p className="text-xs text-muted-foreground">
            Рейтинг пользователя от 0 до 5 (дробное). По умолчанию 4. За выполненную смену — прирост, за прогул или позднюю отмену — снижение на заданную величину. При ручном снятии штрафа рейтинг возвращается; при переходе смены в «подтверждена» — возврат рейтинга и прирост за смену.
          </p>
          {loading ? (
            <Skeleton className="h-10 w-32" />
          ) : (
            <div className="grid gap-4 max-w-md">
              <div className="grid gap-2">
                <Label htmlFor="reliabilityRatingIncreasePerShift">Прирост рейтинга за выполненную смену</Label>
                <Input
                  id="reliabilityRatingIncreasePerShift"
                  type="number"
                  min={0}
                  step={0.1}
                  value={reliabilityRatingIncreasePerShift}
                  onChange={(e) => setReliabilityRatingIncreasePerShift(e.target.value)}
                  className="w-32"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reliabilityRatingDecreaseNoShow">Снижение рейтинга за прогул (no_show)</Label>
                <Input
                  id="reliabilityRatingDecreaseNoShow"
                  type="number"
                  min={0}
                  step={0.1}
                  value={reliabilityRatingDecreaseNoShow}
                  onChange={(e) => setReliabilityRatingDecreaseNoShow(e.target.value)}
                  className="w-32"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reliabilityRatingDecreaseLateCancel">Снижение рейтинга за позднюю отмену</Label>
                <Input
                  id="reliabilityRatingDecreaseLateCancel"
                  type="number"
                  min={0}
                  step={0.1}
                  value={reliabilityRatingDecreaseLateCancel}
                  onChange={(e) => setReliabilityRatingDecreaseLateCancel(e.target.value)}
                  className="w-32"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reliabilityMinRatingToCountShiftForLevel">
                  Минимальный рейтинг для учёта смены в прогресс уровня (0 = без ограничения)
                </Label>
                <Input
                  id="reliabilityMinRatingToCountShiftForLevel"
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={reliabilityMinRatingToCountShiftForLevel}
                  onChange={(e) => setReliabilityMinRatingToCountShiftForLevel(e.target.value)}
                  className="w-32"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reliabilityMinRatingToUpgradeLevel">
                  Минимальный рейтинг для повышения уровня (0 = без ограничения)
                </Label>
                <Input
                  id="reliabilityMinRatingToUpgradeLevel"
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={reliabilityMinRatingToUpgradeLevel}
                  onChange={(e) => setReliabilityMinRatingToUpgradeLevel(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button onClick={handleSaveReliability} disabled={savingReliability}>
                {savingReliability ? "Сохранение…" : "Сохранить настройки рейтинга"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

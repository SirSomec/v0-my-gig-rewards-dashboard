"use client"

import { useState, useEffect, useCallback } from "react"
import {
  adminGetBonusSettings,
  adminUpdateBonusSettings,
  adminGetReliabilityRatingSettings,
  adminUpdateReliabilityRatingSettings,
  adminGetLoyaltyPreRegistration,
  adminSetLoyaltyPreRegistration,
  adminGetRatingRecoveryQuestSettings,
  adminUpdateRatingRecoveryQuestSettings,
  RATING_RECOVERY_CONDITION_TYPE_OPTIONS,
} from "@/lib/admin-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  QuestConditionConfigFields,
  buildQuestConditionConfig,
  conditionConfigFormFromServer,
  type QuestConditionConfigForm,
} from "@/components/quest-condition-config-fields"
import { useToast } from "@/hooks/use-toast"

const RR_PERIOD_LABELS: Record<string, string> = {
  daily: "За день (окно как у ежедневных квестов)",
  weekly: "За неделю",
  monthly: "За месяц",
}

const RR_CONDITION_LABELS: Record<string, string> = {
  bookings_count: "Забронированные смены",
  shifts_count: "Количество выполненных смен",
  shifts_count_client: "Смены у одного клиента",
  shifts_count_clients: "Смены у нескольких клиентов",
  shifts_count_category: "Смены в категории",
  hours_count: "Часы",
  hours_count_client: "Часы у клиента",
  hours_count_clients: "Часы у нескольких клиентов",
  shifts_series: "Серия смен без прогулов",
  manual_confirmation: "Ручное подтверждение админом",
}

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
  const [rrEnabled, setRrEnabled] = useState(false)
  const [rrAssignBelow, setRrAssignBelow] = useState("3")
  const [rrName, setRrName] = useState("")
  const [rrDescription, setRrDescription] = useState("")
  const [rrPeriod, setRrPeriod] = useState<"daily" | "weekly" | "monthly">("monthly")
  const [rrConditionType, setRrConditionType] = useState("shifts_count")
  const [rrConditionConfig, setRrConditionConfig] = useState<QuestConditionConfigForm>(() =>
    conditionConfigFormFromServer({ total: 3 }),
  )
  const [rrRewardRating, setRrRewardRating] = useState("0.3")
  const [rrIcon, setRrIcon] = useState("target")
  const [savingRr, setSavingRr] = useState(false)
  const { toast } = useToast()

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      adminGetBonusSettings(),
      adminGetReliabilityRatingSettings(),
      adminGetLoyaltyPreRegistration(),
      adminGetRatingRecoveryQuestSettings(),
    ])
      .then(([bonus, reliability, preReg, rr]) => {
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
        setRrEnabled(!!rr.enabled)
        setRrAssignBelow(String(rr.assignBelowRating))
        setRrName(rr.name)
        setRrDescription(rr.description)
        setRrPeriod(rr.period)
        setRrConditionType(rr.conditionType)
        setRrConditionConfig(conditionConfigFormFromServer(rr.conditionConfig ?? undefined))
        setRrRewardRating(String(rr.rewardReliabilityRating))
        setRrIcon(rr.icon || "target")
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

  const handleSaveRatingRecoveryQuest = () => {
    const assignBelow = Number(rrAssignBelow)
    const rewardR = Number(rrRewardRating)
    if (Number.isNaN(assignBelow) || assignBelow < 0 || assignBelow > 5) {
      toast({ title: "Порог рейтинга должен быть от 0 до 5", variant: "destructive" })
      return
    }
    if (Number.isNaN(rewardR) || rewardR < 0 || rewardR > 5) {
      toast({ title: "Прирост рейтинга за квест должен быть от 0 до 5", variant: "destructive" })
      return
    }
    if (!rrName.trim()) {
      toast({ title: "Укажите название квеста", variant: "destructive" })
      return
    }
    const built = buildQuestConditionConfig(rrConditionType, rrConditionConfig)
    if (!built.ok) {
      toast({ title: built.message, variant: "destructive" })
      return
    }
    const conditionConfig = built.config
    setSavingRr(true)
    adminUpdateRatingRecoveryQuestSettings({
      enabled: rrEnabled,
      assignBelowRating: assignBelow,
      name: rrName.trim(),
      description: rrDescription,
      period: rrPeriod,
      conditionType: rrConditionType,
      conditionConfig,
      rewardReliabilityRating: rewardR,
      icon: rrIcon,
    })
      .then((saved) => {
        setRrEnabled(!!saved.enabled)
        setRrAssignBelow(String(saved.assignBelowRating))
        setRrName(saved.name)
        setRrDescription(saved.description)
        setRrPeriod(saved.period)
        setRrConditionType(saved.conditionType)
        setRrConditionConfig(conditionConfigFormFromServer(saved.conditionConfig ?? undefined))
        setRrRewardRating(String(saved.rewardReliabilityRating))
        setRrIcon(saved.icon || "target")
        toast({ title: "Настройки автоквеста сохранены" })
      })
      .catch((e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }))
      .finally(() => setSavingRr(false))
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

      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-medium">Автоквест при падении рейтинга</h2>
          <p className="text-xs text-muted-foreground">
            Если включено, при снижении рейтинга надёжности (например, из‑за прогула или поздней отмены) до выбранного
            порога или ниже пользователю создаётся персональный единоразовый квест в разделе «Единоразовые цели». Монеты за
            него не начисляются; при выполнении начисляется только прирост рейтинга (до 5). Параметры ниже задают каждый
            такой создаваемый квест. Повторное назначение возможно после выполнения предыдущего квеста и очередного снижения
            рейтинга при тех же условиях.
          </p>
          {loading ? (
            <Skeleton className="h-40 w-full max-w-lg" />
          ) : (
            <div className="grid gap-4 max-w-lg">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rrEnabled"
                  checked={rrEnabled}
                  onCheckedChange={(c) => setRrEnabled(c === true)}
                  disabled={savingRr}
                />
                <Label htmlFor="rrEnabled" className="cursor-pointer">
                  Включить автоназначение
                </Label>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rrAssignBelow">Назначать квест, если рейтинг стал ≤ (0–5)</Label>
                <Input
                  id="rrAssignBelow"
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={rrAssignBelow}
                  onChange={(e) => setRrAssignBelow(e.target.value)}
                  className="w-32"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rrName">Название квеста</Label>
                <Input id="rrName" value={rrName} onChange={(e) => setRrName(e.target.value)} maxLength={256} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rrDescription">Описание</Label>
                <Textarea
                  id="rrDescription"
                  value={rrDescription}
                  onChange={(e) => setRrDescription(e.target.value)}
                  rows={3}
                  maxLength={512}
                />
              </div>
              <div className="grid gap-2">
                <Label>Период подсчёта прогресса</Label>
                <Select
                  value={rrPeriod}
                  onValueChange={(v) => setRrPeriod(v as "daily" | "weekly" | "monthly")}
                  disabled={savingRr}
                >
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["daily", "weekly", "monthly"] as const).map((p) => (
                      <SelectItem key={p} value={p}>
                        {RR_PERIOD_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Тип условия</Label>
                <Select value={rrConditionType} onValueChange={setRrConditionType} disabled={savingRr}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RATING_RECOVERY_CONDITION_TYPE_OPTIONS.map((v) => (
                      <SelectItem key={v} value={v}>
                        {RR_CONDITION_LABELS[v] ?? v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <QuestConditionConfigFields
                conditionType={rrConditionType}
                value={rrConditionConfig}
                onChange={setRrConditionConfig}
                disabled={savingRr}
                idPrefix="rr-cond"
              />
              <div className="grid gap-2">
                <Label htmlFor="rrRewardRating">Прирост рейтинга за выполнение (без монет)</Label>
                <Input
                  id="rrRewardRating"
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={rrRewardRating}
                  onChange={(e) => setRrRewardRating(e.target.value)}
                  className="w-32"
                />
              </div>
              <div className="grid gap-2">
                <Label>Иконка</Label>
                <Select value={rrIcon} onValueChange={setRrIcon} disabled={savingRr}>
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="target">Цель (target)</SelectItem>
                    <SelectItem value="streak">Серия (streak)</SelectItem>
                    <SelectItem value="calendar">Календарь (calendar)</SelectItem>
                    <SelectItem value="trophy">Трофей (trophy)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSaveRatingRecoveryQuest} disabled={savingRr}>
                {savingRr ? "Сохранение…" : "Сохранить автоквест"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, ChevronUp, Zap, Clock, Star, TrendingUp, Gift, Target, Award, ShieldAlert, ShieldCheck, ShieldMinus, Info } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { GigCoinIcon } from "./gig-coin-icon"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const PERK_ICON_MAP: Record<string, React.ReactNode> = {
  star: <Star size={16} />,
  "trending-up": <TrendingUp size={16} />,
  zap: <Zap size={16} />,
  clock: <Clock size={16} />,
  coin: <GigCoinIcon size={16} />,
  gift: <Gift size={16} />,
  target: <Target size={16} />,
  award: <Award size={16} />,
}
function getPerkIcon(iconName: string | undefined): React.ReactNode {
  if (!iconName) return <Star size={16} />
  const key = iconName.toLowerCase().replace(/_/g, "-")
  return PERK_ICON_MAP[key] ?? <Star size={16} />
}

interface LevelProgressProps {
  currentLevel: string
  nextLevel: string
  shiftsCompleted: number
  /** Порог смен следующего уровня (сколько всего нужно для перехода). Для прогресса и отображения X/Y. */
  shiftsRequired: number
  /** Сколько ещё смен до перехода на следующий уровень */
  shiftsRemaining: number
  /** Минимум смен за календарный месяц (UTC) для сохранения текущего уровня; null = без требования */
  currentLevelMonthlyShiftsRequiredToKeep?: number | null
  /** Сколько смен выполнено в текущем календарном месяце (UTC). */
  monthlyShiftsCompletedCurrentMonth?: number
  /** Рейтинг надёжности 0–5 (дробное). По умолчанию 4. */
  reliabilityRating?: number
  reliabilityRatingIncreasePerShift?: number
  reliabilityRatingDecreaseNoShow?: number
  reliabilityRatingDecreaseLateCancel?: number
  reliabilityMinRatingToCountShiftForLevel?: number
  reliabilityMinRatingToUpgradeLevel?: number
  reliabilityCountsShiftsForLevel?: boolean
  reliabilityAllowsLevelUpgrade?: boolean
  reliabilityRatingLog?: Array<{
    id: string
    previousRating: number
    newRating: number
    delta: number
    reason: string
    createdAt: string
  }>
  /** Перки текущего уровня из API (синхронно с настройками уровней в админке). Если заданы — отображаются вместо захардкоженного списка. */
  currentLevelPerks?: Array<{ title: string; description?: string; icon?: string }>
}

const benefits: Record<string, { icon: React.ReactNode; label: string; description: string }[]> = {
  "Серебряный партнёр": [
    { icon: <TrendingUp size={16} />, label: "+5% бонус", description: "За каждую завершённую смену" },
    { icon: <GigCoinIcon size={16} />, label: "2x монеты", description: "За смены в выходные" },
    { icon: <Star size={16} />, label: "Приоритет выбора", description: "Ранний доступ к сменам" },
  ],
  "Золотой партнёр": [
    { icon: <TrendingUp size={16} />, label: "+10% бонус", description: "За каждую завершённую смену" },
    { icon: <Zap size={16} />, label: "Мгновенные выплаты", description: "Без периода ожидания" },
    { icon: <GigCoinIcon size={16} />, label: "3x монеты", description: "За смены в выходные" },
    { icon: <Clock size={16} />, label: "Гибкий график", description: "Индивидуальное планирование смен" },
  ],
}

export function LevelProgress({
  currentLevel,
  nextLevel,
  shiftsCompleted,
  shiftsRequired,
  shiftsRemaining,
  currentLevelMonthlyShiftsRequiredToKeep = null,
  monthlyShiftsCompletedCurrentMonth = 0,
  reliabilityRating = 4,
  reliabilityRatingIncreasePerShift = 0.1,
  reliabilityRatingDecreaseNoShow = 0.2,
  reliabilityRatingDecreaseLateCancel = 0.2,
  reliabilityMinRatingToCountShiftForLevel = 0,
  reliabilityMinRatingToUpgradeLevel = 0,
  reliabilityCountsShiftsForLevel = true,
  reliabilityAllowsLevelUpgrade = true,
  reliabilityRatingLog = [],
  currentLevelPerks: currentLevelPerksFromApi,
}: LevelProgressProps) {
  const [showBenefits, setShowBenefits] = useState(false)
  const [reliabilityDialogOpen, setReliabilityDialogOpen] = useState(false)
  const benefitsId = "current-level-benefits"
  const isMaxLevel = nextLevel === "—"
  const targetShifts = shiftsRequired > 0 ? shiftsRequired : 1
  const progress = isMaxLevel ? 100 : Math.min(100, (shiftsCompleted / targetShifts) * 100)
  const ratingPct = Math.min(100, Math.max(0, (reliabilityRating / 5) * 100))
  const ratingDisplay = Number.isFinite(reliabilityRating) ? reliabilityRating.toFixed(1) : "4.0"
  const levelCountDeficit =
    reliabilityMinRatingToCountShiftForLevel > 0
      ? Math.max(0, reliabilityMinRatingToCountShiftForLevel - reliabilityRating)
      : 0
  const estimatedRecoveryShifts =
    reliabilityRatingIncreasePerShift > 0
      ? Math.ceil(levelCountDeficit / reliabilityRatingIncreasePerShift)
      : 0
  /** Цвет шкалы по рейтингу: 0 = красный, 2.5 ≈ жёлтый, 5 = зелёный (HSL hue 0 → 120) */
  const ratingStrokeColor = `hsl(${(ratingPct / 100) * 120}, 65%, 45%)`
  const reliabilityStatus =
    reliabilityRating >= 4.5
      ? { label: "Высокий", Icon: ShieldCheck, tone: "text-success bg-success/10" }
      : reliabilityRating >= 4
        ? { label: "Стабильный", Icon: ShieldCheck, tone: "text-accent bg-accent/10" }
        : reliabilityRating >= 3.5
          ? { label: "Пограничный", Icon: ShieldMinus, tone: "text-amber-600 bg-amber-500/10 dark:text-amber-400" }
          : { label: "Критический", Icon: ShieldAlert, tone: "text-destructive bg-destructive/10" }
  const StatusIcon = reliabilityStatus.Icon
  const remainingToKeep = Math.max(
    0,
    (currentLevelMonthlyShiftsRequiredToKeep ?? 0) - monthlyShiftsCompletedCurrentMonth,
  )
  const now = new Date()
  const lastDayOfCurrentMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  )
  const lastDayLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  }).format(lastDayOfCurrentMonth)
  const nextMonthLabel = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)))

  const hardcodedBenefits = benefits[currentLevel] || benefits["Серебряный партнёр"]
  const useApiPerks = currentLevelPerksFromApi != null && currentLevelPerksFromApi.length > 0
  const currentBenefits = useApiPerks
    ? currentLevelPerksFromApi.map((p) => ({
        icon: getPerkIcon(p.icon),
        label: p.title,
        description: p.description ?? "",
      }))
    : hardcodedBenefits

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="py-1.5 sm:py-2 px-3 sm:px-4">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <h2 className="text-xs sm:text-sm font-semibold text-foreground">Прогресс уровня</h2>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{currentLevel}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-accent" aria-hidden="true">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xs font-semibold text-accent">{nextLevel}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div
          className="relative h-3.5 sm:h-4 bg-secondary rounded-full overflow-hidden mb-1.5 sm:mb-2"
          role="progressbar"
          aria-label="Прогресс до следующего уровня"
          aria-valuemin={0}
          aria-valuemax={isMaxLevel ? shiftsCompleted : shiftsRequired}
          aria-valuenow={Math.min(shiftsCompleted, isMaxLevel ? shiftsCompleted : shiftsRequired)}
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: "linear-gradient(90deg, oklch(0.65 0.18 250), oklch(0.78 0.16 75))",
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full opacity-40"
            style={{
              background: "linear-gradient(90deg, transparent, oklch(0.9 0.12 80))",
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
          />
        </div>

        <div className={`flex items-center justify-between mb-1.5 sm:mb-2`}>
          <span className="text-xs text-muted-foreground">
            {shiftsCompleted}/{isMaxLevel ? shiftsCompleted : shiftsRequired} смен
          </span>
          <span className="text-xs font-medium text-accent">
            {isMaxLevel ? "Максимальный уровень" : `Ещё ${shiftsRemaining} до ${nextLevel}`}
          </span>
        </div>
        <p className="mb-2 text-[11px] sm:text-xs text-muted-foreground">
          {currentLevelMonthlyShiftsRequiredToKeep != null && currentLevelMonthlyShiftsRequiredToKeep > 0
            ? `Выполни еще ${remainingToKeep} смен до ${lastDayLabel} для сохранения уровня на ${nextMonthLabel}.`
            : "Для текущего уровня удержание по месячному порогу не требуется."}
        </p>

        <div className="mb-3 sm:mb-4 rounded-xl border border-border bg-secondary/35 p-2.5 sm:p-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 relative w-16 h-16 sm:w-20 sm:h-20">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full -rotate-90"
              role="img"
              aria-label={`Рейтинг надёжности ${ratingDisplay} из 5`}
            >
              {/* Фон круга (трек) */}
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-secondary"
              />
              {/* Заполнение по рейтингу; цвет зависит от значения: красный → жёлтый → зелёный */}
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={ratingStrokeColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(ratingPct / 100) * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
                strokeDashoffset={0}
                className="transition-[stroke-dasharray,stroke] duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex items-end">
                <span
                  className="text-lg sm:text-xl font-semibold tabular-nums leading-none"
                  style={{ color: ratingStrokeColor }}
                >
                  {ratingDisplay}
                </span>
                <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground tabular-nums -ml-0.5 leading-none">
                  /5
                </span>
              </div>
            </div>
            </div>
            <div className="min-w-0 flex-1 flex flex-col items-start gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs sm:text-sm font-medium text-foreground">Рейтинг надёжности</p>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-medium ${reliabilityStatus.tone}`}>
                  <StatusIcon size={12} />
                  {reliabilityStatus.label}
                </span>
              </div>
              <Dialog open={reliabilityDialogOpen} onOpenChange={setReliabilityDialogOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] sm:text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label="Подробнее: как считается рейтинг и на что он влияет"
                  >
                    <Info size={11} />
                    Как считается и на что влияет
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-sm sm:max-w-md" aria-describedby="reliability-dialog-desc">
              <DialogHeader>
                <DialogTitle>Рейтинг надёжности</DialogTitle>
              </DialogHeader>
              <div id="reliability-dialog-desc" className="space-y-4 text-sm text-muted-foreground">
                <section>
                  <h3 className="text-xs font-semibold text-foreground mb-2">Что меняет рейтинг</h3>
                  <ul className="space-y-1.5">
                    <li className="flex items-center justify-between gap-2">
                      <span>Подтверждённая смена</span>
                      <span className="font-semibold text-success tabular-nums">+{reliabilityRatingIncreasePerShift.toFixed(1)}</span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Прогул</span>
                      <span className="font-semibold text-destructive tabular-nums">−{reliabilityRatingDecreaseNoShow.toFixed(1)}</span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span>Поздняя отмена смены</span>
                      <span className="font-semibold text-destructive tabular-nums">−{reliabilityRatingDecreaseLateCancel.toFixed(1)}</span>
                    </li>
                    <li className="text-[11px] pt-1">
                      Снятие штрафа восстанавливает рейтинг на соответствующую величину.
                    </li>
                  </ul>
                </section>
                <section>
                  <h3 className="text-xs font-semibold text-foreground mb-2">На что влияет рейтинг</h3>
                  <ul className="space-y-2">
                    {reliabilityMinRatingToCountShiftForLevel > 0 ? (
                      <>
                        <li>
                          Смены засчитываются в прогресс уровня только при рейтинге не ниже{" "}
                          <span className="font-semibold text-foreground">{reliabilityMinRatingToCountShiftForLevel.toFixed(1)}</span>.
                          {!reliabilityCountsShiftsForLevel && (
                            <span className="block mt-1 text-destructive">
                              Сейчас не хватает <span className="font-semibold">{levelCountDeficit.toFixed(1)}</span> до порога — смены приносят монеты, но не идут в уровень.
                            </span>
                          )}
                        </li>
                        {estimatedRecoveryShifts > 0 && (
                          <li>
                            Ориентир восстановления: примерно{" "}
                            <span className="font-semibold text-foreground">{estimatedRecoveryShifts}</span>{" "}
                            {estimatedRecoveryShifts === 1 ? "смена" : estimatedRecoveryShifts < 5 ? "смены" : "смен"} без нарушений.
                          </li>
                        )}
                      </>
                    ) : (
                      <li>Порог для учёта смен в уровень не задан — все смены идут в прогресс.</li>
                    )}
                    {!isMaxLevel && reliabilityMinRatingToUpgradeLevel > 0 && (
                      <li>
                        Для перехода на уровень <span className="font-semibold text-foreground">{nextLevel}</span> нужен рейтинг не ниже{" "}
                        <span className="font-semibold text-foreground">{reliabilityMinRatingToUpgradeLevel.toFixed(1)}</span>.
                        {!reliabilityAllowsLevelUpgrade && (
                          <span className="block mt-1 text-amber-700 dark:text-amber-400">Сейчас порог не достигнут.</span>
                        )}
                      </li>
                    )}
                  </ul>
                </section>
              </div>
            </DialogContent>
              </Dialog>
              <p className="sr-only">Текущее значение рейтинга: {ratingDisplay} из 5.</p>
            </div>
          </div>
        </div>
        {/* Benefits toggle */}
        <button
          type="button"
          onClick={() => setShowBenefits(!showBenefits)}
          className="flex items-center justify-between w-full py-1.5 px-2.5 sm:py-2 sm:px-3 bg-secondary/60 rounded-lg text-xs sm:text-sm hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-expanded={showBenefits}
          aria-controls={benefitsId}
        >
          <span className="font-medium text-foreground">Текущие преимущества</span>
          {showBenefits ? (
            <ChevronUp size={16} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={16} className="text-muted-foreground" />
          )}
        </button>

        <AnimatePresence>
          {showBenefits && (
            <motion.div
              id={benefitsId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mt-2 sm:mt-3">
                {currentBenefits.map((benefit) => (
                  <div
                    key={benefit.label}
                    className="flex items-start gap-1.5 sm:gap-2 p-2 sm:p-2.5 bg-secondary/40 rounded-lg"
                  >
                    <div className="flex-shrink-0 p-1 rounded-md bg-secondary text-accent">
                      {benefit.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] sm:text-xs font-semibold text-foreground leading-tight">{benefit.label}</p>
                      <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight mt-0.5">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

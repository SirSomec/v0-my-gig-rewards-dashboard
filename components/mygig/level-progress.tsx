"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, ChevronUp, Zap, Clock, Star, TrendingUp, Gift, Target, Award } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { GigCoinIcon } from "./gig-coin-icon"

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
  /** Рейтинг надёжности 0–5 (дробное). По умолчанию 4. */
  reliabilityRating?: number
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
  reliabilityRating = 4,
  currentLevelPerks: currentLevelPerksFromApi,
}: LevelProgressProps) {
  const [showBenefits, setShowBenefits] = useState(false)
  const isMaxLevel = nextLevel === "—"
  const targetShifts = shiftsRequired > 0 ? shiftsRequired : 1
  const progress = isMaxLevel ? 100 : Math.min(100, (shiftsCompleted / targetShifts) * 100)
  const ratingPct = Math.min(100, Math.max(0, (reliabilityRating / 5) * 100))
  const ratingDisplay = Number.isFinite(reliabilityRating) ? reliabilityRating.toFixed(1) : "4.0"
  /** Цвет шкалы по рейтингу: 0 = красный, 2.5 ≈ жёлтый, 5 = зелёный (HSL hue 0 → 120) */
  const ratingStrokeColor = `hsl(${(ratingPct / 100) * 120}, 65%, 45%)`

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
        <div className="relative h-3.5 sm:h-4 bg-secondary rounded-full overflow-hidden mb-1.5 sm:mb-2">
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

        {/* Рейтинг надёжности: круг слева, цвет от красного к зелёному через жёлтый; описание справа */}
        <div className="mb-3 sm:mb-4 flex items-center gap-3 sm:gap-4">
          <div className="flex-shrink-0 relative w-16 h-16 sm:w-20 sm:h-20">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full -rotate-90"
              aria-hidden
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
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-foreground">Рейтинг надёжности</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              Растёт за выполнение смен, снижается за прогулы и поздние отмены.
            </p>
          </div>
        </div>

        {/* Benefits toggle */}
        <button
          onClick={() => setShowBenefits(!showBenefits)}
          className="flex items-center justify-between w-full py-1.5 px-2.5 sm:py-2 sm:px-3 bg-secondary/60 rounded-lg text-xs sm:text-sm hover:bg-secondary transition-colors"
          aria-expanded={showBenefits}
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

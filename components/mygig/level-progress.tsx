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
  shiftsRequired: number
  shiftsRemaining: number
  /** Штрафов за текущую неделю */
  strikesCountWeek?: number
  /** Штрафов за текущий месяц */
  strikesCountMonth?: number
  /** Лимит штрафов за неделю для уровня (при превышении — понижение) */
  strikesLimitPerWeek?: number | null
  /** Лимит штрафов за месяц для уровня (при превышении — понижение) */
  strikesLimitPerMonth?: number | null
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
  strikesCountWeek = 0,
  strikesCountMonth = 0,
  strikesLimitPerWeek,
  strikesLimitPerMonth,
  currentLevelPerks: currentLevelPerksFromApi,
}: LevelProgressProps) {
  const [showBenefits, setShowBenefits] = useState(false)
  const progress = shiftsRequired > 0 ? (shiftsCompleted / shiftsRequired) * 100 : 0
  const hasWeekLimit = strikesLimitPerWeek != null && strikesLimitPerWeek > 0
  const hasMonthLimit = strikesLimitPerMonth != null && strikesLimitPerMonth > 0
  const showStrikes = hasWeekLimit || hasMonthLimit

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
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Прогресс уровня</h2>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{currentLevel}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-primary" aria-hidden="true">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xs font-semibold text-primary">{nextLevel}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-3 bg-secondary rounded-full overflow-hidden mb-2">
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

        <div className={`flex items-center justify-between ${showStrikes ? "mb-2" : "mb-4"}`}>
          <span className="text-xs text-muted-foreground">
            {shiftsCompleted}/{shiftsRequired} смен
          </span>
          <span className="text-xs font-medium text-primary">
            Ещё {shiftsRemaining} до {nextLevel}
          </span>
        </div>

        {showStrikes && (
          <div className="mb-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              При превышении количества штрафов за неделю или за месяц уровень будет понижен на один шаг. Следите за счётчиками ниже.
            </p>
            {hasWeekLimit && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Штрафы за неделю</span>
                  <span className={strikesCountWeek > (strikesLimitPerWeek ?? 0) ? "font-medium text-destructive" : ""}>
                    {strikesCountWeek}/{strikesLimitPerWeek}
                    {strikesCountWeek > (strikesLimitPerWeek ?? 0) ? " — превышен лимит" : ""}
                  </span>
                </div>
                <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className={`absolute inset-y-0 left-0 rounded-full ${strikesCountWeek > (strikesLimitPerWeek ?? 0) ? "bg-destructive/90" : "bg-amber-500/80"}`}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, (strikesCountWeek / (strikesLimitPerWeek ?? 1)) * 100)}%`,
                    }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}
            {hasMonthLimit && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Штрафы за месяц</span>
                  <span className={strikesCountMonth > (strikesLimitPerMonth ?? 0) ? "font-medium text-destructive" : ""}>
                    {strikesCountMonth}/{strikesLimitPerMonth}
                    {strikesCountMonth > (strikesLimitPerMonth ?? 0) ? " — превышен лимит" : ""}
                  </span>
                </div>
                <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className={`absolute inset-y-0 left-0 rounded-full ${strikesCountMonth > (strikesLimitPerMonth ?? 0) ? "bg-destructive/90" : "bg-amber-500/80"}`}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, (strikesCountMonth / (strikesLimitPerMonth ?? 1)) * 100)}%`,
                    }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Benefits toggle */}
        <button
          onClick={() => setShowBenefits(!showBenefits)}
          className="flex items-center justify-between w-full py-2 px-3 bg-secondary/60 rounded-lg text-sm hover:bg-secondary transition-colors"
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
              <div className="grid grid-cols-2 gap-2 mt-3">
                {currentBenefits.map((benefit) => (
                  <div
                    key={benefit.label}
                    className="flex items-start gap-2 p-2.5 bg-secondary/40 rounded-lg"
                  >
                    <div className="flex-shrink-0 p-1 rounded-md bg-primary/15 text-primary">
                      {benefit.icon}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground leading-tight">{benefit.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{benefit.description}</p>
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

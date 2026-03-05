"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, ChevronUp, Zap, Clock, Star, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { GigCoinIcon } from "./gig-coin-icon"

interface LevelProgressProps {
  currentLevel: string
  nextLevel: string
  shiftsCompleted: number
  shiftsRequired: number
  shiftsRemaining: number
  /** Штрафы за 30 дней (устаревший счётчик) */
  strikesCount?: number
  /** Порог штрафов за 30 дней (устаревший); null = бронза */
  strikesThreshold?: number | null
  /** Штрафов за текущую неделю */
  strikesCountWeek?: number
  /** Штрафов за текущий месяц */
  strikesCountMonth?: number
  /** Лимит штрафов за неделю для уровня (при превышении — понижение) */
  strikesLimitPerWeek?: number | null
  /** Лимит штрафов за месяц для уровня (при превышении — понижение) */
  strikesLimitPerMonth?: number | null
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
  strikesCount = 0,
  strikesThreshold,
  strikesCountWeek = 0,
  strikesCountMonth = 0,
  strikesLimitPerWeek,
  strikesLimitPerMonth,
}: LevelProgressProps) {
  const [showBenefits, setShowBenefits] = useState(false)
  const progress = shiftsRequired > 0 ? (shiftsCompleted / shiftsRequired) * 100 : 0
  const hasWeekLimit = strikesLimitPerWeek != null && strikesLimitPerWeek > 0
  const hasMonthLimit = strikesLimitPerMonth != null && strikesLimitPerMonth > 0
  const showStrikes = hasWeekLimit || hasMonthLimit || (strikesThreshold != null && strikesThreshold > 0)

  const currentBenefits = benefits[currentLevel] || benefits["Серебряный партнёр"]

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

        <div className={`flex items-center justify-between ${showStrikes ? 'mb-2' : 'mb-4'}`}>
          <span className="text-xs text-muted-foreground">
            {shiftsCompleted}/{shiftsRequired} смен
          </span>
          <span className="text-xs font-medium text-primary">
            {'Ещё '}{shiftsRemaining}{' до '}{nextLevel}
          </span>
        </div>

        {showStrikes && (
          <p className="text-xs text-muted-foreground mb-4">
            {hasWeekLimit && (
              <span>
                {strikesCountWeek}/{strikesLimitPerWeek} штрафов за неделю
                {strikesCountWeek > (strikesLimitPerWeek ?? 0) ? (
                  <span className="text-destructive font-medium"> (превышен лимит)</span>
                ) : (
                  <span> (до понижения)</span>
                )}
              </span>
            )}
            {hasWeekLimit && hasMonthLimit && " · "}
            {hasMonthLimit && (
              <span>
                {strikesCountMonth}/{strikesLimitPerMonth} штрафов за месяц
                {strikesCountMonth > (strikesLimitPerMonth ?? 0) ? (
                  <span className="text-destructive font-medium"> (превышен лимит)</span>
                ) : (
                  <span> (до понижения)</span>
                )}
              </span>
            )}
            {!hasWeekLimit && !hasMonthLimit && strikesThreshold != null && strikesThreshold > 0 && (
              <span>
                {strikesCount}/{strikesThreshold} штрафов за 30 дней
                {strikesCount >= strikesThreshold ? (
                  <span className="text-destructive font-medium"> (до понижения)</span>
                ) : (
                  <span> (до понижения)</span>
                )}
              </span>
            )}
          </p>
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

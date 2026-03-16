"use client"

import { motion } from "framer-motion"
import { Check, Lock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { LevelResponse } from "@/lib/rewards-api"

interface Level {
  name: string
  shiftsRequired: number
  perks: Array<{ title: string; description?: string }>
  isCurrent: boolean
  isUnlocked: boolean
}

interface LevelsViewProps {
  /** Название текущего уровня пользователя (из API) — для подсветки карточки */
  currentLevelName?: string | null
  /** Количество завершённых смен — для определения isUnlocked */
  shiftsCompleted?: number
  /** Список уровней уже загружен в дашборде, чтобы не делать лишний запрос */
  levels?: LevelResponse[]
}

export function LevelsView({ currentLevelName, shiftsCompleted = 0, levels: levelsFromApi = [] }: LevelsViewProps = {}) {
  const levels: Level[] = levelsFromApi.map((l) => {
    const isUnlocked = shiftsCompleted >= l.shiftsRequired
    const isCurrent = currentLevelName != null && l.name === currentLevelName
    return { ...l, isCurrent, isUnlocked }
  })
  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      <h2 className="text-xs sm:text-sm font-semibold text-foreground px-1">Уровни лояльности</h2>
      {levels.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1">Нет уровней</p>
      ) : (
        levels.map((level, i) => (
          <motion.div
            key={level.name}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.1 }}
        >
          <Card
            className={`overflow-hidden ${
              level.isCurrent
                ? "border-primary/40 bg-primary/5"
                : level.isUnlocked
                ? "border-border bg-card"
                : "border-border bg-card opacity-60"
            }`}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {level.isUnlocked ? (
                    <div className={`p-1 rounded-full shrink-0 ${level.isCurrent ? "bg-secondary text-accent" : "bg-success/20 text-success"}`}>
                      <Check size={14} />
                    </div>
                  ) : (
                    <div className="p-1 rounded-full bg-secondary text-muted-foreground shrink-0">
                      <Lock size={14} />
                    </div>
                  )}
                  <span className={`text-xs sm:text-sm font-semibold min-w-0 truncate ${level.isCurrent ? "text-accent" : "text-foreground"}`}>
                    {level.name}
                  </span>
                  {level.isCurrent && (
                    <span className="text-[9px] sm:text-[10px] bg-secondary text-accent px-1 sm:px-1.5 py-0.5 rounded-full font-medium shrink-0">
                      Текущий
                    </span>
                  )}
                </div>
                <span className="text-[10px] sm:text-[11px] text-muted-foreground shrink-0">
                  {level.shiftsRequired === 0
                    ? "базовый уровень"
                    : level.isUnlocked
                      ? `открыт: ${level.shiftsRequired} смен`
                      : `ещё ${Math.max(0, level.shiftsRequired - shiftsCompleted)} смен`}
                </span>
              </div>
                <div className="flex flex-wrap gap-1">
                  {level.perks.map((perk, j) => (
                    <span
                      key={j}
                      className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                      title={perk.description}
                    >
                      {perk.description ? `${perk.title}: ${perk.description}` : perk.title}
                    </span>
                  ))}
                </div>
            </CardContent>
            </Card>
          </motion.div>
        ))
      )}
    </div>
  )
}

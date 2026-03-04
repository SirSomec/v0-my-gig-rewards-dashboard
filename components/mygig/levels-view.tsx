"use client"

import { motion } from "framer-motion"
import { Check, Lock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface Level {
  name: string
  shiftsRequired: number
  perks: string[]
  isCurrent: boolean
  isUnlocked: boolean
}

const LEVELS_DATA: Omit<Level, "isCurrent" | "isUnlocked">[] = [
  { name: "Бронзовый новичок", shiftsRequired: 0, perks: ["Базовая ставка", "Стандартное расписание", "1x начисление монет"] },
  { name: "Серебряный партнёр", shiftsRequired: 10, perks: ["+5% бонус за смены", "2x монеты в выходные", "Приоритет выбора смен"] },
  { name: "Золотой партнёр", shiftsRequired: 25, perks: ["+10% бонус за смены", "Мгновенные выплаты", "3x монеты в выходные", "Гибкий график"] },
  { name: "Платиновый элит", shiftsRequired: 50, perks: ["+15% бонус за смены", "VIP-поддержка", "5x монеты в выходные", "Эксклюзивные задания", "Бесплатный мерч"] },
]

interface LevelsViewProps {
  /** Название текущего уровня пользователя (из API) — для подсветки карточки */
  currentLevelName?: string | null
  /** Количество завершённых смен — для определения isUnlocked */
  shiftsCompleted?: number
}

export function LevelsView({ currentLevelName, shiftsCompleted = 0 }: LevelsViewProps = {}) {
  const levels: Level[] = LEVELS_DATA.map((l, i) => {
    const isUnlocked = shiftsCompleted >= l.shiftsRequired
    const isCurrent = currentLevelName != null && l.name === currentLevelName
    return { ...l, isCurrent, isUnlocked }
  })
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground px-1">Уровни лояльности</h2>
      {levels.map((level, i) => (
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
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {level.isUnlocked ? (
                    <div className={`p-1 rounded-full ${level.isCurrent ? "bg-primary/20 text-primary" : "bg-success/20 text-success"}`}>
                      <Check size={14} />
                    </div>
                  ) : (
                    <div className="p-1 rounded-full bg-secondary text-muted-foreground">
                      <Lock size={14} />
                    </div>
                  )}
                  <span className={`text-sm font-semibold ${level.isCurrent ? "text-primary" : "text-foreground"}`}>
                    {level.name}
                  </span>
                  {level.isCurrent && (
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      Текущий
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">{level.shiftsRequired} смен</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {level.perks.map((perk) => (
                  <span
                    key={perk}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                  >
                    {perk}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

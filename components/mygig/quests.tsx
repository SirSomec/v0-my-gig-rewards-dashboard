"use client"

import { motion } from "framer-motion"
import { Flame, Target, CalendarCheck, Trophy } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { GigCoinIcon } from "./gig-coin-icon"

export interface Quest {
  id: string
  title: string
  description: string
  progress: number
  total: number
  reward: number
  icon: "streak" | "target" | "calendar" | "trophy"
  completed: boolean
  /** Период цели: ежедневная, еженедельная или ежемесячная */
  period: "daily" | "weekly" | "monthly";
  /** Единоразовый квест (можно выполнить только один раз) */
  isOneTime?: boolean;
}

const iconMap = {
  streak: Flame,
  target: Target,
  calendar: CalendarCheck,
  trophy: Trophy,
}

interface QuestsProps {
  quests: Quest[]
  /** Показывать сообщение, что новые квесты ограничены до конца месяца */
  questsLimitedByCap?: boolean
}

function QuestCard({
  quest,
  index,
}: {
  quest: Quest
  index: number
}) {
  const Icon = iconMap[quest.icon]
  const progressPercent = (quest.progress / quest.total) * 100

  return (
    <motion.div
      key={quest.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={`relative p-2.5 sm:p-3 rounded-xl border transition-colors ${
        quest.completed
          ? "bg-success/10 border-success/20"
          : "bg-secondary/40 border-transparent"
      }`}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <div
          className={`flex-shrink-0 p-1.5 sm:p-2 rounded-lg ${
            quest.completed
              ? "bg-success/20 text-success"
              : "bg-secondary text-accent"
          }`}
        >
          <Icon size={16} className="sm:w-[18px] sm:h-[18px]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className={`text-xs sm:text-sm font-medium leading-tight min-w-0 truncate ${
              quest.completed ? "text-success line-through" : "text-foreground"
            }`}>
              {quest.title}
            </p>
            <div className="flex items-center gap-1 flex-shrink-0 ml-1 text-[var(--quest-bonus)]">
              <GigCoinIcon size={14} />
              <span className="text-[11px] sm:text-xs font-bold tabular-nums">
                +{quest.reward}
              </span>
            </div>
          </div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">{quest.description}</p>

          {!quest.completed && (
            <div className="mt-1.5 sm:mt-2">
              <div className="h-1 sm:h-1.5 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 + index * 0.1 }}
                />
              </div>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 sm:mt-1 inline-block">
                {quest.progress}/{quest.total}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function Quests({ quests, questsLimitedByCap }: QuestsProps) {
  const dailyQuests = quests.filter((q) => q.period === "daily" && !q.isOneTime)
  const weeklyQuests = quests.filter((q) => q.period === "weekly" && !q.isOneTime)
  const monthlyQuests = quests.filter((q) => q.period === "monthly" && !q.isOneTime)
  const onceQuests = quests.filter((q) => q.isOneTime)

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-3 sm:p-4">
        {questsLimitedByCap && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mb-3 sm:mb-4">
            Вы достигли порога бонусов за месяц. Новые квесты будут доступны с 1-го числа следующего месяца. Текущие цели можно выполнять и получать награды.
          </p>
        )}
        {dailyQuests.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h2 className="text-xs sm:text-sm font-semibold text-foreground">Ежедневные цели</h2>
              <span className="text-xs text-muted-foreground">
                {dailyQuests.filter((q) => q.completed).length}/{dailyQuests.length}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 sm:gap-2 mb-3 sm:mb-4">
              {dailyQuests.map((quest, i) => (
                <QuestCard key={quest.id} quest={quest} index={i} />
              ))}
            </div>
          </>
        )}

        {weeklyQuests.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h2 className="text-xs sm:text-sm font-semibold text-foreground">Еженедельные цели</h2>
              <span className="text-xs text-muted-foreground">
                {weeklyQuests.filter((q) => q.completed).length}/{weeklyQuests.length}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 sm:gap-2 mb-3 sm:mb-4">
              {weeklyQuests.map((quest, i) => (
                <QuestCard key={quest.id} quest={quest} index={i} />
              ))}
            </div>
          </>
        )}

        {monthlyQuests.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h2 className="text-xs sm:text-sm font-semibold text-foreground">Ежемесячные цели</h2>
              <span className="text-xs text-muted-foreground">
                {monthlyQuests.filter((q) => q.completed).length}/{monthlyQuests.length}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 sm:gap-2 mb-3 sm:mb-4">
              {monthlyQuests.map((quest, i) => (
                <QuestCard key={quest.id} quest={quest} index={i} />
              ))}
            </div>
          </>
        )}

        {onceQuests.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h2 className="text-xs sm:text-sm font-semibold text-foreground">Единоразовые цели</h2>
              <span className="text-xs text-muted-foreground">
                {onceQuests.filter((q) => q.completed).length}/{onceQuests.length}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 sm:gap-2">
              {onceQuests.map((quest, i) => (
                <QuestCard key={quest.id} quest={quest} index={i} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

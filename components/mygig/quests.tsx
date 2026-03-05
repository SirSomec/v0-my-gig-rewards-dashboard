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
      className={`relative p-3 rounded-xl border transition-colors ${
        quest.completed
          ? "bg-success/10 border-success/20"
          : "bg-secondary/40 border-transparent"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 p-2 rounded-lg ${
            quest.completed
              ? "bg-success/20 text-success"
              : "bg-primary/15 text-primary"
          }`}
        >
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className={`text-sm font-medium leading-tight ${
              quest.completed ? "text-success line-through" : "text-foreground"
            }`}>
              {quest.title}
            </p>
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              <GigCoinIcon size={14} />
              <span className="text-xs font-bold text-primary tabular-nums">+{quest.reward}</span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{quest.description}</p>

          {!quest.completed && (
            <div className="mt-2">
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 + index * 0.1 }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 inline-block">
                {quest.progress}/{quest.total}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function Quests({ quests }: QuestsProps) {
  const dailyQuests = quests.filter((q) => q.period === "daily" && !q.isOneTime)
  const weeklyQuests = quests.filter((q) => q.period === "weekly" && !q.isOneTime)
  const monthlyQuests = quests.filter((q) => q.period === "monthly" && !q.isOneTime)
  const onceQuests = quests.filter((q) => q.isOneTime)

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        {dailyQuests.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Ежедневные цели</h2>
              <span className="text-xs text-muted-foreground">
                {dailyQuests.filter((q) => q.completed).length}/{dailyQuests.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 mb-4">
              {dailyQuests.map((quest, i) => (
                <QuestCard key={quest.id} quest={quest} index={i} />
              ))}
            </div>
          </>
        )}

        {weeklyQuests.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Еженедельные цели</h2>
              <span className="text-xs text-muted-foreground">
                {weeklyQuests.filter((q) => q.completed).length}/{weeklyQuests.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 mb-4">
              {weeklyQuests.map((quest, i) => (
                <QuestCard key={quest.id} quest={quest} index={i} />
              ))}
            </div>
          </>
        )}

        {monthlyQuests.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Ежемесячные цели</h2>
              <span className="text-xs text-muted-foreground">
                {monthlyQuests.filter((q) => q.completed).length}/{monthlyQuests.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 mb-4">
              {monthlyQuests.map((quest, i) => (
                <QuestCard key={quest.id} quest={quest} index={i} />
              ))}
            </div>
          </>
        )}

        {onceQuests.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Единоразовые цели</h2>
              <span className="text-xs text-muted-foreground">
                {onceQuests.filter((q) => q.completed).length}/{onceQuests.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
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
